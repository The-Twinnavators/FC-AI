/**
 * Blocked steps in plain language, for people. A step's blocker is written for the agent ("write the acceptance tests
 * first", "re-read the file"); shown to a person it reads as a chore that FlowCode actually owns. This keeps the two
 * apart: what FlowCode does, what (if anything) the person decides, and only actions the app can really carry out.
 */
import type { Blocker, Task } from "@flowcode/contracts";
import type { Store } from "../db/store.js";

/** Actions the app supports for a stopped step or run (see contracts/api.ts). Nothing else is ever offered. */
export type BlockerActionKind = "retry_step" | "undo_step" | "resume_run" | "switch_local_coder" | "edit_request" | "open_details" | "cancel_run";

export interface BlockerAction {
  kind: BlockerActionKind;
  label: string;
}

export interface PlainBlocker {
  /** One or two plain sentences: what happened. */
  explanation: string;
  /** Who acts next: FlowCode (already scheduled), or the person (a decision). */
  owner: "flowcode" | "user";
  /** The decision the person faces, when owner is "user". */
  decision?: string;
  actions: BlockerAction[];
  /** True when no mapping matched; the category is logged for review. */
  unmapped?: boolean;
}

const A: Record<BlockerActionKind, BlockerAction> = {
  retry_step: { kind: "retry_step", label: "Retry the step" },
  undo_step: { kind: "undo_step", label: "Undo the step's changes" },
  resume_run: { kind: "resume_run", label: "Resume the build" },
  switch_local_coder: { kind: "switch_local_coder", label: "Switch this build to the local coder" },
  edit_request: { kind: "edit_request", label: "Edit the request" },
  open_details: { kind: "open_details", label: "See the details" },
  cancel_run: { kind: "cancel_run", label: "Cancel the build" },
};

const PROVIDERS: Array<[RegExp, string]> = [
  [/claude|anthropic/i, "Anthropic"],
  [/gpt|openai|o\d-/i, "OpenAI"],
  [/gemini|google/i, "Google"],
];

/** Which cloud provider a model label belongs to, if it's recognisable. */
export function providerName(label: string): string | undefined {
  return PROVIDERS.find(([re]) => re.test(label))?.[1];
}

const OUT_OF_CREDIT = /credit|quota|billing|no credits|insufficient_quota|quota_exhausted/i;

/** Plain wording for check summaries that were written as instructions to the agent. */
export function plainCheckSummary(summary: string): string {
  return summary
    .replace(/(\S+) doesn't exist yet: write the acceptance tests first/gi, "the acceptance test file $1 hasn't been written yet (the step writes it)")
    .replace(/\bnpm run \w+\s*(--\s*)?/gi, "")
    .replace(/\bdeterministic\s+/gi, "")
    .trim();
}

export function plainBlocker(task: Pick<Task, "status" | "attempts" | "title"> & { blocker?: Blocker }, store?: Store): PlainBlocker | undefined {
  const b = task.blocker;
  if (!b) return undefined;
  const reason = b.reason ?? "";
  const tries = task.attempts ? ` after ${task.attempts} ${task.attempts === 1 ? "try" : "tries"}` : "";

  // Split into smaller steps: FlowCode has already queued the smaller steps.
  if (task.status === "skipped" && /^Split into \d+ smaller steps/i.test(reason)) {
    return { explanation: `This step was split into smaller steps, which carry on the work.`, owner: "flowcode", actions: [] };
  }

  switch (b.category) {
    case "model": {
      if (OUT_OF_CREDIT.test(reason)) {
        const provider = providerName(reason);
        return {
          explanation: `The cloud model${provider ? ` (${provider})` : ""} has run out of credit, so the step couldn't run. Nothing is wrong with the step's work.`,
          owner: "user",
          decision: `Add credit${provider ? ` with ${provider}` : " with the provider"} and retry, or switch this build to the local coder.`,
          actions: [A.switch_local_coder, A.retry_step, A.open_details],
        };
      }
      return {
        explanation: `The model stopped responding properly${tries}, so the step couldn't finish.`,
        owner: "user",
        decision: "Retry the step, or switch this build to the local coder if the cloud model keeps failing.",
        actions: [A.retry_step, A.switch_local_coder, A.open_details],
      };
    }
    case "verification": {
      const why = /budget_exhausted|Turn budget/i.test(reason)
        ? "ran out of turns before it finished"
        : /no_action|prose only/i.test(reason)
          ? "the model kept answering in text instead of making the change"
          : /Look check|look review/i.test(reason)
            ? "the screen still didn't pass the design review"
            : /tests? (failed|didn't pass)|Tests failed/i.test(reason)
              ? "its tests still fail"
              : "its checks still don't pass";
      return {
        explanation: `FlowCode tried this step${tries} and stopped: ${why}. It won't retry on its own.`,
        owner: "user",
        decision: "Retry it (optionally with a hint), undo its changes, or change the request.",
        actions: [A.retry_step, A.undo_step, A.edit_request, A.open_details],
      };
    }
    case "no_progress":
      return {
        explanation: `FlowCode stopped this step${tries} because it wasn't making progress. It won't retry on its own.`,
        owner: "user",
        decision: "Retry it with a hint, undo its changes, or change the request.",
        actions: [A.retry_step, A.undo_step, A.edit_request, A.open_details],
      };
    case "approval_denied":
      return {
        explanation: "The step needed an action you declined, so it stopped.",
        owner: "user",
        decision: "Retry with a different approach, or change the request.",
        actions: [A.retry_step, A.edit_request, A.open_details],
      };
    case "policy":
      return {
        explanation: "The step tried something FlowCode's safety rules don't allow, so it stopped.",
        owner: "user",
        decision: "Look at what it tried, then retry with a hint or change the request.",
        actions: [A.open_details, A.retry_step, A.edit_request],
      };
    case "prerequisite":
      return {
        explanation: "The step is waiting on something it needs first.",
        owner: "user",
        decision: "See which step it's waiting on; retry once that's done.",
        actions: [A.open_details, A.retry_step],
      };
    case "user":
      return { explanation: "The build was paused or stopped by you.", owner: "user", decision: "Resume when you're ready.", actions: [A.resume_run, A.cancel_run] };
    default: {
      // Not mapped: say so honestly and keep a record so the mapping can be extended.
      if (store) {
        const log = store.getSetting<Array<{ category: string; reason: string; at: string }>>("blockers.unmapped", []);
        log.push({ category: b.category, reason: reason.slice(0, 200), at: new Date().toISOString() });
        store.setSetting("blockers.unmapped", log.slice(-50));
      }
      return {
        explanation: `The step stopped${tries}. FlowCode couldn't classify why.`,
        owner: "user",
        decision: "See the details, then retry or cancel.",
        actions: [A.open_details, A.retry_step, A.cancel_run],
        unmapped: true,
      };
    }
  }
}

/** The billing advice for a run-out-of-credit cloud model, naming the provider that actually ran out. */
export function creditAdvice(modelLabel: string): string {
  const provider = providerName(modelLabel);
  const where = provider === "Anthropic" ? " (console.anthropic.com → Plans & Billing)" : provider === "OpenAI" ? " (platform.openai.com → Settings → Billing)" : "";
  return `Add credits in ${provider ?? "the provider"}'s billing settings${where}, then retry the step; or switch this build to the local coder.`;
}
