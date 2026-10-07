/**
 * Design playbook: your own strategies for custom UX design (layout systems, visual direction, component rules).
 * Documents uploaded to the playbook are global knowledge tagged "design-playbook". On interface steps (screens,
 * components, styles), FlowCode hands the coder the playbook sections that best match the step, so agents design to
 * your playbook instead of a generic template. A document can be switched off without deleting it.
 */
import type { KnowledgeItem, Task } from "@flowcode/contracts";
import type { App } from "../app.js";

export const PLAYBOOK_TAG = "design-playbook";

export interface PlaybookDoc {
  title: string;
  ids: string[];
  sections: number;
  characters: number;
  active: boolean;
  addedAt: string;
}

const baseTitle = (t: string) => t.replace(/\s*\(part \d+ of \d+\)\s*$/i, "").trim();
const isPlaybook = (k: KnowledgeItem) => k.tags.includes(PLAYBOOK_TAG);

export function playbookItems(app: Pick<App, "store">): KnowledgeItem[] {
  return app.store.knowledge.list("updated_at DESC", 5000).filter(isPlaybook);
}

/** One entry per uploaded document (its sections grouped), newest first. */
export function listPlaybook(app: Pick<App, "store">): PlaybookDoc[] {
  const by = new Map<string, PlaybookDoc>();
  for (const k of playbookItems(app)) {
    const title = baseTitle(k.title);
    const d = by.get(title) ?? { title, ids: [], sections: 0, characters: 0, active: false, addedAt: k.createdAt };
    d.ids.push(k.id);
    d.sections++;
    d.characters += k.content.length;
    if (!k.excluded) d.active = true;
    if (k.createdAt < d.addedAt) d.addedAt = k.createdAt;
    by.set(title, d);
  }
  return [...by.values()].sort((a, b) => b.addedAt.localeCompare(a.addedAt));
}

/** Switches whole documents on or off for the agents (sections are kept). */
export function setPlaybookActive(app: App, ids: string[], active: boolean): PlaybookDoc[] {
  for (const id of ids) {
    const k = app.store.knowledge.get(id);
    if (k && isPlaybook(k)) app.knowledge.update(id, { excluded: !active });
  }
  return listPlaybook(app);
}

/** Removes a document from the playbook (its sections stay in the library as ordinary uploads). */
export function removeFromPlaybook(app: App, ids: string[]): PlaybookDoc[] {
  for (const id of ids) {
    const k = app.store.knowledge.get(id);
    if (k && isPlaybook(k)) app.knowledge.update(id, { tags: k.tags.filter((t) => t !== PLAYBOOK_TAG), excluded: false });
  }
  return listPlaybook(app);
}

const STOP = new Set("the a an and or of to in on for with from by is are be this that it as at into each all any use make build add".split(" "));
const words = (text: string) => [...new Set(text.toLowerCase().match(/[a-z][a-z0-9-]{2,}/g) ?? [])].filter((w) => !STOP.has(w));

/** A step that changes what people see: screens, components, styles, layout or markup. */
export function isInterfaceStep(task: Pick<Task, "title" | "objective" | "expectedPaths">): boolean {
  if (task.expectedPaths.some((p) => /\.(tsx|jsx|vue|svelte|css|scss|html?)$|(^|\/)(screens|components|styles|app)\/?$/i.test(p))) return true;
  return /\b(screen|page|layout|navigation|component|style|design|ui|ux|responsive|mobile|dialog|modal|form|card|dashboard|landing|hero|shell)\b/i.test(`${task.title} ${task.objective.slice(0, 600)}`);
}

/**
 * The playbook sections that best match a step, for the coder's prompt. Sections are scored by the step's words
 * (title words count more); one strong section per document first, so one long guide doesn't crowd out the rest.
 */
export function playbookFor(app: Pick<App, "store">, text: string, limit = 2, maxChars = 1400): Array<{ id: string; title: string; content: string }> {
  const items = playbookItems(app).filter((k) => !k.excluded);
  if (!items.length) return [];
  const want = words(text);
  const scored = items
    .map((k) => {
      const title = k.title.toLowerCase();
      const body = k.content.toLowerCase();
      const score = want.reduce((n, w) => n + (title.includes(w) ? 3 : 0) + (body.includes(w) ? 1 : 0), 0);
      return { k, score };
    })
    .sort((a, b) => b.score - a.score);
  const picked: typeof scored = [];
  const docs = new Set<string>();
  for (const s of scored) {
    if (picked.length >= limit) break;
    const doc = baseTitle(s.k.title);
    if (docs.has(doc)) continue;
    docs.add(doc);
    picked.push(s);
  }
  for (const s of scored) if (picked.length < limit && !picked.includes(s)) picked.push(s);
  return picked.map(({ k }) => ({ id: k.id, title: `Design playbook: ${k.title}`, content: k.content.slice(0, maxChars) }));
}
