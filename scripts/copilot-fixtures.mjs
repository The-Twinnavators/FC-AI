#!/usr/bin/env node
/**
 * Copilot fixture questions (VUS-12): asks the running Copilot how to find and use parts of FlowCode, and flags answers
 * that name controls FlowCode doesn't have: retired tabs, invented keyboard shortcuts, or the wrong place to start a
 * prototype. Run after UI changes, with the daemon up:
 *
 *   node scripts/copilot-fixtures.mjs            (port 7457, token dev-token-flowcode)
 *
 * Uses the local Copilot model only (no cloud calls). Exit code 1 when any answer is flagged.
 */
const PORT = process.env.FLOWCODE_PORT ?? "7457";
const TOKEN = process.env.FLOWCODE_TOKEN ?? "dev-token-flowcode";

const QUESTIONS = [
  "How do I start a new prototype?",
  "If I have a PRD, how do I start a build with it?",
  "How do I attach a CSS file to a new build?",
  "Where do I approve what's waiting on me?",
  "How do I see past decisions I made?",
  "How do I undo a change FlowCode made?",
  "Where can I see what changed in my app?",
  "How do I preview my app?",
  "How do I change my app's colours and fonts?",
  "How do I ask for a change to my app?",
  "How do I search for something in FlowCode?",
  "What keyboard shortcuts does FlowCode have?",
  "How do I connect an MCP server?",
  "How do I create a skill?",
  "How do I add a cloud model?",
  "Where is the launch readiness checklist?",
  "How do I see why a build stopped?",
  "Where are the model problems?",
  "How do I change how hands-on FlowCode is?",
  "How do I open the Copilot?",
];

/** What a correct answer never says. */
const RULES = [
  { re: /\b(Approvals|Changes|Terminal|Reports) tab\b/i, why: "names a builder tab that no longer exists" },
  { re: /\bImprovements page\b/i, why: "names the retired Improvements page (now System Health → Model problems)" },
  { re: /\bPlain\/Technical\b|\bTechnical mode\b/i, why: "names the retired Plain/Technical switch" },
  { re: /\bCtrl\s*\+\s*(?![KB]\b)[A-Z0-9]\b/i, why: "names a keyboard shortcut FlowCode doesn't have (only Ctrl+K and Ctrl+B)" },
  { re: /\bCtrl\s*\+\s*K\b[^.]{0,40}\bsearch/i, why: "says Ctrl+K searches (it opens the Copilot)" },
  { re: /\b(builder|project)(?:'s)? chat\b[^.]{0,80}\b(new (prototype|build|app)|attach (a|your) PRD)/i, why: "starts a new prototype from the builder chat (it's Start a prototype)" },
  { re: /\bglobal search\b[^.]{0,60}\battach/i, why: "attaches a file through Global search (it can't)" },
];

const ask = async (question) => {
  const res = await fetch(`http://127.0.0.1:${PORT}/copilot/ask`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${TOKEN}` },
    body: JSON.stringify({ question, route: "/" }),
  });
  if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
  return res.json();
};

let flagged = 0;
for (const q of QUESTIONS) {
  let out;
  try {
    out = await ask(q);
  } catch (e) {
    console.log(`ERROR  ${q}\n       ${e.message}`);
    flagged++;
    continue;
  }
  const text = [out.answer ?? "", ...(out.steps ?? []).map((s) => s.text)].join("\n");
  const hits = RULES.filter((r) => r.re.test(text));
  if (hits.length) {
    flagged++;
    console.log(`FLAG   ${q}`);
    for (const h of hits) console.log(`       - ${h.why}: "${text.match(h.re)?.[0]}"`);
  } else console.log(`ok     ${q}`);
}
console.log(`\n${QUESTIONS.length - flagged} of ${QUESTIONS.length} answers clean.`);
process.exit(flagged ? 1 : 0);
