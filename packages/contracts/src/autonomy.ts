/**
 * Autonomy policy: which approval requests are decided automatically at each level. Shared by the daemon
 * (enforcement) and the UI (explanations), so what the user reads is exactly what runs.
 */
export type AutonomyLevel = "supervised" | "assisted" | "autonomous";

export interface AutonomyCandidate {
  kind: "plan" | "command" | "file_operation" | "external_research" | "hosted_model" | "retry_override" | "dependency_install" | "enhancement_idea";
  risk: "low" | "medium" | "high";
  action: string;
  affected: string[];
}

/** `forYou`: what each level means in everyday words; `autoApproves`/`alwaysAsks` are the exact rules the daemon applies. */
export const AUTONOMY_LEVELS: Array<{ id: AutonomyLevel; label: string; summary: string; forYou: string[]; autoApproves: string[]; alwaysAsks: string[] }> = [
  {
    id: "supervised",
    label: "Supervised",
    summary: "You approve every consequential step.",
    forYou: [
      "It shows you the plan and waits for your OK before building anything.",
      "It asks before downloading anything into the project, deleting or rewriting a file, or running a program it hasn't checked.",
      "Nothing leaves this computer without your OK.",
    ],
    autoApproves: ["Low-risk plans (local edits only)"],
    alwaysAsks: ["Medium/high-risk plans", "Installs", "Out-of-scope edits", "Deletes and whole-file replaces", "Unverified scripts and programs", "External research", "Hosted models"],
  },
  {
    id: "assisted",
    label: "Assisted",
    summary: "Routine steps run on their own; you are asked about real risk.",
    forYou: [
      "Small and medium plans start on their own; big or risky ones wait for you.",
      "It can download the building blocks the project already lists, and edit the app's own code.",
      "It asks before adding new packages, deleting or rewriting files, running unchecked programs, or sending anything off this computer.",
    ],
    autoApproves: ["Low- and medium-risk plans", "Installing the project's declared dependencies", "Edits inside src/ beyond the task's scope", "Resuming after an interruption"],
    alwaysAsks: ["High-risk plans", "Adding new packages", "Deletes and whole-file replaces", "Unverified scripts and programs", "External research", "Hosted models"],
  },
  {
    id: "autonomous",
    label: "Autonomous",
    summary: "Works end to end without stopping; every automatic decision is logged and reversible.",
    forYou: [
      "It works start to finish without stopping, including downloads, deletes and rewrites.",
      "Every file is saved before it changes, so any step can be undone.",
      "It still asks before searching the web or sending your code to a cloud model.",
    ],
    autoApproves: ["All plans", "Installs from the npm registry", "Edits anywhere in the workspace", "Deletes and replaces (snapshotted)", "Unverified project scripts", "Resuming after a restart"],
    alwaysAsks: ["External research (data leaves the machine)", "Hosted models (code leaves the machine)"],
  },
];

/** Returns a reason string when the request should be auto-approved at this level, otherwise undefined. */
export function autoApprovalReason(level: AutonomyLevel, a: AutonomyCandidate): string | undefined {
  // Hard limit at every level: nothing that sends data off the machine is auto-approved.
  if (a.kind === "external_research" || a.kind === "hosted_model") return undefined;
  // Improvement ideas are suggestions for you to choose; they are never accepted on your behalf.
  if (a.kind === "enhancement_idea") return undefined;
  if (level === "supervised") return a.kind === "plan" && a.risk === "low" ? "low-risk plan" : undefined;
  if (level === "assisted") {
    if (a.kind === "plan" && a.risk !== "high") return `${a.risk}-risk plan`;
    // `npm install` with no package arguments installs only what the manifest already declares.
    if (a.kind === "dependency_install" && /`(npm|pnpm|yarn) (install|i|ci)(\s+--[\w-]+)*`/.test(a.action)) return "installs the project's declared dependencies";
    if (a.kind === "file_operation" && !/^(delete|replace)/i.test(a.action) && a.affected.length > 0 && a.affected.every((p) => p.startsWith("src/"))) return "edit inside src/";
    return undefined;
  }
  // autonomous
  if (a.kind === "retry_override") return "retry after no-progress block";
  return `autonomous policy (${a.kind}, ${a.risk} risk)`;
}

/**
 * What an approval means for you, in everyday words (VUS: "is this downloading something onto my computer?"). Shown
 * above the exact action, which stays the record of what is approved.
 */
export function approvalForYou(a: { kind: AutonomyCandidate["kind"] | string; action: string }): string | undefined {
  const act = a.action;
  switch (a.kind) {
    case "dependency_install":
      return /`(npm|pnpm|yarn) (install|i|ci)(\s+--[\w-]+)*`/.test(act)
        ? "Downloads the free building blocks this project already lists into its own folder. Normal for every build. Nothing outside the project folder changes."
        : "Adds new building blocks (packages written by other people) from the npm registry to this project. They go into the project folder only; FlowCode asks because they're new code.";
    case "file_operation":
      if (/^delete/i.test(act)) return "Deletes a file in your app. FlowCode saves a copy first, so you can undo it from the Review tab.";
      if (/^replace/i.test(act)) return "Rewrites a whole file in your app. A copy is saved first, so you can undo it from the Review tab.";
      return "Edits a file the plan didn't mention. A copy is saved first, so you can undo it from the Review tab.";
    case "command":
      return "Runs a program in your project folder that FlowCode hasn't checked. It stays inside the project folder and can't read your secrets.";
    case "external_research":
      return "Searches the web. The search words leave this computer; your code doesn't.";
    case "hosted_model":
      return "Sends this project's code to the cloud model's provider, which charges per use.";
    case "plan":
      return "Starts building to this plan. Nothing is built until you approve it.";
    case "retry_override":
      return "Lets a stuck step try once more with a FlowCode limit relaxed.";
    default:
      return undefined;
  }
}
