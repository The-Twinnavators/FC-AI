/**
 * The journeys the Copilot can walk you through in the app (see CopilotDriver). Each is built from real controls, and
 * each ends on its final button for you to press. matchJourney() picks one from what you asked, with any details
 * you gave (a website address, an idea's title).
 */
import type { Journey, Step } from "./CopilotDriver";

export function captureStyleJourney(projectId: string, projectName: string, url?: string): Journey {
  return {
    title: "Capture a style",
    steps: [
      { do: "go", path: `/projects/${projectId}`, say: `First, open ${projectName} in the builder.` },
      { do: "tab", tab: "styles", say: "The Design tab holds the app's look: colors, fonts, corners and surfaces." },
      { do: "click", target: "capture-open", say: "Capture a style lives here, at the top right of the Design tab." },
      url
        ? { do: "type", target: "capture-url", text: url, say: `I've put in the website to take the style from: ${url}.` }
        : { do: "point", target: "capture-url", say: "Paste the website you like here, or use Attach files for screenshots, mockups, CSS or HTML." },
      { do: "confirm", target: "capture-go", say: "Press Capture when you're ready. It asks you to confirm, because it restyles every page." },
    ],
  };
}

export function addIdeaJourney(projectId: string, projectName: string, title?: string, detail?: string): Journey {
  return {
    title: "Add your own idea",
    steps: [
      { do: "go", path: `/quality/${projectId}/ideas`, say: `Ideas for ${projectName} live on its Suggestions tab.` },
      title
        ? { do: "type", target: "idea-title", text: title, say: "I've written your idea's title." }
        : { do: "point", target: "idea-title", say: "Give your idea a short title here." },
      detail
        ? { do: "type", target: "idea-detail", text: detail, say: "And what should be built." }
        : { do: "point", target: "idea-detail", say: "Optionally, say what should be built: where it goes and how you'd check it works." },
      { do: "confirm", target: "idea-save", say: "Press Save for later to keep it on the list, or Build this now to start it. Your call." },
    ],
  };
}

export function newBuildJourney(description?: string): Journey {
  return {
    title: "Start a new build",
    steps: [
      { do: "go", path: "/", say: "New builds start from the Dashboard." },
      { do: "event", name: "fc:new-build", say: "This opens New build: four short steps, from what you want to who writes the code." },
      description
        ? { do: "type", target: "nb-desc", text: description, say: "I've described what you want to build." }
        : { do: "point", target: "nb-desc", say: "Describe what you want in your own words. If you have a PRD, add it just below." },
      { do: "confirm", target: "nb-next", say: "Go through the steps with Next. Nothing is built until you press Build the prototype at the end." },
    ],
  };
}

/** Starting a prototype from a PRD you already have: New build, then the spec-file drop zone in step 1. */
export function prdBuildJourney(): Journey {
  return {
    title: "Start a prototype from your PRD",
    steps: [
      { do: "go", path: "/", say: "New prototypes start from the Dashboard.", auto: true },
      { do: "event", name: "fc:new-build", say: "Start a prototype opens New build." },
      { do: "point", target: "nb-desc", say: "Write a sentence or two about what you're building. Step 1 always needs this, even with a PRD." },
      { do: "point", target: "nb-files", say: "Add your PRD here: drop the .md file in, or click choose files to pick it from your computer. FlowCode builds the prototype from it." },
      { do: "confirm", target: "nb-next", say: "Then go through the steps with Next. Nothing is built until you press Build the prototype at the end." },
    ],
  };
}

export function newBuildStyleJourney(url?: string, description?: string): Journey {
  return {
    title: "Capture a style in a new build",
    steps: [
      { do: "go", path: "/", say: "New builds start from the Dashboard.", auto: true },
      { do: "event", name: "fc:new-build", say: "This opens New build. The look is chosen in step 2, Look and feel." },
      ...(description
        ? ([
            { do: "type", target: "nb-desc", text: description, say: "Step 1 needs a description first, so I've written yours in." },
            { do: "click", target: "nb-next", say: "On to step 2, Look and feel." },
          ] as Step[])
        : ([{ do: "wait", target: "nb-desc", until: "nb-style-url", say: "Step 1 needs a description first. Describe what you want here, then press Next and I'll carry on." }] as Step[])),
      url
        ? { do: "type", target: "nb-style-url", text: url, say: `I've put in the website to take the style from: ${url}. Its colors, fonts, corners and surfaces become your starting design.` }
        : { do: "point", target: "nb-style-url", say: "Paste the website whose look you like here. Its colors, fonts, corners and surfaces become your starting design." },
      { do: "point", target: "newbuild.look", say: "Below it you can also pick a starting template and the feel, or leave FlowCode's suggestion." },
      { do: "confirm", target: "nb-next", say: "Carry on with Next for the name and how hands-on FlowCode is. Nothing is built until you press Build the prototype, and you can still change the look on the Design tab before the build starts." },
    ],
  };
}

export function createPrdJourney(problem?: string): Journey {
  return {
    title: "Create a PRD",
    steps: [
      { do: "go", path: "/discover/new", say: "Create PRD starts from the problem, not the solution." },
      problem
        ? { do: "type", target: "prd-problem", text: problem, say: "I've written the problem in." }
        : { do: "point", target: "prd-problem", say: "Describe the problem: who has it and what goes wrong for them." },
      { do: "confirm", target: "prd-start", say: "Press Start. FlowCode researches it with you and drafts the PRD section by section, and you approve each part." },
    ],
  };
}

const ROLE_WORDS: Array<[RegExp, string]> = [[/\bcoder|coding\b/, "coder"], [/\bplanner|planning\b/, "planner"], [/\bdebugger\b/, "debugger"], [/\bcritic|visual|vision\b/, "critic"], [/\bresearcher|research\b/, "researcher"], [/\bdocumenter|copilot|writer\b/, "documenter"], [/\breviewer\b/, "reviewer"]];
/**
 * Walking the research workspace, stage by stage. Built from the project's own stages, because Light and Deep have
 * different ones and a project can drop the optional sections; a hard-coded six would point at stages that are not
 * there. Each stage is the same two beats - draft it, then your turn to continue - and the Copilot waits for the
 * next stage to actually open before going on, rather than assuming your click landed.
 */
export function prdStagesJourney(id: string, stages: Array<{ id: string; name: string; optional?: boolean }>): Journey {
  const steps: Step[] = [
    { do: "go", path: `/discover/${id}`, say: "This is the research workspace. Everything from here to a PRD happens on this page." },
    { do: "point", target: "prd-stages", say: `${stages.length} stages, in order. The ones marked optional research can be skipped; the rest each end in something the PRD needs.` },
  ];
  stages.forEach((st, i) => {
    const last = i === stages.length - 1;
    steps.push({
      do: "point",
      target: "prd-draft",
      say: `Stage ${i + 1}, ${st.name.toLowerCase()}. FlowCode drafts it for you; read what it wrote and change anything that is not right.${st.optional ? " This one is optional - skip it if you already know the answer." : ""}`,
      missing: `Stage ${i + 1}, ${st.name.toLowerCase()}, has nothing to draft: fill it in yourself and carry on.`,
    });
    if (!last) {
      steps.push({
        do: "wait",
        target: "prd-continue",
        until: `prd-on-${stages[i + 1].id}`,
        say: `When this stage reads right, press Continue. I will wait here and pick up on ${stages[i + 1].name.toLowerCase()}.`,
      });
    }
  });
  steps.push({ do: "confirm", target: "prd-prototype", say: "Last stage. Start a prototype opens New build with the PRD attached. That button is yours." });
  return { id: "prd-stages", title: "Walk through the research stages", steps };
}

/** The research project's stages, read from the workspace on screen: its real ones, not a guessed six. */
export function stagesOnPage(): Array<{ id: string; name: string; optional?: boolean }> {
  return [...document.querySelectorAll<HTMLElement>('[data-cp="prd-stages"] [data-stage]')].map((el) => ({
    id: el.dataset.stage!,
    name: (el.querySelector(".disc-step__name")?.textContent ?? el.dataset.stage!).replace(/Optional research$/, "").trim(),
    optional: el.dataset.optional === "true",
  }));
}

export function switchModelJourney(role = "coder"): Journey {
  return {
    title: `Change the ${role}'s model`,
    steps: [
      { do: "go", path: "/system/models", say: "Models are set per agent on System Health → Models & capability lab." },
      { do: "confirm", target: `model-${role}`, say: `Pick the ${role}'s model from this list. It changes as soon as you choose one, so choose it yourself. The Coder only accepts models that passed the capability lab.` },
    ],
  };
}

export function phoneJourney(): Journey {
  return {
    title: "Set up FlowCode on your phone",
    steps: [
      { do: "go", path: "/settings/phone", say: "Phone set-up lives in Settings → Phone." },
      { do: "point", target: "phone-enable", say: "First, allow your phone to follow FlowCode. Tick this yourself." },
      { do: "confirm", target: "phone-https", say: "For notifications with the app closed, press Use HTTPS with Tailscale. The QR code then switches to the secure link; scan it and add the page to your Home Screen." },
    ],
  };
}

export function whyStoppedJourney(projectId: string, projectName: string, runId?: string): Journey {
  return {
    title: "Find out why a build stopped",
    steps: [
      { do: "go", path: runId ? `/projects/${projectId}/runs/${runId}` : `/projects/${projectId}`, say: `Open ${projectName}'s latest build in the builder.` },
      { do: "event", name: "fc:show-overview", say: "The Overview says where the build stands and what's waiting on you." },
      { do: "click", target: "troubleshoot", say: "Troubleshoot run explains why it stopped, in plain words, and offers fixes." },
      { do: "point", target: "troubleshoot", say: "Read the explanation below. Any fix it offers, such as Retry with this fix, is yours to press." },
    ],
  };
}

export interface JourneyMatch {
  journey: Journey;
  summary: string;
}

/** Picks a journey from a question, or none. */
export function matchJourney(q: string, project?: { id: string; name: string; runId?: string }): JourneyMatch | undefined {
  const t = q.toLowerCase();
  const quoted = /["“]([^"”]{3,400})["”]/.exec(q)?.[1]?.trim();
  const urlIn = /(https?:\/\/[^\s"']+|\b[a-z0-9-]+\.(?:com|io|dev|app|org|net|co)(?:\/[^\s"']*)?)/i.exec(q)?.[1];
  const fullUrl = urlIn && !/^https?:/i.test(urlIn) ? `https://${urlIn}` : urlIn;
  if (/\b(style|look|design|theme)\b/.test(t) && /\b(new build|new project|new prototype|start(ing)? a build|when (i )?build|during|in a new|before (the )?build)\b/.test(t)) {
    return { journey: { ...newBuildStyleJourney(fullUrl, quoted), id: "style-new-build" }, summary: `I'll open New build and take you to Look and feel${fullUrl ? `, with ${fullUrl} filled in` : ""}. You go on from there; nothing is built until you press Build the prototype.` };
  }
  // "How do I build from my PRD?" / "attach a PRD" → New build's spec files (not Create PRD, not the builder chat).
  if (/\b(prd|spec|requirements? (doc|document|file))\b/.test(t) && /\b(attach|upload|add|use|have|build|start|prototype|from)\b/.test(t) && !/\b(create|write|draft|make|research|template)s?\b.*\bprd\b/.test(t)) {
    return { journey: { ...prdBuildJourney(), id: "prd-build" }, summary: "A PRD goes into New build: start a prototype, then add the .md file in step 1. I'll show you where." };
  }
  // "I want to solve the problem of keeping track of my calories" → Create PRD with that problem.
  const problem = /\b(?:solve|fix|tackle|address)\b\s+(?:the\s+)?(?:problem\s+(?:of|with|that)\s+)?(.{6,400})$/i.exec(q)?.[1]?.replace(/[.?!]+$/, "").trim();
  if (problem && !/\b(build|bug|error|stopped|failed|check)\b/i.test(problem)) {
    const text = quoted ?? problem.charAt(0).toUpperCase() + problem.slice(1);
    return { journey: { ...createPrdJourney(text), id: "create-prd" }, summary: `Let's start from the problem. I'll open Create PRD and write it in: "${text}". You press Start; FlowCode then researches it with you and drafts the PRD.` };
  }
  // "I want to build an app that …" → New build with that description.
  const idea = /\b(?:i want to|i'd like to|help me|let's|lets)\s+(?:build|make|create)\s+(?:a|an|the)?\s*(.{6,400})$/i.exec(q)?.[1]?.replace(/[.?!]+$/, "").trim();
  if (idea && !/\b(prd|skill|prompt|topic|note|decision|idea)\b/i.test(idea)) {
    const text = quoted ?? idea.charAt(0).toUpperCase() + idea.slice(1);
    return { journey: { ...newBuildJourney(text), id: "new-build" }, summary: `I'll open New build and describe it for you: "${text}". You go through the steps; nothing is built until you press Build the prototype.` };
  }
  if (/\b(new|start|create|make|begin)\b.*\b(build|prototype|app|project)\b/.test(t) && !/\bprd\b/.test(t)) {
    return { journey: { ...newBuildJourney(quoted), id: "new-build" }, summary: `I'll open New build${quoted ? " and describe it for you" : ""}. You go through the steps; nothing is built until you press Build the prototype.` };
  }
  if (/\b(create|write|make|start|new)\b.*\b(prd|requirements|product requirements)\b|\bsolve something\b/.test(t)) {
    return { journey: { ...createPrdJourney(quoted), id: "create-prd" }, summary: `I'll open Create PRD${quoted ? " and write the problem in" : ""}. You press Start.` };
  }
  if (/\b(change|switch|swap|use|set|pick)\b.*\b(model)\b/.test(t)) {
    const role = ROLE_WORDS.find(([re]) => re.test(t))?.[1] ?? "coder";
    return { journey: switchModelJourney(role), summary: `I'll show you where the ${role}'s model is set. You pick the model yourself.` };
  }
  if (/\b(phone|mobile|notification|pwa|home screen)\b/.test(t)) {
    return { journey: phoneJourney(), summary: "I'll take you to Phone set-up and point at each part. You tick and press the buttons." };
  }
  if (project && /\b(why|what)\b.*\b(stop|stopped|stuck|fail|failed|blocked|broke|help)\b|\btroubleshoot\b/.test(t)) {
    return { journey: whyStoppedJourney(project.id, project.name, project.runId), summary: `I'll open ${project.name}'s latest build and open Troubleshoot run for you.` };
  }
  for (const c of CATALOG) {
    if (!c.match.test(t)) continue;
    if (c.project && !project) continue;
    return { journey: c.build({ project }), summary: `I'll show you how to ${c.label.charAt(0).toLowerCase() + c.label.slice(1)} in the app. Anything final is yours to press.` };
  }
  if (!project) return undefined;
  if (/(capture|copy|take|grab|steal|use)\b.*\b(style|look|design|theme)|\bstyle (from|of|like)\b/.test(t)) {
    const url = /(https?:\/\/[^\s"']+|\b[a-z0-9-]+\.(?:com|io|dev|app|org|net|co)(?:\/[^\s"']*)?)/i.exec(q)?.[1];
    const full = url && !/^https?:/i.test(url) ? `https://${url}` : url;
    return { journey: captureStyleJourney(project.id, project.name, full), summary: `I'll show you where Capture a style is in ${project.name}${full ? ` and fill in ${full}` : ""}. You press Capture yourself.` };
  }
  if (/\b(add|suggest|save|new)\b.*\b(idea|suggestion|feature request)\b/.test(t)) {
    const title = quoted ?? /\bidea[:\-–]\s*(.{3,200})$/i.exec(q)?.[1];
    return { journey: addIdeaJourney(project.id, project.name, title?.trim()), summary: `I'll take you to ${project.name}'s Suggestions${title ? " and write your idea in" : ""}. You choose Save for later or Build this now.` };
  }
  return undefined;
}

/** An answer's "Show me" steps (catalog anchors) as a cursor journey: go to the page, open the tab, point at the part. */
export function stepsJourney(steps: Array<{ anchor: string; text: string }>, resolve: (anchor: string) => { route?: string; tab?: string; anchor?: string; missing?: string; reveal?: string }, from = 0): Journey {
  const out: Step[] = [];
  for (const s of steps.slice(from)) {
    if (/copilot/i.test(s.anchor)) continue;
    const t = resolve(s.anchor);
    const say = s.text.replace(/^\s*(?:step\s*)?\d+\s*[.):-]\s*/i, "");
    const parts: Step[] = [];
    if (t.route) parts.push({ do: "go", path: t.route, say });
    if (t.tab) parts.push({ do: "tab", tab: t.tab, say });
    if (t.reveal) parts.push({ do: "event", name: t.reveal, say });
    if (t.anchor) parts.push({ do: "point", target: t.anchor, say, ...(t.missing ? { missing: t.missing } : {}) });
    // One visible step per answer step: the last part carries the words, earlier parts say where it's going.
    parts.forEach((p, k) => out.push(k < parts.length - 1 ? { ...p, say: "Going there…", auto: true } : p));
  }
  return { title: "Find it in the app", steps: out.length ? out : [{ do: "go", path: "/", say: "That isn't something I can point to on screen." }] };
}

/** What a catalog journey needs: the project on screen (or the latest), and the build on screen. */
export interface JourneyCtx {
  project?: { id: string; name: string; runId?: string };
}

const go = (path: string, say: string): Step => ({ do: "go", path, say, auto: true });
const tab = (t: string, say: string): Step => ({ do: "tab", tab: t, say });
const point = (target: string, say: string): Step => ({ do: "point", target, say });
const yours = (target: string, say: string, missing?: string): Step => ({ do: "confirm", target, say, ...(missing ? { missing } : {}) });
const needsProject = (ctx: JourneyCtx) => ctx.project;

/** Everyday journeys, in the order they're offered. `match` is tried in order after the journeys that take details. */
export const CATALOG: Array<{ id: string; group: string; label: string; match: RegExp; project?: boolean; build: (ctx: JourneyCtx) => Journey }> = [
  // Building
  { id: "new-build", group: "Build", label: "Start a new build", match: /^$/, build: () => newBuildJourney() },
  { id: "style-new-build", group: "Build", label: "Capture a style in a new build", match: /^$/, build: () => newBuildStyleJourney() },
  { id: "create-prd", group: "Build", label: "Create a PRD from a problem", match: /^$/, build: () => createPrdJourney() },
  { id: "prd-stages", group: "Build", label: "Walk me through the research stages", match: /\b(stages?|walk me through|step by step|what do i do (on|at) (each|this) stage|finish (the|my) (research|prd))\b/, build: () => {
    const stages = stagesOnPage();
    const id = /^#?\/discover\/([^/?]+)/.exec(location.hash.replace(/^#/, "") || location.pathname)?.[1];
    // Off the workspace, or before it has drawn, there is nothing to walk: say so instead of pointing at nothing.
    return id && stages.length ? prdStagesJourney(id, stages) : { title: "Walk through the research stages", steps: [go("/discover", "Open a piece of research first - or start one - and ask me again from inside it.")] };
  } },
  { id: "open-folder", group: "Build", label: "Open an existing project folder", match: /\b(open|import|add|use)\b.*\b(existing|folder|repo|repository|code ?base)\b/, build: () => ({ title: "Open an existing project folder", steps: [go("/", "This starts from the Dashboard."), yours("open-folder", "Open an existing repository picks a folder on this computer and makes it a FlowCode project. Choose the folder yourself.", "Opening a folder works in the FlowCode desktop app, where it can show your computer's folder picker. In the browser, start a new build instead.")] }) },
  { id: "change", group: "Build", label: "Ask for a change to my app", project: true, match: /\b(change|edit|update|tweak|modify|fix)\b.*\b(my app|the app|prototype|screen|page|button|header|colou?r|text)\b|\bask for a change\b|\bfollow.?up\b/, build: (c) => ({ title: "Ask for a change", steps: [go(`/projects/${c.project!.id}`, `Open ${c.project!.name} in the builder.`), { do: "click", target: "ws-mode-chat", say: "Changes are asked for in the builder's Chat." }, point("chat-input", "Describe the change in your own words, e.g. \"make the header blue and the headings larger\". Tick Styling only for purely visual changes."), yours("chat-send", "Press Send when it's right. FlowCode plans only the difference, builds it and checks it.")] }) },
  { id: "preview", group: "Build", label: "Preview and try my app", project: true, match: /\b(preview|try|see|test|open|run)\b.*\b(my app|the app|prototype|it live)\b/, build: (c) => ({ title: "Preview your app", steps: [go(`/projects/${c.project!.id}`, `Open ${c.project!.name} in the builder.`), tab("preview", "The Preview tab runs your app live. Click around it like a user would; try a narrow window too.")] }) },
  { id: "undo", group: "Build", label: "Undo a change", project: true, match: /(undo|roll ?back|revert|go back|reverse)/, build: (c) => ({ title: "Undo a change", steps: [go(`/projects/${c.project!.id}`, `Open ${c.project!.name} in the builder.`), { do: "event", name: "fc:show-overview", say: "The Overview lists every step the build made; finished steps are folded to one line." }, { do: "click", target: "step-fold-changed", say: "This opens the latest finished step that changed files, to show what it changed.", missing: "No finished step has changed files yet, so there's nothing to undo." }, yours("rollback", "Roll back undoes everything that step changed. It asks you to confirm; the choice is yours. To undo an earlier step, open it the same way.", "Roll back appears once the build has stopped. While it's working, pause it first (the pause button at the bottom right).")] }) },
  { id: "design", group: "Design", label: "Change colors, fonts or corners", project: true, match: /(colou?rs?|fonts?|typography|corners?|radius|tokens?|theme|palette|spacing)/, build: (c) => ({ title: "Change the design", steps: [go(`/projects/${c.project!.id}`, `Open ${c.project!.name} in the builder.`), tab("styles", "The Design tab holds the app's look."), point("design-views", "Design shows the app's colors, type, shape and components; Tokens lists every value; Surface sets the card style; Extras adds features like a dark mode switch."), { do: "click", target: "configure-type", say: "Configure on Typography opens the font editor. Colors and Shape & style have the same button." }, point("typo-fonts", "Pick the heading, body and code fonts. These are the fonts FlowCode bundles, so the app shows them with no internet. The preview on the right changes as you pick; below are the sizes and weights for each level."), yours("typo-save", "Save typography applies it to the app, and you can undo it. Cancel leaves everything as it was.")] }) },
  { id: "extras", group: "Design", label: "Add a dark mode switch or animations", project: true, match: /(extras?|dark mode switch|theme toggle|animations?|transitions?|skeleton|toasts?|empty states?|sticky header|keyboard shortcuts|install as an app|pwa)/, build: (c) => ({ title: "Add extras to your app", steps: [go(`/projects/${c.project!.id}`, `Open ${c.project!.name} in the builder.`), tab("styles", "Extras live in the Design tab."), { do: "click", target: "design-view-extras", say: "The Extras tab has the same options as New build." }, point("extras-list", "Tick what you'd like: micro-animations, page transitions, a light and dark switch, toasts and more. Ones this app already asked for are marked."), yours("extras-add", "Add writes the change into the chat. Read it, then press Send yourself.")] }) },
  // Decisions and ideas
  { id: "approve", group: "Decisions", label: "Approve what's waiting on me", match: /\b(approve|approval|allow|waiting (on|for) me|needs? my (ok|approval))\b/, build: () => ({ title: "Approve what's waiting", steps: [go("/approvals", "Everything waiting on you is on Approvals."), tab("waiting", "Waiting on you lists what holds up a build, oldest first."), yours("approval-allow", "Read the exact action, then Allow once or Deny. Those buttons are yours.", "Nothing is waiting on you right now, so there's nothing to approve.")] }) },
  { id: "build-idea", group: "Decisions", label: "Build one of the suggested ideas", project: true, match: /\b(build|try|use|start)\b.*\b(ideas?|suggestions?)\b/, build: (c) => ({ title: "Build a suggested idea", steps: [go(`/quality/${c.project!.id}/ideas`, `${c.project!.name}'s ideas are on its Suggestions tab.`), yours("idea-build", "Build this now starts a follow-up change. Save for later keeps it on the list. Your call.", "There are no ideas for this project right now.")] }) },
  { id: "decision-log", group: "Decisions", label: "See past decisions", match: /\b(decision log|past decisions|history of (approvals|decisions)|what did i approve)\b/, build: () => ({ title: "See past decisions", steps: [go("/approvals", "Decisions are recorded on Approvals."), tab("log", "The Decision log shows each day's decisions on a calendar, today first.")] }) },
  // Project pages
  { id: "plan", group: "Project", label: "See the prototype plan", project: true, match: /\b(prototype plan|the plan|what will it build|steps planned)\b/, build: (c) => ({ title: "See the prototype plan", steps: [go(`/quality/${c.project!.id}/plan`, "The Prototype plan lists every step, the requirements it covers and the tests that prove it.")] }) },
  { id: "launch", group: "Project", label: "Get the launch readiness checklist", project: true, match: /(launch|real app|production|go live|hand ?off|checklist)/, build: (c) => ({ title: "Get the launch readiness checklist", steps: [go(`/quality/${c.project!.id}/launch`, "Launch readiness lists what the real app still needs: backend, data, accounts, security and more."), point("real-app", "What the real app needs explains the move from prototype to a real product."), point("launch-items", "Each item is one thing to build. Open it to see why it matters and a ready prompt for a coding agent; tick it off when it's done."), yours("launch-download", "Download .md saves the whole checklist with every prompt, to hand to a developer or a coding agent.")] }) },
  { id: "reports", group: "Project", label: "See run reports", project: true, match: /\b(run reports?|build reports?|what happened in (the|my) builds?)\b/, build: (c) => ({ title: "See run reports", steps: [go(`/quality/${c.project!.id}/reports`, "Run reports show each build's checks, timing and what went wrong, newest first.")] }) },
  { id: "rename", group: "Project", label: "Rename or delete a project", match: /(rename|delete|remove).*project/, build: () => ({ title: "Rename or delete a project", steps: [go("/quality", "All your projects are on My Projects."), { do: "click", target: "project-menu", say: "Each card's ⋯ menu holds the project's actions. This opens the first one; use the same button on the card you mean." }, point("project-rename", "Rename changes the project's name everywhere. Its files and history stay as they are."), yours("project-delete", "Delete project asks you to confirm and says exactly what goes. The choice is yours.")] }) },
  { id: "flowreport", group: "Project", label: "Analyze a code repository", match: /(flowreport|repo report|analy[sz]e|health check|audit).*(repo|repository|code|project)?/, build: () => ({ title: "Analyze a repository", steps: [go("/flowreport", "Repo Report reads a code repository and reports its health in fifteen sections, from error handling to security."), { do: "click", target: "fr-new", say: "New report opens a folder picker." }, point("folder-list", "Go into the folder that holds the code. Folders with a manifest (package.json and the like) are marked. FlowCode only reads it: nothing is run or installed."), yours("folder-choose", "Choose the folder yourself; the report starts and shows its progress here.")] }) },
  // Settings
  { id: "about-you", group: "Settings", label: "Tell the Copilot about you", match: /\babout (me|you)\b|\b(my|your) (name|picture|photo|avatar|profile)\b|\bcall me\b|\bpersonali[sz]e\b|\b(know|learn|remember)\b.*\babout me\b/, build: () => ({ title: "Tell the Copilot about you", steps: [
    go("/settings/copilot", "Copilot · About you is where you tell the Copilot who you are, so its answers fit you. It stays on this computer."),
    point("about-picture", "Add a picture of yourself if you like. You choose the file."),
    point("about-name", "Type what the Copilot should call you, then Save. Leave it empty and it won't use a name."),
    point("about-starters", "Not sure what to write? Pick a question: who you are, what you want to achieve, what you're working on, how answers should be written."),
    point("about-note", "Write a short note, one idea each, e.g. \"I'm a product designer building tools for small businesses.\" The Copilot reads the notes that matter for each question."),
    yours("about-note-add", "Add the note yourself. You can edit or delete any note later."),
  ] }) },
  { id: "autonomy", group: "Settings", label: "Change how hands-on FlowCode is", match: /\b(autonomy|hands.?on|supervised|assisted|autonomous|ask me (before|less|more))\b/, build: () => ({ title: "Change how hands-on FlowCode is", steps: [go("/settings/policy", "How hands-on FlowCode is lives in Settings → Project policy."), point("settings.autonomy", "Supervised asks before every step; Assisted runs routine steps and asks when it matters; Autonomous only stops for risky actions. Pick yours.")] }) },
  { id: "page-appearance", group: "Settings", label: "Set light or dark for one page", match: /\b(light|dark)\b.*\b(one|a|this|single|particular|specific|each)\b.*\bpage\b|\bper page\b/, build: () => ({ title: "Set light or dark for one page", steps: [go("/settings/appearance", "Appearance can be set per page."), { do: "wait", target: "appear-mode-custom", until: "appear-pages", say: "Choose Custom per page. It changes as soon as you pick it, so pick it yourself; I'll carry on." }, point("appear-pages", "Then set Light or Dark for any page in this list. Pages you leave alone use your last toggle choice.")] }) },
  { id: "appearance", group: "Settings", label: "Switch light or dark mode", match: /\b(dark|light) mode\b|\bappearance\b|\btheme\b/, build: () => ({ title: "Switch light or dark", steps: [go("/settings/appearance", "Settings → Appearance: a toggle, follow your computer, or choose per page.")] }) },
  { id: "explain", group: "Settings", label: "Plain language or technical details", match: /\b(plain language|technical details|less technical|more technical|explanations?)\b/, build: () => ({ title: "Choose plain or technical explanations", steps: [go("/settings/explain", "Settings → Explanations chooses plain language or technical details everywhere.")] }) },
  { id: "prd-templates", group: "Settings", label: "Fill in a PRD template", match: /\bprd templates?\b|\btemplate for (a|my) prd\b/, build: () => ({ title: "Fill in a PRD template", steps: [go("/settings/prd", "PRD templates are in Settings."), point("prdt-kinds", "Pick the kind of project. There are 10 ready-made templates; you fill one in, you don't create new ones. Your draft for each kind stays in this browser."), yours("prdt-build", "Replace the [placeholders], then copy it, download it as .md, or press Start a prototype with it to open New build with it attached.")] }) },
  { id: "mcp", group: "Settings", label: "Connect a tool server (MCP)", match: /\b(mcps?|tool servers?|connect\w* (a |an )?(tool|server|mcp)|figma|github|playwright|context7)\b/, build: () => ({ title: "Connect a tool server", steps: [go("/library?tab=servers", "Extra tools for the agents come from connected servers."), tab("servers", "Connected servers lists them; each can be switched on for the roles you pick."), yours("mcp-add", "Add server opens a form here. Fill it in and save it yourself.")] }) },
  { id: "skills", group: "Settings", label: "Review skills FlowCode proposed", match: /\b(proposed|review\w*|suggested|drafted)\b.*\bskills?\b|\bskills? (flowcode )?(proposed|proposals?|drafted)\b|\bproposed by flowcode\b/, build: () => ({ title: "Review proposed skills", steps: [go("/library?tab=proposals", "FlowCode drafts skills from failures that keep happening."), tab("proposals", "Each one shows what kept going wrong and the skill drafted for it. Turning one on is your call.")] }) },
  { id: "knowledge", group: "Settings", label: "Search the knowledge hub", match: /\b(knowledge|documents?|research notes?|sources?)\b/, build: () => ({ title: "Search the knowledge hub", steps: [go("/knowledge", "The Knowledge Hub keeps documents and research the agents can use."), point("knowledge.search", "Search everything here.")] }) },
  // Intelligence: models, skills, prompts, topics, knowledge, branding
  { id: "cloud-model", group: "Intelligence", label: "Add a cloud AI model", match: /\b(cloud|hosted|openai|anthropic|claude|gpt|gemini|api key)\b.*\b(model|llm|ai|provider)?|\b(add|connect|use)\b.*\bcloud\b/, build: () => ({ title: "Add a cloud AI model", steps: [go("/system/models", "Cloud models are set up on System Health → Models & capability lab."), point("models.cloud", "Choose the provider here, then paste your API key and pick the model. Type the key yourself: I never handle keys. The project also has to allow hosted models before any code leaves this computer.")] }) },
  { id: "new-skill", group: "Intelligence", label: "Create a skill", match: /\b(creat\w*|new|add\w*|writ\w*|mak\w*|record\w*|sav\w*|keep\w*|log\w*|start\w*|follow\w*|track\w*)\b.*\bskills?\b/, build: () => ({ title: "Create a skill", steps: [go("/library?tab=skills", "Skills are reusable instructions the agents follow."), tab("skills", "The Skills tab lists every skill, built-in and yours."), { do: "click", target: "lib-new-skill", say: "New skill opens the editor." }, point("skill-name", "Give it a short name, like responsive-tables, and one line on what it achieves. Then write the steps and pick which agents use it."), yours("skill-save", "Create skill saves it. That button is yours.")] }) },
  { id: "new-prompt", group: "Intelligence", label: "Create a prompt", match: /\b(creat\w*|new|add\w*|writ\w*|mak\w*|record\w*|sav\w*|keep\w*|log\w*|start\w*|follow\w*|track\w*)\b.*\bprompts?\b/, build: () => ({ title: "Create a prompt", steps: [go("/library?tab=prompts", "Prompts are what each agent is told."), tab("prompts", "The Prompts tab lists them, versioned."), { do: "click", target: "lib-new-prompt", say: "New prompt opens the editor. You can also import a .md file." }, point("prompt-title", "Give it a title and one line on what it's for, pick the agents that use it, then write what they're told."), yours("prompt-save", "Save it yourself. It starts at version 1.0.0.")] }) },
  { id: "branding", group: "Intelligence", label: "Adjust FlowCode's branding", match: /\b(branding|brand|logo|flowcode('s)? (look|design|style)|design system|components? library)\b/, build: () => ({ title: "Adjust FlowCode's branding", steps: [go("/primitives", "Branding shows FlowCode's own building blocks: logo, buttons, colors, type and more."), point("brand-suggest", "Pick a component in the list on the left, then write the change you want under it, e.g. \"make the primary button rounder\". Each component has its own box."), yours("brand-suggest-add", "Add suggestion records it for that component. Suggestions are applied after review, not straight away.")] }) },
  { id: "research-desk", group: "Intelligence", label: "Set up the Research desk", match: /\bresearch desk\b|\b(set ?up|start|use|run|do|ask)\b.*\b(research|web research|search the web)\b(?!.*\btopic)/, build: (c) => ({ title: "Set up the Research desk", steps: [
    go("/settings/search", "The Research desk searches the web for you. First, where its searches go: Settings → Web search."),
    point("search-url", "Your SearXNG address goes here. It's a private search engine you run yourself; without it, FlowCode falls back to Wikipedia. Change it only if you run SearXNG somewhere else, then save it yourself."),
    go("/settings/policy", "Next, permission: research sends search queries off this computer, so each project has to allow it."),
    { do: "point", target: "policy-research", pause: true, say: "Tick Allow external research if you want the Research desk to run without asking each time (leave it off and it asks you every time). Save it yourself, then press Next and I'll take you to the desk.", missing: "This is set per project; you can also change it in a project's settings." },
    go(`/knowledge${c.project ? `?projectId=${c.project.id}` : ""}`, "The Research desk is in the Knowledge Hub."),
    point("knowledge-project", c.project ? `Research is saved to a project's shelves; ${c.project.name} is picked. Change it here if you want another.` : "Research is saved to a project's shelves: pick the project here."),
    tab("research", "The Research desk tab."),
    point("research-question", "Ask a research question, e.g. \"What do people with food allergies look for when shopping?\""),
    yours("research-plan", "Press Plan. FlowCode plans the searches first; only the planned queries leave this machine, and only after you approve them with Allow once."),
  ] }) },
  { id: "new-topic", group: "Intelligence", label: "Add a research topic", match: /\b(creat\w*|new|add\w*|writ\w*|mak\w*|record\w*|sav\w*|keep\w*|log\w*|start\w*|follow\w*|track\w*)\b.*\btopics?\b|\bresearch topic\b/, build: () => ({ title: "Add a research topic", steps: [go("/topics", "Topic Search follows a subject across the web for you."), { do: "click", target: "topic-new", say: "New topic opens the form." }, point("topic-q", "Type the subject to follow, e.g. local AI coding agents."), yours("topic-create", "Create topic starts it. That button is yours.")] }) },
  { id: "note", group: "Intelligence", label: "Write a decision or note", match: /\b(creat\w*|new|add\w*|writ\w*|mak\w*|record\w*|sav\w*|keep\w*|log\w*|start\w*|follow\w*|track\w*)\b.*\b(decisions?|notes?|glossary|snippet)\b/, build: () => ({ title: "Write a decision or note", steps: [go("/knowledge", "Decisions and notes are kept in the Knowledge Hub."), tab("note", "Write a note records a decision, note, snippet or glossary term."), point("note-kind", "Choose what it is: a decision, note, snippet or glossary term."), point("note-content", "Give it a title, then write it. For a decision, say what was decided and why."), yours("note-save", "Save it yourself. The agents can use it in later builds.")] }) },
  // Health
  { id: "stuck", group: "Health", label: "See where agents got stuck", match: /\bstuck steps?\b|\b(agents?|steps?|it|they)\b.*\b(get|got|getting|gets)? ?stuck\b/, build: () => ({ title: "See stuck steps", steps: [go("/system/stuck", "Stuck steps shows where FlowCode's agents got stuck, by day.")] }) },
  { id: "model-problems", group: "Health", label: "See model problems and fixes", match: /\b(model problems?|time.?outs?|timing out|time out|out of memory|out of credit|crash(es|ed)?)\b/, build: () => ({ title: "See model problems", steps: [go("/system/problems", "Model problems lists what keeps failing in the models or this computer, what it means and what to do. The Researcher looks into one a day.")] }) },
  { id: "health", group: "Health", label: "Check FlowCode is running", match: /\b(health|is (it|flowcode) (running|working|up)|restart|daemon|engine)\b/, build: () => ({ title: "Check FlowCode's health", steps: [go("/system/health", "System Health shows whether FlowCode's engine and connections are running."), point("system.controls", "Pause, stop and restart are here. Those buttons are yours to press.")] }) },
];

/**
 * Four other journeys to offer after one ends: two from the same area as the one just done (its group), two from
 * elsewhere, skipping the one just done and any offered recently, so each time shows something new.
 */
/**
 * What comes next, once a stage is done. The spine is the build itself - a problem becomes a PRD, a PRD becomes a
 * build, a build waits on your decisions, then you try it, then you change it or ship it - and the rest are on-ramps
 * that join it. Without this a journey ended on its last button and offered four unrelated things, which told you
 * what else the Copilot could do and nothing about what you were in the middle of.
 *
 * `why` is said in the chat, so the next step reads as the next step and not as another suggestion.
 */
export const NEXT_IN_BUILD: Record<string, { id: string; why: string; /** Where to go instead when nothing is waiting on you, so the chain never sends you to an empty page. */ ifNothingWaiting?: { id: string; why: string } }> = {
  // The spine.
  "create-prd": { id: "prd-stages", why: "Starting it is one button; the PRD comes out of the six stages after it." },
  "prd-stages": { id: "new-build", why: "A finished PRD is what a build starts from." },
  "new-build": { id: "approve", why: "A build stops for your decisions; that is where it will wait for you.", ifNothingWaiting: { id: "preview", why: "Nothing is waiting on you, so go and see what it has built so far." } },
  approve: { id: "preview", why: "Once it is past your decisions, see what it actually built." },
  preview: { id: "change", why: "Anything you want different, ask for it here." },
  change: { id: "preview", why: "Try the change once it has been built and checked." },
  // On-ramps that join the spine.
  "prd-build": { id: "approve", why: "The build stops for your decisions once it is under way.", ifNothingWaiting: { id: "preview", why: "Nothing is waiting on you, so go and see what it has built so far." } },
  "style-new-build": { id: "approve", why: "The build stops for your decisions once it is under way.", ifNothingWaiting: { id: "preview", why: "Nothing is waiting on you, so go and see what it has built so far." } },
  "open-folder": { id: "flowreport", why: "A folder you have just opened is worth reading before you change it." },
  flowreport: { id: "new-build", why: "With the report read, a build can start from what it found." },
  "build-idea": { id: "preview", why: "See the idea in the app once it is built." },
  undo: { id: "preview", why: "Check the app is back where you wanted it." },
  plan: { id: "approve", why: "The plan runs as far as its first decision, which is yours.", ifNothingWaiting: { id: "reports", why: "Nothing is waiting on you, so look at how the steps actually went." } },
  reports: { id: "launch", why: "The checks passing is what launch readiness is measured against." },
};

/**
 * The next stage after `id`, as a catalog entry plus the reason to go there now.
 *
 * `waiting` is how many decisions are actually waiting on you. Without it the chain pointed at Approvals whether or
 * not there was anything there, which is worse than saying nothing: it sends you to an empty page and calls it the
 * next step. A stage that needs a project is dropped when there is no project open rather than offered and refused.
 */
export function nextInBuild(id?: string, state?: { waiting?: number; hasProject?: boolean }): { entry: (typeof CATALOG)[number]; why: string } | undefined {
  const link = id ? NEXT_IN_BUILD[id] : undefined;
  if (!link) return undefined;
  const target = link.ifNothingWaiting && state?.waiting === 0 ? link.ifNothingWaiting : link;
  const entry = CATALOG.find((c) => c.id === target.id);
  if (!entry) return undefined;
  if (entry.project && state?.hasProject === false) return undefined;
  return { entry, why: target.why };
}

export function moreJourneys(doneTitle: string, recent: string[] = [], doneId?: string): string[] {
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z ]/g, "");
  const done = CATALOG.find((c) => c.id === doneId) ?? CATALOG.find((c) => norm(c.label) === norm(doneTitle) || norm(doneTitle).includes(norm(c.label)) || norm(c.label).includes(norm(doneTitle)));
  const pool = CATALOG.filter((c) => c !== done);
  const fresh = (list: typeof CATALOG) => [...list.filter((c) => !recent.includes(c.id)), ...list.filter((c) => recent.includes(c.id))];
  const same = fresh(pool.filter((c) => done && c.group === done.group)).slice(0, 2);
  const others = fresh(pool.filter((c) => !same.includes(c) && (!done || c.group !== done.group)));
  // Spread "others" across groups rather than taking four from one.
  const picked: typeof CATALOG = [...same];
  const seenGroups = new Set<string>();
  for (const c of others) {
    if (picked.length >= 4) break;
    if (seenGroups.has(c.group)) continue;
    seenGroups.add(c.group);
    picked.push(c);
  }
  for (const c of others) if (picked.length < 4 && !picked.includes(c)) picked.push(c);
  return picked.slice(0, 4).map((c) => c.id);
}

for (const c of CATALOG) {
  const build = c.build;
  c.build = (ctx) => ({ ...build(ctx), id: c.id });
}


/** Forms the Copilot can write a first draft for, from the person's own idea. */
export type DraftKind = "build" | "prd" | "about" | "skill" | "prompt" | "note" | "topic";
export const DRAFT_LABEL: Record<DraftKind, string> = { build: "app description", prd: "problem for your PRD", about: "note about you", skill: "skill", prompt: "prompt", note: "note", topic: "research topic" };

/**
 * "Help me write a skill for responsive tables" → { kind: "skill", idea: "responsive tables" }. Only asks to *write* or
 * *draft* count; "how do I create a skill" is still the plain walkthrough.
 */
export function matchDraft(q: string): { kind: DraftKind; idea: string } | undefined {
  const t = q.toLowerCase();
  if (!/\b(help me (write|draft|fill|create|make|come up with)|(write|draft) (me )?(a|an|my|the)|fill (in|out) (a|an|my|the)|enter (a|an|my|the))\b/.test(t)) return undefined;
  const kind: DraftKind | undefined = /\bskills?\b/.test(t)
    ? "skill"
    : /\bprompts?\b/.test(t)
      ? "prompt"
      : /\babout (me|you|section|statement|page)\b|\bbio\b|\bintroduc/.test(t)
        ? "about"
        : /\bprd\b|\bproblem\b|\brequirements\b/.test(t)
          ? "prd"
          : /\b(note|decision|glossary)\b/.test(t)
            ? "note"
            : /\b(research )?topic\b/.test(t)
              ? "topic"
              : /\b(app|prototype|build|description|website|site|tool|dashboard)\b/.test(t)
                ? "build"
                : undefined;
  if (!kind) return undefined;
  // The idea: what follows ":" or "for/about/that/to", else the whole message.
  const idea = (/:\s*(.+)$/s.exec(q)?.[1] ?? /\b(?:for|about|that|to|on|where|which)\b\s+(.{4,})$/is.exec(q)?.[1] ?? "").trim();
  return { kind, idea: idea.length >= 6 ? idea : "" };
}

const REVIEW = "That's my first draft. Read it and change anything right in the form. Press Next when you're happy with it.";
const draftType = (target: string, text: string, what: string): Step => ({ do: "type", target, text, pause: true, say: `I've written ${what}. ${REVIEW}` });

/** A walkthrough that types the Copilot's draft into the real form, stopping after each part for you to review. */
export function draftJourney(kind: DraftKind, f: Record<string, string>): Journey {
  switch (kind) {
    case "build":
      return { title: "Draft your app description", steps: [go("/", "New builds start from the Dashboard."), { do: "event", name: "fc:new-build", say: "This opens New build." }, draftType("nb-desc", f.description ?? "", "a description of your app"), yours("nb-next", "Go through the rest with Next. Nothing is built until you press Build the prototype.")] };
    case "prd":
      return { ...createPrdJourney(), title: "Draft the problem for your PRD", steps: createPrdJourney().steps.map((s) => (s.do === "point" && s.target === "prd-problem" ? draftType("prd-problem", f.problem ?? "", "the problem") : s)) };
    case "about":
      return { title: "Draft a note about you", steps: [go("/settings/copilot", "About you is where the Copilot learns who you are. It stays on this computer."), draftType("about-note", f.note ?? "", "a note about you"), yours("about-note-add", "Add the note yourself. You can edit or delete it later.")] };
    case "skill":
      return { title: "Draft a skill", steps: [go("/library?tab=skills", "Skills are reusable instructions the agents follow."), tab("skills", "The Skills tab lists every skill."), { do: "click", target: "lib-new-skill", say: "New skill opens the editor." }, draftType("skill-name", f.name ?? "", "a name"), draftType("skill-purpose", f.purpose ?? "", "what it achieves"), draftType("skill-instructions", f.instructions ?? "", "the steps"), draftType("skill-triggers", f.triggers ?? "", "the words that bring it in"), yours("skill-save", "Pick which agents use it, then Create skill saves it. That button is yours.")] };
    case "prompt":
      return { title: "Draft a prompt", steps: [go("/library?tab=prompts", "Prompts are what each agent is told."), tab("prompts", "The Prompts tab lists them, versioned."), { do: "click", target: "lib-new-prompt", say: "New prompt opens the editor." }, draftType("prompt-title", f.title ?? "", "a title"), draftType("prompt-purpose", f.purpose ?? "", "what it's for"), draftType("prompt-template", f.template ?? "", "the prompt"), yours("prompt-save", "Pick the agents that use it, then save it yourself.")] };
    case "note":
      return { title: "Draft a note", steps: [go("/knowledge", "Decisions and notes are kept in the Knowledge Hub."), tab("note", "Write a note records a decision, note, snippet or glossary term."), point("note-kind", "Choose what it is: a decision, note, snippet or glossary term."), draftType("note-title", f.title ?? "", "a title"), draftType("note-content", f.content ?? "", "the note"), yours("note-save", "Save it yourself. The agents can use it in later builds.")] };
    case "topic":
      return { title: "Draft a research topic", steps: [go("/topics", "Topic Search follows a subject across the web for you."), { do: "click", target: "topic-new", say: "New topic opens the form." }, draftType("topic-q", f.q ?? "", "the topic"), yours("topic-create", "Create topic starts it. That button is yours.")] };
  }
}


/**
 * Show me for features inside New build (a modal several steps deep): the generic one-step walkthrough can't open it
 * or reach step 3, so these open New build and go to the right place.
 */
export const FEATURE_JOURNEYS: Record<string, () => Journey> = {
  "dash.prototype-card": () => ({
    title: "What a prototype is and isn't",
    steps: [go("/", "New builds start from the Dashboard."), { do: "event", name: "fc:new-build", say: "Start a prototype opens New build." }, point("nb-proto", "At the top of New build: what you get (real screens, pretend data, a checked design) and what it won't do yet.")],
  }),
  "dash.reuse": () => ({
    title: "Same settings as last time",
    steps: [
      go("/", "New builds start from the Dashboard."),
      { do: "event", name: "fc:new-build", say: "Start a prototype opens New build." },
      { do: "point", target: "nb-last", say: "Same settings as your last build: its look, extras, autonomy and coder. Nothing changes until you press Use them.", missing: "This appears at the top of New build once you've started a build here: then it offers that build's settings." },
    ],
  }),
  "dash.help-choose": () => ({
    title: "Help me choose (local or cloud)",
    steps: [
      go("/", "New builds start from the Dashboard."),
      { do: "event", name: "fc:new-build", say: "Start a prototype opens New build." },
      { do: "wait", target: "nb-desc", until: "nb-help-choose", say: "Help me choose is in step 3, beside Who writes the code. Write a sentence about your app here, then press Next until you reach step 3. I'll carry on from there." },
      { do: "click", target: "nb-help-choose", say: "Help me choose opens a side-by-side of Local and Cloud: what leaves this computer, cost, quality and speed." },
      point("nb-help-choose-box", "Only what FlowCode knows: Local keeps everything here and is free; Cloud sends code and screenshots to the provider, which charges per use. Neither is claimed to be faster."),
    ],
  }),
};
