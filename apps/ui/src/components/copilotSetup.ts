/**
 * The Copilot before any model can run: a scripted setup assistant. No model is needed (there isn't one yet), so it
 * answers from fixed text and the live setup status: the next step, how to do it, and the questions a first-time user
 * asks (what Ollama is, how to open a terminal, which model, does it cost anything). Every reply ends with quick
 * replies, so nothing has to be typed.
 */
export type SetupState = {
  step: "start-ollama" | "install-ollama" | "pull-model" | "test-coder" | "testing" | "use-coder" | "ready";
  ollama: { running: boolean; installed: boolean };
  models: Array<{ name: string; sizeGb: number; tools: boolean }>;
  coder: { model: string };
  candidate?: { model: string };
  recommend: { model: string; sizeGb: number; why: string; lighter?: { model: string; sizeGb: number; why: string } };
  testing?: { model: string };
  assistant: { model: string; available: boolean };
};

/** True while the Copilot has no model to answer with, so the script answers instead. */
export const scripted = (s?: SetupState) => !!s && (!s.ollama.running || !s.assistant.available);

const CHIPS = {
  next: "What do I do next?",
  what: "What is Ollama?",
  install: "How do I install Ollama?",
  done: "I've done that, check again",
  terminal: "How do I open a terminal?",
  which: "Which model should I download?",
  cost: "Does it cost anything?",
  slow: "My computer is slow",
  test: "What's the coder test?",
};

/** The next step, in plain words. */
function nextStep(s: SetupState): string {
  switch (s.step) {
    case "install-ollama":
      return "First, install Ollama: the free program FlowCode uses to run AI models on your computer. Download it from ollama.com/download, run the installer, and it starts in the background (its icon appears by the clock). I'll notice by myself.";
    case "start-ollama":
      return "Ollama is installed but not running. Open it from the Start menu (search for \"Ollama\"); its icon appears by the clock. I'll notice within a few seconds.";
    case "pull-model":
      return `Ollama is running. Now download a model: open a terminal and run  ollama pull ${s.recommend.model}  (about ${s.recommend.sizeGb} GB). ${s.recommend.why}`;
    case "test-coder":
      return `${s.candidate?.model ?? "Your model"} is downloaded. The Dashboard's setup card has Test and use it: FlowCode checks it can safely read, create and edit files (a few minutes), then makes it the coder.`;
    case "testing":
      return `${s.testing?.model} is being tested now. It usually takes a few minutes; the setup card ticks it off when it passes.`;
    case "use-coder":
      return `${s.candidate?.model} passed the coder test. Press Use it on the Dashboard's setup card and FlowCode can build.`;
    default:
      return "Everything is set up: start a prototype from the Dashboard.";
  }
}

const has = (q: string, re: RegExp) => re.test(q.toLowerCase());

/** A reply and the quick replies after it. */
export function setupReply(question: string, s: SetupState): { text: string; chips: string[] } {
  const q = question.trim();
  const base = s.step === "install-ollama" || s.step === "start-ollama" ? [CHIPS.done, CHIPS.what, CHIPS.cost] : s.step === "pull-model" ? [CHIPS.terminal, CHIPS.which, CHIPS.done] : [CHIPS.test, CHIPS.next];
  const reply = (text: string, extra: string[] = []) => ({ text, chips: [...new Set([...extra, ...base])].slice(0, 4) });

  if (!q || has(q, /next|what (do|should) i do|help|start|set ?up|get started|hello|^hi\b|^hey\b/)) return reply(nextStep(s));
  if (has(q, /check again|done|did it|installed it|finished|downloaded|ready|it'?s running/)) {
    return reply(s.step === "ready" ? "All set: FlowCode can build now." : `I checked again. ${nextStep(s)}`);
  }
  if (has(q, /what('?s| is) ollama|why (do i )?need/)) {
    return reply("Ollama is a free program that runs AI models on your own computer. FlowCode uses it so your code and ideas stay on this computer: nothing is sent anywhere, and there's nothing to pay. It runs quietly in the background once installed.", [CHIPS.install]);
  }
  if (has(q, /install|download ollama|get ollama/)) {
    return reply("Go to ollama.com/download, choose your system (Windows), run the installer and follow its steps. When it's done, Ollama runs in the background with an icon by the clock. Then tell me \"done\", or just wait: the setup card checks by itself.", [CHIPS.done]);
  }
  if (has(q, /terminal|command|powershell|cmd/)) {
    return reply(`On Windows: press the Windows key, type "PowerShell" and press Enter. A window with a prompt opens. Paste this and press Enter:  ollama pull ${s.recommend.model}  It shows a progress bar while it downloads; you can keep working.`, [CHIPS.which, CHIPS.done]);
  }
  if (has(q, /which model|what model|model should|recommend|size|disk|space|how big/)) {
    const lighter = s.recommend.lighter ? ` If that's too heavy for this computer, ${s.recommend.lighter.model} (${s.recommend.lighter.sizeGb} GB) is lighter: ${s.recommend.lighter.why}` : "";
    return reply(`${s.recommend.model} (about ${s.recommend.sizeGb} GB). ${s.recommend.why}${lighter} For FlowCode's visual review of your screens you can also add qwen2.5vl:3b (about 3 GB).`, [CHIPS.terminal]);
  }
  if (has(q, /cost|pay|price|free|money|subscription/)) {
    return reply("Nothing. Ollama and the models are free, and they run on your own computer. A cloud model is optional and only used when you choose it; that one is billed by its provider.");
  }
  if (has(q, /slow|fast|gpu|memory|ram|old computer|laptop/)) {
    return reply(`Models run fastest with a graphics card (GPU). On a computer without much memory, use the lighter model${s.recommend.lighter ? ` (${s.recommend.lighter.model})` : ""}; builds take longer but work the same. Close other heavy programs while FlowCode builds.`);
  }
  if (has(q, /test|capability|check/)) {
    return reply("Before a model may write code, FlowCode gives it 8 short checks: reading a file, creating one, editing one precisely, leaving protected files alone, and so on. They run in a throwaway folder and take a few minutes. Only a model that passes every check becomes the coder.", [CHIPS.next]);
  }
  if (has(q, /private|privacy|safe|data|internet|online|cloud/)) {
    return reply("With Ollama, everything runs on this computer: your descriptions, code and screenshots never leave it. FlowCode only uses the cloud if you set a cloud model up and choose it for a build or a change.");
  }
  return reply(`I can't answer freely until a model is set up, so I'm sticking to setup for now. ${nextStep(s)}`);
}

/** The first message while scripted. */
export function setupGreeting(s: SetupState): { text: string; chips: string[] } {
  const r = setupReply("", s);
  return { text: `Hi! Before I can answer questions about FlowCode, it needs Ollama and a model to run AI on your computer. I'll walk you through it. ${r.text}`, chips: r.chips };
}
