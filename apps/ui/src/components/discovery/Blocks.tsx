/**
 * Discovery step content: the user's answers (fields) and FlowCode's generated parts (blocks), each editable, with
 * evidence labels on findings and the AI disclosure where simulated or assessed content appears.
 */
import { useEffect, useRef, useState } from "react";
import { AI_DISCLOSURE, EVIDENCE_LABELS, EVIDENCE_ORDER, type BlockValue, type DiscoveryBlock, type DiscoveryField, type EvidenceLabel, type Row } from "@flowcode/contracts";

export function Disclosure({ compact }: { compact?: boolean }) {
  return (
    <p className={`disc-disclosure${compact ? " disc-disclosure--compact" : ""}`} role="note">
      <span className="disc-disclosure__tag">AI-generated</span> {AI_DISCLOSURE}
    </p>
  );
}

export function EvidenceTag({ label }: { label?: EvidenceLabel }) {
  if (!label) return null;
  const info = EVIDENCE_LABELS[label];
  return (
    <span className={`disc-tag disc-tag--${label}`} title={info.meaning}>
      {info.label}
    </span>
  );
}

// ───────────────────────── Fields (the user's answers) ─────────────────────────

type Value = string | string[];

export function FieldInput({ f, value, onChange, idPrefix }: { f: DiscoveryField; value: Value | undefined; onChange: (v: Value) => void; idPrefix: string }) {
  const id = `${idPrefix}-${f.id}`;
  const hint = f.helper ? `${id}-hint` : undefined;
  const label = (
    <label className="disc-field__label" htmlFor={f.type === "choice" || f.type === "multichoice" ? undefined : id} id={`${id}-label`}>
      {f.label}
      {f.required ? <span className="disc-field__req"> (required)</span> : null}
    </label>
  );
  if (f.type === "choice")
    return (
      <fieldset className="disc-field" aria-describedby={hint}>
        <legend className="disc-field__label">
          {f.label}
          {f.required ? <span className="disc-field__req"> (required)</span> : null}
        </legend>
        {f.helper ? <p id={hint} className="disc-field__hint">{f.helper}</p> : null}
        <div className="disc-choices">
          {f.options!.map((o) => (
            <label key={o} className={`disc-choice${value === o ? " is-on" : ""}`}>
              <input type="radio" name={id} value={o} checked={value === o} onChange={() => onChange(o)} />
              <span>{o}</span>
            </label>
          ))}
        </div>
      </fieldset>
    );
  if (f.type === "multichoice") {
    const cur = Array.isArray(value) ? value : [];
    return (
      <fieldset className="disc-field" aria-describedby={`${id}-count`}>
        <legend className="disc-field__label">
          {f.label}
          {f.required ? <span className="disc-field__req"> (required)</span> : null}
        </legend>
        <p id={`${id}-count`} className="disc-field__hint">
          {f.min && f.max ? `Choose ${f.min} to ${f.max}. ` : ""}
          {cur.length} chosen.
        </p>
        <div className="disc-choices">
          {f.options!.map((o) => {
            const on = cur.includes(o);
            return (
              <label key={o} className={`disc-choice${on ? " is-on" : ""}`}>
                <input type="checkbox" checked={on} disabled={!on && !!f.max && cur.length >= f.max} onChange={(e) => onChange(e.target.checked ? [...cur, o] : cur.filter((x) => x !== o))} />
                <span>{o}</span>
              </label>
            );
          })}
        </div>
      </fieldset>
    );
  }
  if (f.type === "list") {
    const cur = Array.isArray(value) ? value : value ? [value] : [];
    const text = cur.join("\n");
    const unused = (f.examples ?? []).filter((e) => !cur.includes(e));
    return (
      <div className="disc-field">
        {label}
        {f.helper ? <p id={hint} className="disc-field__hint">{f.helper}</p> : null}
        <textarea id={id} className="textarea" rows={Math.min(8, Math.max(3, cur.length + 1))} value={text} aria-describedby={hint} placeholder="One per line" onChange={(e) => onChange(e.target.value.split("\n"))} />
        {unused.length ? (
          <div className="disc-suggest" aria-label={`Suggestions for ${f.label}`}>
            <span className="disc-suggest__label">Suggestions:</span>
            {unused.map((e) => (
              <button key={e} type="button" className="disc-suggest__chip" onClick={() => onChange([...cur.filter((x) => x.trim()), e])}>
                + {e}
              </button>
            ))}
          </div>
        ) : null}
      </div>
    );
  }
  const str = typeof value === "string" ? value : "";
  return (
    <div className="disc-field">
      {label}
      {f.helper ? <p id={hint} className="disc-field__hint">{f.helper}</p> : null}
      {f.type === "textarea" ? (
        <textarea id={id} className="textarea" rows={3} value={str} placeholder={f.placeholder} aria-describedby={hint} onChange={(e) => onChange(e.target.value)} />
      ) : (
        <input id={id} className="input" value={str} placeholder={f.placeholder ?? (f.examples?.[0] ? `Example: ${f.examples[0]}` : undefined)} aria-describedby={hint} onChange={(e) => onChange(e.target.value)} />
      )}
      {f.examples?.length && f.type === "text" ? (
        <div className="disc-suggest" aria-label={`Examples for ${f.label}`}>
          <span className="disc-suggest__label">Examples:</span>
          {f.examples.slice(0, 5).map((e) => (
            <button key={e} type="button" className="disc-suggest__chip" onClick={() => onChange(e)}>
              {e}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

// ───────────────────────── Blocks (generated parts) ─────────────────────────

function BlockView({ b, v }: { b: DiscoveryBlock; v: BlockValue | undefined }) {
  if (b.kind === "text") return typeof v === "string" && v.trim() ? <p className="disc-text">{v}</p> : <p className="disc-empty">Nothing here yet.</p>;
  if (b.kind === "list") {
    const xs = Array.isArray(v) ? (v as string[]) : [];
    return xs.length ? (
      <ul className="disc-list">
        {xs.map((x, i) => (
          <li key={i}>{x}</li>
        ))}
      </ul>
    ) : (
      <p className="disc-empty">Nothing here yet.</p>
    );
  }
  if (b.kind === "fields") {
    const o = (v ?? {}) as Record<string, string>;
    return (
      <dl className="disc-dl">
        {(b.keys ?? []).map((k) => (
          <div key={k.id}>
            <dt>{k.label}</dt>
            <dd>{o[k.id] || <span className="disc-empty">Not set</span>}</dd>
          </div>
        ))}
      </dl>
    );
  }
  const rows = Array.isArray(v) ? (v as Row[]) : [];
  if (!rows.length) return <p className="disc-empty">{b.userRows ? "No rows yet. Add one when you learn something." : "Nothing here yet."}</p>;
  return (
    <div className="disc-table-wrap" role="region" aria-label={b.label} tabIndex={0}>
      <table className="disc-table">
        <thead>
          <tr>
            {(b.columns ?? []).map((c) => (
              <th key={c.id} scope="col" className={c.wide ? "is-wide" : undefined}>
                {c.label}
              </th>
            ))}
            {b.labelled ? <th scope="col">Source type</th> : null}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>
              {(b.columns ?? []).map((c) => (
                <td key={c.id}>{r[c.id]}</td>
              ))}
              {b.labelled ? (
                <td>
                  <EvidenceTag label={r._label} />
                </td>
              ) : null}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function BlockEdit({ b, v, onChange }: { b: DiscoveryBlock; v: BlockValue | undefined; onChange: (v: BlockValue) => void }) {
  if (b.kind === "text") return <textarea className="textarea" aria-label={b.label} rows={3} value={typeof v === "string" ? v : ""} onChange={(e) => onChange(e.target.value)} />;
  if (b.kind === "list") return <textarea className="textarea" aria-label={`${b.label}, one per line`} rows={5} value={Array.isArray(v) ? (v as string[]).join("\n") : ""} onChange={(e) => onChange(e.target.value.split("\n"))} />;
  if (b.kind === "fields") {
    const o = (v ?? {}) as Record<string, string>;
    return (
      <div className="disc-edit-fields">
        {(b.keys ?? []).map((k) => (
          <label key={k.id} className="disc-field">
            <span className="disc-field__label">{k.label}</span>
            <textarea className="textarea" rows={2} value={o[k.id] ?? ""} onChange={(e) => onChange({ ...o, [k.id]: e.target.value })} />
          </label>
        ))}
      </div>
    );
  }
  const rows = Array.isArray(v) ? (v as Row[]) : [];
  const set = (i: number, patch: Partial<Row>) => onChange(rows.map((r, n) => (n === i ? ({ ...r, ...patch } as Row) : r)));
  return (
    <div className="disc-edit-rows">
      {rows.map((r, i) => (
        <fieldset key={i} className="disc-edit-row">
          <legend>
            Row {i + 1}
            {r._user === "1" ? " (yours)" : ""}
          </legend>
          <div className="disc-edit-row__grid">
            {(b.columns ?? []).map((c) => (
              <label key={c.id} className={`disc-field${c.wide ? " is-wide" : ""}`}>
                <span className="disc-field__label">{c.label}</span>
                {c.options ? (
                  <select className="select" value={r[c.id] ?? ""} onChange={(e) => set(i, { [c.id]: e.target.value })}>
                    <option value="">Choose…</option>
                    {c.options.map((o) => (
                      <option key={o}>{o}</option>
                    ))}
                  </select>
                ) : (
                  <textarea className="textarea" rows={c.wide ? 2 : 1} value={r[c.id] ?? ""} onChange={(e) => set(i, { [c.id]: e.target.value })} />
                )}
              </label>
            ))}
            {b.labelled ? (
              <label className="disc-field">
                <span className="disc-field__label">Source type</span>
                <select className="select" value={r._label ?? ""} onChange={(e) => set(i, { _label: e.target.value as EvidenceLabel })}>
                  {EVIDENCE_ORDER.map((l) => (
                    <option key={l} value={l}>
                      {EVIDENCE_LABELS[l].label}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
          </div>
          <button type="button" className="btn btn--sm btn--ghost" onClick={() => onChange(rows.filter((_, n) => n !== i))}>
            Remove row
          </button>
        </fieldset>
      ))}
      {!b.maxRows || rows.length < b.maxRows ? (
        <button type="button" className="btn btn--sm" onClick={() => onChange([...rows, { ...Object.fromEntries((b.columns ?? []).map((c) => [c.id, ""])), ...(b.labelled ? { _label: b.userRows ? (b.defaultLabel === "real" ? "real" : "user") : "user" } : {}), _user: "1" } as Row])}>
          Add a row
        </button>
      ) : null}
    </div>
  );
}

/** One generated block: view, or edit with Save and Cancel. Adding rows to a user table opens it in edit mode. */
export function Block({ b, v, onSave, busy }: { b: DiscoveryBlock; v: BlockValue | undefined; onSave: (v: BlockValue) => Promise<void>; busy?: boolean }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<BlockValue | undefined>(v);
  const headRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    if (!editing) setDraft(v);
  }, [v, editing]);
  return (
    <section className="disc-block" aria-labelledby={`blk-${b.id}`}>
      <div className="disc-block__head">
        <h3 id={`blk-${b.id}`} ref={headRef} tabIndex={-1}>
          {b.label}
        </h3>
        {b.badge ? <span className="disc-badge">{b.badge}</span> : null}
        {!editing ? (
          <button type="button" className="btn btn--sm btn--ghost disc-block__edit" disabled={busy} onClick={() => setEditing(true)}>
            {b.userRows ? "Add or edit rows" : "Edit"}
          </button>
        ) : null}
      </div>
      {b.hint ? <p className="disc-block__hint">{b.hint}</p> : null}
      {b.disclosure ? <Disclosure compact /> : null}
      {editing ? (
        <div className="disc-block__editor">
          <BlockEdit b={b} v={draft} onChange={setDraft} />
          <div className="disc-actions">
            <button
              type="button"
              className="btn btn--primary btn--sm"
              disabled={busy}
              onClick={async () => {
                await onSave(draft ?? "");
                setEditing(false);
                headRef.current?.focus();
              }}
            >
              Save changes
            </button>
            <button type="button" className="btn btn--ghost btn--sm" onClick={() => (setEditing(false), setDraft(v), headRef.current?.focus())}>
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <BlockView b={b} v={v} />
      )}
    </section>
  );
}
