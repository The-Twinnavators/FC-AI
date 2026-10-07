# FlowCode

**Local-first, AI-native IDE with a governed multi-agent runtime.**
Give FlowCode a request, approve meaningful risk, watch it work, intervene at any point, and receive a
runnable, inspectable, reversible result — or a precise explanation of what blocked it.

This repository implements the PRD in [`docs/PRD.md`](docs/PRD.md) ("Forge IDE", product name FlowCode).
Architecture: [`docs/architecture.md`](docs/architecture.md) · Decisions: [`docs/adr/`](docs/adr) ·
Open-question defaults: [`docs/open-questions.md`](docs/open-questions.md).

## Requirements (all free)
- Node.js ≥ 22.13 (tested on 24.14) and npm
- [Ollama](https://ollama.com) with a tool-calling model. Verified Coder on the reference machine: `qwen3:14b`
  (`ollama pull qwen3:14b`). Optional: `qwen2.5vl:3b` (vision critic), `nomic-embed-text` (semantic search).
- Windows 11 (primary target). macOS/Linux code paths exist but are untested.

## Quick start
```bash
npm install
npx playwright install chromium
npm run build
npm run start -w @flowcode/desktop
```
`npm run build` compiles contracts, daemon, UI and the Electron shell. The desktop app starts the local daemon
(on Electron's bundled Node) and opens the UI.

First run:
1. **System Health → Models & capability lab** → *Run capability test* on your Coder model (8 probes, a few minutes
   on GPU). Only a model that passes every probe can act as Coder.
2. **Dashboard → Start a prototype** opens New build: describe what you're building and, if you have one, add your
   PRD (.md) and support files; choose the look; name it and choose who writes the code (Local keeps code, design and
   screenshots on this computer); choose autonomy. Or start from **Create PRD** to research a problem and write the
   PRD first. **My Projects** opens projects you already have.
3. Under Supervised or Assisted, review the prototype plan and the design → **Approve plan**. Anything that needs
   your OK (installs, out-of-scope edits) shows under **Needs you** in the builder's Overview and on **Approvals**.
4. Watch the builder: the Overview says where the build stands; the tabs are **Preview**, **Design**, **Review**
   (changes by step, with undo), **Activity** and **Technical output**. The checks bar at the bottom shows each check.
5. When it finishes, **My Projects → your project** has the run reports, the prototype plan and **Launch readiness**
   (what the real app still needs, downloadable as Markdown). Ask for changes in the builder's chat.

## Development
```bash
npm run build                                    # everything
node --disable-warning=ExperimentalWarning scripts/dev-daemon.mjs   # daemon on :7457, token dev-token-flowcode
npm run dev -w @flowcode/ui                      # UI on :5199
npm run dev:empty                                # an empty FlowCode on :7467, reset each run, for checking empty states
                                                 # (open the 127.0.0.1:5199 address it prints; add -- --keep to keep its data)
# open http://127.0.0.1:5199/?port=7457&token=dev-token-flowcode
npm test                                         # acceptance tests (Phases 1–4, 6, 7)
node scripts/audit-ui.mjs                        # axe audit of the product UI (needs the two servers above)
node packages/daemon/dist/bench/goldenPath.js 2 qwen3:14b   # Phase 5 golden-path benchmark
```

## What is where
| Path | Purpose |
|---|---|
| `apps/desktop` | Electron shell (window, folder picker, daemon lifecycle) |
| `apps/ui` | React UI: Dashboard, builder, My Projects, Create PRD, FlowReport, Prompts & Skills, Knowledge Hub, Research Topics, Agents, Network Graph, Approvals, System Settings, System Health, Branding |
| `packages/contracts` | Zod schemas/types shared by daemon and UI; event types; tool schemas; API routes |
| `packages/daemon` | Governed runtime, orchestrator, model router, knowledge, quality, reports, API |
| `templates/react-vite-starter` | Verified starter used by the golden path |
| `benchmarks/` | Golden-path benchmark outputs (reports, screenshots, summaries) |
| `docs/` | PRD, architecture, ADRs, brand |

## Principles enforced in code
Evidence over narration (deterministic Done gate) · small verified steps (checkpointed task DAG) · local by
default, external by consent · models propose, the runtime governs (typed tools, policy tiers, approvals,
snapshots) · no hidden uncertainty (limitations and skipped checks are reported) · continuous user control
(approve, cancel, resume, retry, roll back).
