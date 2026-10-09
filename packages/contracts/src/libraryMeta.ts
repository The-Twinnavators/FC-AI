/**
 * The header block every library piece starts with: what it's for, in the words FlowCode and its agents match a PRD
 * against (use cases, jobs to be done, keywords). Written from the catalog by scripts/library-meta.mjs and checked by a
 * test, so a piece copied into an app still says what it's for.
 */
import type { LibrarySection } from "./sectionLibrary.js";

export const META_START = "/** @flowcode-library";

export function metaBlock(s: LibrarySection, categoryLabel: string): string {
  const line = (label: string, items: string[] | undefined, sep: string) => (items?.length ? [` * ${label}: ${items.join(sep)}`] : []);
  return [
    `${META_START} ${s.id} · ${s.name} (${categoryLabel})`,
    ...line("Use cases", s.useCases, "; "),
    ...line("Jobs to be done", s.jobs, "; "),
    ...line("Keywords", s.tags, ", "),
    " */",
  ].join("\n");
}
