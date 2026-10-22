/**
 * External components: websites and repositories outside the library that FlowCode's agents may learn from, each with
 * the owner's license decision. Only "Allowed" ones reach an agent (adapted, never copied); "Look only" ones as
 * references; a link added here starts as "Needs a license check" until the owner sets it.
 */
import { useState } from "react";
import { EXTERNAL_LICENSES, type ExternalLicense, type ExternalSource } from "@flowcode/contracts";
import { ExternalLink, Plus } from "lucide-react";
import { post, useResource } from "../api";

const ORDER: ExternalLicense[] = ["check", "allowed", "inspiration", "not-allowed"];

export function ExternalSources({ query = "" }: { query?: string }) {
  const res = useResource<{ sources: ExternalSource[] }>("/library/external");
  const [list, setList] = useState<ExternalSource[]>();
  const sources = list ?? res.data?.sources ?? [];
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [error, setError] = useState<string>();
  const [said, setSaid] = useState("");
  const [confirm, setConfirm] = useState<string>();
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  const shown = sources.filter((s) => !words.length || words.every((w) => `${s.name} ${s.url} ${s.terms} ${s.use}`.toLowerCase().includes(w)));

  const add = async () => {
    setError(undefined);
    try {
      const r = await post<{ sources: ExternalSource[] }>("/library/external", { name, url });
      setList(r.sources);
      setSaid(`Added ${name || url}. Set its license before agents use it.`);
      setName("");
      setUrl("");
      setAdding(false);
    } catch (e) {
      setError((e as Error).message);
    }
  };
  const setLicense = async (s: ExternalSource, license: ExternalLicense) => {
    const r = await post<{ sources: ExternalSource[] }>(`/library/external/${encodeURIComponent(s.id)}`, { license });
    setList(r.sources);
    setSaid(`${s.name}: ${EXTERNAL_LICENSES.find((l) => l.id === license)?.label}.`);
  };
  const remove = async (s: ExternalSource) => {
    const r = await post<{ sources: ExternalSource[] }>(`/library/external/${encodeURIComponent(s.id)}/remove`);
    setList(r.sources);
    setConfirm(undefined);
    setSaid(`Removed ${s.name}.`);
  };

  return (
    <div className="xs">
      <div className="xs__head">
        <p className="muted xs__intro">
          Outside sources FlowCode's agents may learn from. Only <strong>Allowed</strong> ones are used, adapted into FlowCode's own code with their notice kept, never copied. Many component sites forbid AI or builder use in their terms, so a new link waits for your license check.
        </p>
        {!adding ? (
          <button type="button" className="btn btn--sm btn--primary" onClick={() => setAdding(true)}>
            <Plus size={14} aria-hidden="true" /> Add link
          </button>
        ) : null}
      </div>
      {adding ? (
        <form
          className="xs__form"
          onSubmit={(e) => {
            e.preventDefault();
            void add();
          }}
        >
          <label className="field">
            <span>Name</span>
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Acme UI" autoFocus />
          </label>
          <label className="field">
            <span>Web address</span>
            <input className="input" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://" type="url" required aria-describedby={error ? "xs-error" : undefined} />
          </label>
          <div className="xs__form-actions">
            <button type="submit" className="btn btn--sm btn--primary">Add</button>
            <button type="button" className="btn btn--sm" onClick={() => (setAdding(false), setError(undefined))}>Cancel</button>
          </div>
          {error ? (
            <p id="xs-error" className="psetup__err" role="alert">
              {error}
            </p>
          ) : null}
        </form>
      ) : null}
      <p className="sr-only" role="status" aria-live="polite">
        {said}
      </p>
      {res.error ? <p className="psetup__err" role="alert">{res.error}</p> : null}
      {ORDER.map((lic) => {
        const group = shown.filter((s) => s.license === lic);
        if (!group.length) return null;
        const meta = EXTERNAL_LICENSES.find((l) => l.id === lic)!;
        return (
          <section key={lic} className="xs__group" aria-label={meta.label}>
            <h3 className="xs__group-title">
              <span className={`xs__dot xs__dot--${lic}`} aria-hidden="true" />
              {meta.label} <span className="muted">· {group.length}</span>
            </h3>
            <p className="muted xs__group-what">{meta.what}</p>
            <ul className="xs__list">
              {group.map((s) => (
                <li key={s.id} className="xs__row">
                  <div className="xs__main">
                    <a href={s.url} target="_blank" rel="noopener noreferrer" className="xs__name">
                      {s.name}
                      <ExternalLink size={13} aria-hidden="true" />
                    </a>
                    <span className="muted xs__terms">{s.terms}</span>
                    {s.use ? <span className="xs__use">{s.use}</span> : null}
                  </div>
                  <div className="xs__actions">
                    <label className="sr-only" htmlFor={`xs-lic-${s.id}`}>
                      License for {s.name}
                    </label>
                    <select id={`xs-lic-${s.id}`} className="select xs__select" value={s.license} onChange={(e) => void setLicense(s, e.target.value as ExternalLicense)}>
                      {EXTERNAL_LICENSES.map((l) => (
                        <option key={l.id} value={l.id}>
                          {l.label}
                        </option>
                      ))}
                    </select>
                    {confirm === s.id ? (
                      <>
                        <button type="button" className="btn btn--sm btn--danger" onClick={() => void remove(s)}>Remove</button>
                        <button type="button" className="btn btn--sm" onClick={() => setConfirm(undefined)}>Keep</button>
                      </>
                    ) : (
                      <button type="button" className="btn btn--sm" onClick={() => setConfirm(s.id)} aria-label={`Remove ${s.name}`}>
                        Remove
                      </button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
      {!shown.length && !res.loading ? <p className="muted">No sources match “{query}”.</p> : null}
    </div>
  );
}
