/**
 * FlowCode composes a standard screen itself, from the app model and the records, before a model works on it: the
 * structure and behaviour a small local model couldn't write reliably, so its part is only refining. Deterministic,
 * typed against the app's own store (src/sections/AppData), styled only with the app's tokens, in a stylesheet of the
 * screen's own.
 *
 * A list of records with pictures becomes a picture grid: the collection's own heading when the app has one (a single
 * record of another kind, like the gallery a client is reviewing), search by title, a filter for each of the kind's
 * filter fields, a live count, a grid of cards that open the record's page, and an empty state that clears the search.
 *
 * Frameproof main build: qwen3:8b, asked to recompose the Gallery from a table into the PRD's photo grid, made two
 * edits that broke the screen (a hook called without the store, a missing import, props the table doesn't take) and no
 * design; the calculator's screen ran out of turns after 20 minutes.
 */
import type { AppModel, ModelEntity, ModelField, ModelView } from "./appModel.js";
import { builtViews, screenFileOf } from "./appFiles.js";

export interface ComposedScreen {
  view: string;
  files: Array<{ path: string; content: string }>;
  /** What was composed, in a sentence, for the build's record. */
  summary: string;
}

/** The marker a generated screen carries until something rewrites it (appFiles.ts writes it). */
const GENERATED = "Built by FlowCode from the app model";
const COMPOSED = "Composed by FlowCode";

const imageFieldOf = (e: ModelEntity) => e.fields.find((f) => /image|photo|picture|thumbnail/i.test(f.key) && !/alt/i.test(f.key));
const altFieldOf = (e: ModelEntity) => e.fields.find((f) => /^alt|alt(text)?$/i.test(f.key));
const options = (f: ModelField) => (f.options ?? []).filter((o) => !/^(all|any|none)$/i.test(o.trim()));
const js = (v: unknown) => JSON.stringify(v);

/** Whether FlowCode composes this view (and the screen file it would write is still the generated one). */
export function composable(m: AppModel, v: ModelView, current?: string): boolean {
  if (v.kind !== "list" || !v.entity) return false;
  const e = m.entities.find((x) => x.key === v.entity);
  if (!e || !imageFieldOf(e)) return false;
  return current === undefined || (current.includes(GENERATED) && !current.includes(COMPOSED));
}

/** The record that names the collection the list shows: the only record of another kind, when there is exactly one. */
function contextOf(m: AppModel, entity: string): { e: ModelEntity; fields: ModelField[] } | undefined {
  const others = m.entities.filter((x) => x.key !== entity && (m.seed[x.key] ?? []).length === 1);
  if (others.length !== 1) return undefined;
  const e = others[0]!;
  const fields = e.fields.filter((f) => f.key !== "id" && f.key !== e.titleField && (f.type === "text" || f.type === "email"));
  return { e, fields };
}

export function composeListScreen(m: AppModel, v: ModelView): ComposedScreen | undefined {
  if (!composable(m, v)) return undefined;
  const e = m.entities.find((x) => x.key === v.entity)!;
  const img = imageFieldOf(e)!;
  const alt = altFieldOf(e);
  const detail = builtViews(m).find((x) => x.kind === "detail" && x.entity === e.key);
  const facets = (e.filters?.length ? e.filters : e.fields.filter((f) => f.type === "select").map((f) => f.key))
    .map((k) => e.fields.find((f) => f.key === k))
    .filter((f): f is ModelField => !!f && options(f).length > 1);
  const ctx = contextOf(m, e.key);
  const sub = e.subtitleField && e.fields.some((f) => f.key === e.subtitleField) ? e.subtitleField : facets[0]?.key;
  const noun = e.plural.toLowerCase();
  const sheet = `src/styles/${v.id}.css`;
  const file = screenFileOf(v);
  const comp = file.replace(/^.*\//, "").replace(/\.tsx$/, "");
  const state = facets.map((f, i) => `  const [${`f${i}`}, set${`F${i}`}] = useState("");`);
  const facetTest = facets.map((f, i) => ` && (!f${i} || r[${js(f.key)}] === f${i})`).join("");
  const facetControls = facets.map(
    (f, i) => `        <label className="cmp-field">
          <span>${f.label}</span>
          <select value={f${i}} onChange={(ev) => setF${i}(ev.target.value)}>
            <option value="">All</option>
            {${js(options(f))}.map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </select>
        </label>`,
  );
  const clearFacets = facets.map((_f, i) => ` setF${i}("");`).join("");
  const facetWords = facets.map((f, i) => `(f${i} ? " in " + f${i} : "")`).join(" + ");
  const header = ctx
    ? `      <header className="cmp-head">
        <h1>{String(context?.[${js(ctx.e.titleField)}] ?? ${js(v.label)})}</h1>
        {context ? (
          <dl className="cmp-facts">
${ctx.fields
  .map(
    (f) => `            {context[${js(f.key)}] ? (
              <div>
                <dt>${f.label}</dt>
                <dd>{String(context[${js(f.key)}])}</dd>
              </div>
            ) : null}`,
  )
  .join("\n")}
          </dl>
        ) : null}
      </header>`
    : `      <header className="cmp-head">
        <h1>${v.label}</h1>
      </header>`;
  const open = detail ? `go(${js(detail.id)}, r.id)` : "undefined";
  const tsx = `/**
 * ${v.label}
 * ${COMPOSED} from the app model and its records (screenComposer.ts): ${noun} as a grid of pictures, search by
 * ${e.fields.find((f) => f.key === e.titleField)?.label.toLowerCase() ?? "title"}${facets.length ? `, ${facets.map((f) => f.label.toLowerCase()).join(" and ")} filter${facets.length > 1 ? "s" : ""}` : ""}${detail ? `, each opening its page` : ""}. It reads the app's one store (src/app/store.ts).
 */
import { useMemo, useState } from "react";
import { useRecords } from "../sections/AppData";
import { go } from "../app/routes";
import { store } from "../app/store";
import "../styles/${v.id}.css";

const initials = (s: string) =>
  s
    .split(/\\s+/)
    .slice(0, 2)
    .map((w) => w.charAt(0).toUpperCase())
    .join("");

export default function ${comp}() {
  const records = useRecords(store, ${js(e.key)});
${ctx ? `  const context = useRecords(store, ${js(ctx.e.key)})[0];\n` : ""}  const [query, setQuery] = useState("");
${state.join("\n")}${state.length ? "\n" : ""}  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return records.filter((r) => (!q || String(r[${js(e.titleField)}] ?? "").toLowerCase().includes(q))${facetTest});
  }, [records, query${facets.map((_f, i) => `, f${i}`).join("")}]);
  const clear = () => {
    setQuery("");${clearFacets}
  };
  return (
    <main className="fl-wrap cmp-list cmp-${v.id}">
${header}
      <div className="cmp-controls" role="search">
        <label className="cmp-field cmp-field--grow">
          <span>Search ${noun}</span>
          <input type="search" value={query} onChange={(ev) => setQuery(ev.target.value)} placeholder=${js(`Search by ${(e.fields.find((f) => f.key === e.titleField)?.label ?? "title").toLowerCase()}`)} />
        </label>
${facetControls.join("\n")}
        <p className="cmp-count" aria-live="polite">
          Showing {shown.length} of {records.length} ${noun}
        </p>
      </div>
      {shown.length ? (
        <ul className="cmp-grid">
          {shown.map((r) => {
            const title = String(r[${js(e.titleField)}] ?? r.id);
            const src = String(r[${js(img.key)}] ?? "");
            return (
              <li key={r.id}>
                <button type="button" className="cmp-card" aria-label={"Open " + title} onClick={() => ${open}}>
                  {src ? <img className="cmp-pic" src={src} alt={String(r[${js(alt?.key ?? e.titleField)}] ?? title)} loading="lazy" /> : <span className="cmp-pic cmp-pic--none" aria-hidden="true">{initials(title)}</span>}
                  <span className="cmp-cap">
                    <span className="cmp-title">{title}</span>
${sub ? `                    {r[${js(sub)}] ? <span className="cmp-sub">{String(r[${js(sub)}])}</span> : null}\n` : ""}                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      ) : (
        <div className="cmp-empty">
          <p>{"No ${noun} match" + (query.trim() ? " \\u201c" + query.trim() + "\\u201d" : "")${facets.length ? ` + ${facetWords}` : ""} + "."}</p>
          <button type="button" className="fl-btn" onClick={clear}>
            Clear search${facets.length ? " and filters" : ""}
          </button>
        </div>
      )}
    </main>
  );
}
`;
  const css = `/* ${v.label}: ${COMPOSED.toLowerCase()} (screenComposer.ts), styled only with the app's tokens. */
.cmp-${v.id} { display: grid; gap: var(--space-6); padding-block: var(--space-6); }
.cmp-${v.id} .cmp-head { display: grid; gap: var(--space-2); }
.cmp-${v.id} .cmp-head h1 { margin: 0; font-family: var(--font-display); font-size: var(--type-h1-size, var(--text-3xl)); font-weight: var(--heading-weight, var(--weight-bold)); line-height: var(--leading-tight); letter-spacing: var(--tracking-tight, 0); }
.cmp-${v.id} .cmp-facts { display: flex; flex-wrap: wrap; gap: var(--space-1) var(--space-5); margin: 0; color: var(--color-text-muted); font-size: var(--text-sm); }
.cmp-${v.id} .cmp-facts div { display: flex; gap: var(--space-2); }
.cmp-${v.id} .cmp-facts dt { font-weight: var(--weight-medium); }
.cmp-${v.id} .cmp-facts dd { margin: 0; color: var(--color-text); }
.cmp-${v.id} .cmp-controls { display: flex; flex-wrap: wrap; align-items: end; gap: var(--space-3) var(--space-4); }
.cmp-${v.id} .cmp-field { display: grid; gap: var(--space-1); font-size: var(--text-sm); color: var(--color-text-muted); }
.cmp-${v.id} .cmp-field--grow { flex: 1 1 16rem; }
.cmp-${v.id} .cmp-field input,
.cmp-${v.id} .cmp-field select { min-height: var(--control-md, 2.5rem); padding-inline: var(--space-3); border: var(--control-border, var(--border-width, 1px) solid var(--color-border)); border-radius: var(--field-radius, var(--control-radius, var(--radius-sm))); background: var(--control-bg, var(--color-surface)); box-shadow: var(--control-shadow, none); color: var(--color-text); font: inherit; font-size: var(--control-text-md, var(--text-md)); }
.cmp-${v.id} .cmp-field input:focus-visible,
.cmp-${v.id} .cmp-field select:focus-visible { outline: 2px solid var(--color-focus); outline-offset: 1px; }
.cmp-${v.id} .cmp-count { margin: 0 0 var(--space-2) auto; font-size: var(--text-sm); color: var(--color-text-muted); font-variant-numeric: tabular-nums; }
.cmp-${v.id} .cmp-grid { list-style: none; margin: 0; padding: 0; display: grid; gap: var(--space-4); grid-template-columns: repeat(auto-fill, minmax(min(100%, 13rem), 1fr)); }
.cmp-${v.id} .cmp-card { display: grid; width: 100%; padding: 0; text-align: left; font: inherit; color: inherit; cursor: pointer; background: var(--color-surface); border: var(--border-width, 1px) solid var(--color-border); border-radius: var(--radius-md); overflow: hidden; transition: border-color var(--duration-fast, 150ms) var(--ease-out, ease-out); }
.cmp-${v.id} .cmp-card:hover { border-color: var(--color-border-strong, var(--color-text-muted)); }
.cmp-${v.id} .cmp-card:focus-visible { outline: 2px solid var(--color-focus); outline-offset: 2px; }
.cmp-${v.id} .cmp-pic { display: block; width: 100%; aspect-ratio: 4 / 5; object-fit: cover; background: var(--color-surface-sunken); }
.cmp-${v.id} .cmp-pic--none { display: grid; place-items: center; font-family: var(--font-display); font-size: var(--text-2xl); color: var(--color-text-muted); }
.cmp-${v.id} .cmp-cap { display: grid; gap: var(--space-1); padding: var(--space-3); }
.cmp-${v.id} .cmp-title { font-weight: var(--weight-medium); }
.cmp-${v.id} .cmp-sub { font-size: var(--text-sm); color: var(--color-text-muted); }
.cmp-${v.id} .cmp-empty { display: grid; justify-items: start; gap: var(--space-3); padding: var(--space-7) var(--space-5); border: var(--border-width, 1px) dashed var(--color-border); border-radius: var(--radius-md); color: var(--color-text-muted); }
.cmp-${v.id} .cmp-empty p { margin: 0; }
@media (prefers-reduced-motion: reduce) { .cmp-${v.id} .cmp-card { transition: none; } }
`;
  return {
    view: v.id,
    files: [
      { path: file, content: tsx },
      { path: sheet, content: css },
    ],
    summary: `${v.label}: ${noun} as a grid of their pictures, search by title${facets.length ? `, ${facets.map((f) => f.label.toLowerCase()).join(" and ")} filter` : ""}${ctx ? `, the ${ctx.e.label.toLowerCase()}'s heading` : ""}${detail ? `, each opening its page` : ""}`,
  };
}
