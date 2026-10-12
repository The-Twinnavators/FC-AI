/**
 * The header block every library piece starts with: what it's for, in the words FlowCode and its agents match a PRD
 * against (use cases, jobs to be done, keywords). Written from the catalog by scripts/library-meta.mjs and checked by a
 * test, so a piece copied into an app still says what it's for. A piece with a catalog ID (c. component, p. pattern,
 * b. block, t. page template) also says what it does, how to use it, its variants, what it's built from, how it looks
 * and which design tokens style it.
 */
import { levelOf, type LibrarySection } from "./sectionLibrary.js";

export const META_START = "/** @flowcode-library";

export function metaBlock(s: LibrarySection, categoryLabel: string): string {
  const line = (label: string, items: string[] | undefined, sep: string) => (items?.length ? [` * ${label}: ${items.join(sep)}`] : []);
  const one = (label: string, text: string | undefined) => (text ? [` * ${label}: ${text}`] : []);
  return [
    `${META_START} ${s.id} · ${s.name} (${categoryLabel})`,
    ...(s.ref ? [` * Catalog ID: ${s.ref} (${levelOf(s.ref) ?? "piece"}${s.versionOf ? " version" : ""})`, ...one("Version of", s.versionOf), ...one("Function", s.description), ...one("Use it as", s.usage)] : []),
    ...line("Variants", s.variants?.map((v) => `${v.ref} - ${v.look}`), "; "),
    ...line("Built from", s.uses, ", "),
    ...one("Look", s.look),
    ...line("Tokens", s.tokens, " "),
    ...(s.also ?? []).flatMap((a) => [
      ` * Also: ${a.ref} (${levelOf(a.ref) ?? "piece"})`,
      ...one("  Use it as", a.usage),
      ...line("  Variants", a.variants?.map((v) => `${v.ref} - ${v.look}`), "; "),
      ...one("  Look", a.look),
    ]),
    ...line("Use cases", s.useCases, "; "),
    ...line("Jobs to be done", s.jobs, "; "),
    ...line("Keywords", s.tags, ", "),
    " */",
  ].join("\n");
}
