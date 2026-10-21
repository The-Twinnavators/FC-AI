/**
 * A design proof, drawn (proof-preview.html, framed by the design review): the main screen's composition from the
 * proof (its frame, layout and content blocks, in the project's words) in the proof's own tokens, fonts and surface
 * style. FlowCode's own drawing of a proposal, not a built app: the build applies the same specification.
 */
import { createRoot } from "react-dom/client";
import type { ProofBlock, ProofScreen } from "@flowcode/contracts";
import { previewBaseCss } from "./libraryStyle";

interface ProofMessage {
  type: "fl-proof";
  screen: ProofScreen;
  tokens: Record<string, string>;
}

const CSS = `
html,body{margin:0;background:var(--color-bg);color:var(--color-text);font-family:var(--font-sans);font-size:var(--text-md,1rem);line-height:1.5;-webkit-font-smoothing:antialiased}
*,*::before,*::after{box-sizing:border-box}
h1,h2,h3{font-family:var(--font-display);font-weight:var(--heading-weight,600);letter-spacing:var(--tracking-tight,-0.01em);margin:0;line-height:1.15}
p{margin:0}
.pf{min-height:100vh;display:flex;flex-direction:column}
.pf--side{flex-direction:row}
.pf-top{display:flex;align-items:center;gap:var(--space-6,2rem);padding:var(--space-4,1rem) var(--space-6,2rem);border-bottom:var(--border-width,1px) solid var(--color-border);background:var(--color-surface)}
.pf-brand{font-family:var(--font-display);font-weight:var(--heading-weight,700);font-size:var(--text-lg,1.25rem)}
.pf-top nav{display:flex;gap:var(--space-5,1.5rem);color:var(--color-text-muted);font-size:var(--text-sm,.875rem)}
.pf-top nav span:first-child,.pf-side nav span:first-child{color:var(--color-text);font-weight:600}
.pf-avatar{margin-left:auto;width:32px;height:32px;border-radius:50%;background:var(--color-secondary,var(--color-accent));opacity:.85}
.pf-side{width:240px;flex:0 0 240px;padding:var(--space-6,2rem) var(--space-4,1rem);border-right:var(--border-width,1px) solid var(--color-border);background:var(--color-surface-sunken,var(--color-surface));display:flex;flex-direction:column;gap:var(--space-6,2rem)}
.pf-side nav{display:grid;gap:var(--space-1,.25rem);font-size:var(--text-sm,.875rem);color:var(--color-text-muted)}
.pf-side nav span{padding:var(--space-2,.5rem) var(--space-3,.75rem);border-radius:var(--radius-md,6px)}
.pf-side nav span:first-child{background:color-mix(in srgb,var(--color-accent) 14%,transparent)}
.pf-min{padding:var(--space-4,1rem) var(--space-6,2rem)}
.pf-body{flex:1;min-width:0;padding:var(--space-7,3rem) var(--space-6,2rem)}
.pf-inner{max-width:var(--content-max,72rem);margin:0 auto;display:grid;gap:var(--space-6,2rem)}
.pf-cols{display:grid;gap:var(--space-6,2rem);align-items:start}
.pf-cols--main-aside{grid-template-columns:minmax(0,2fr) minmax(0,1fr)}
.pf-cols--split{grid-template-columns:minmax(0,1fr) minmax(0,1fr)}
.pf-stack{display:grid;gap:var(--space-6,2rem);min-width:0}
.pf-card{background:var(--color-surface);border:var(--border-width,1px) solid var(--color-border);border-radius:var(--radius-lg,10px);box-shadow:var(--surface-shadow,none);padding:var(--space-5,1.5rem)}
.pf-h2{font-size:var(--text-xl,1.5rem);margin-bottom:var(--space-4,1rem)}
.pf-muted{color:var(--color-text-muted)}
.pf-small{font-size:var(--text-sm,.875rem)}
.pf-btn{display:inline-flex;align-items:center;height:40px;padding:0 var(--space-5,1.25rem);border-radius:var(--radius-md,8px);background:var(--accent-bg,var(--color-accent));color:var(--color-on-accent);font-weight:600;font-size:var(--text-sm,.875rem);border:var(--button-border,0)}
.pf-btn--ghost{background:transparent;color:var(--color-text);border:var(--border-width,1px) solid var(--color-border-strong)}
.pf-eyebrow{text-transform:uppercase;letter-spacing:.08em;font-size:.75rem;font-weight:700;color:var(--color-accent)}
.pf-intro{display:grid;gap:var(--space-4,1rem)}
.pf-intro h1{font-size:var(--text-3xl,2.5rem)}
.pf-intro--banner{padding:var(--space-7,3rem);border-radius:var(--radius-xl,12px);background:linear-gradient(135deg,color-mix(in srgb,var(--color-accent) 22%,var(--color-surface)),var(--color-surface));border:var(--border-width,1px) solid var(--color-border)}
.pf-intro--centered{text-align:center;justify-items:center;padding:var(--space-6,2rem) 0}
.pf-intro--compact{grid-template-columns:1fr auto;align-items:end}
.pf-intro--compact h1{font-size:var(--text-2xl,2rem)}
.pf-intro--split{grid-template-columns:1.1fr .9fr;align-items:center;gap:var(--space-7,3rem)}
.pf-art{aspect-ratio:4/3;border-radius:var(--radius-xl,12px);background:color-mix(in srgb,var(--color-secondary,var(--color-accent)) 18%,var(--color-surface));position:relative;overflow:hidden;border:var(--border-width,1px) solid var(--color-border)}
.pf-art i{position:absolute;border-radius:var(--radius-lg,10px);background:var(--color-surface);box-shadow:var(--surface-shadow,none);border:1px solid var(--color-border)}
.pf-art i:nth-child(1){left:10%;top:14%;width:58%;height:30%}
.pf-art i:nth-child(2){left:26%;top:52%;width:62%;height:32%}
.pf-art i:nth-child(3){right:8%;top:8%;width:18%;height:18%;border-radius:50%;background:var(--color-accent);border:0}
.pf-actions{display:flex;gap:var(--space-3,.75rem);flex-wrap:wrap}
.pf-grid{display:grid;gap:var(--space-4,1rem)}
.pf-tag{display:inline-block;padding:2px 10px;border-radius:999px;background:color-mix(in srgb,var(--color-accent) 14%,transparent);color:var(--color-text);font-size:.75rem;font-weight:600}
.pf-list{display:grid}
.pf-row{display:flex;align-items:center;gap:var(--space-4,1rem);padding:var(--space-3,.75rem) 0;border-bottom:var(--border-width,1px) solid var(--color-border)}
.pf-row:last-child{border-bottom:0}
.pf-row strong{flex:1;font-weight:600}
.pf-sched{display:grid;gap:var(--space-3,.75rem)}
.pf-sched__day{display:grid;gap:var(--space-2,.5rem);align-content:start}
.pf-sched__d{font-size:var(--text-sm,.875rem);font-weight:700;color:var(--color-text-muted);padding-bottom:var(--space-2,.5rem);border-bottom:2px solid var(--color-border)}
.pf-slot{padding:var(--space-3,.75rem);border-radius:var(--radius-md,8px);background:color-mix(in srgb,var(--color-accent) 10%,var(--color-surface));border-left:3px solid var(--color-accent);display:grid;gap:2px}
.pf-slot b{font-size:var(--text-sm,.875rem)}
.pf-stats{display:grid;gap:var(--space-4,1rem)}
.pf-stat strong{display:block;font-family:var(--font-display);font-size:var(--text-2xl,2rem);font-weight:var(--heading-weight,700)}
.pf-form{display:grid;gap:var(--space-4,1rem)}
.pf-field{display:grid;gap:6px;font-size:var(--text-sm,.875rem);font-weight:600}
.pf-field span{height:40px;border-radius:var(--radius-md,8px);border:var(--border-width,1px) solid var(--color-border-strong);background:var(--color-bg)}
.pf-field--textarea span{height:84px}
.pf-table{width:100%;border-collapse:collapse;font-size:var(--text-sm,.875rem)}
.pf-table th{text-align:left;color:var(--color-text-muted);font-weight:600;padding:var(--space-2,.5rem) var(--space-3,.75rem);border-bottom:2px solid var(--color-border)}
.pf-table td{padding:var(--space-3,.75rem);border-bottom:var(--border-width,1px) solid var(--color-border)}
.pf-chips{display:flex;gap:var(--space-2,.5rem);flex-wrap:wrap}
.pf-chip{padding:6px 14px;border-radius:999px;border:var(--border-width,1px) solid var(--color-border-strong);font-size:var(--text-sm,.875rem)}
.pf-chip:first-child{background:var(--color-accent);color:var(--color-on-accent);border-color:var(--color-accent)}
.pf-bullets{margin:var(--space-3,.75rem) 0 0;padding-left:1.1em;display:grid;gap:4px}
`;

function Block({ b }: { b: ProofBlock }) {
  switch (b.kind) {
    case "intro":
      return (
        <section className={`pf-intro pf-intro--${b.variant}`}>
          <div className="pf-intro" style={b.variant === "compact" ? undefined : { gap: "var(--space-4,1rem)" }}>
            {b.eyebrow ? <span className="pf-eyebrow">{b.eyebrow}</span> : null}
            <h1>{b.title}</h1>
            {b.body ? <p className="pf-muted" style={{ maxWidth: "60ch", fontSize: "var(--text-lg,1.125rem)" }}>{b.body}</p> : null}
            {b.variant !== "compact" && (b.action || b.secondary) ? (
              <div className="pf-actions">
                {b.action ? <span className="pf-btn">{b.action}</span> : null}
                {b.secondary ? <span className="pf-btn pf-btn--ghost">{b.secondary}</span> : null}
              </div>
            ) : null}
          </div>
          {b.variant === "compact" && b.action ? <span className="pf-btn">{b.action}</span> : null}
          {b.variant === "split" ? <div className="pf-art" aria-hidden="true"><i /><i /><i /></div> : null}
        </section>
      );
    case "cards":
      return (
        <section>
          {b.title ? <h2 className="pf-h2">{b.title}</h2> : null}
          <div className="pf-grid" style={{ gridTemplateColumns: `repeat(${b.columns}, minmax(0,1fr))` }}>
            {b.items.map((x, i) => (
              <article key={i} className="pf-card" style={{ display: "grid", gap: 8 }}>
                {x.tag ? <span className="pf-tag" style={{ justifySelf: "start" }}>{x.tag}</span> : null}
                <h3 style={{ fontSize: "var(--text-lg,1.25rem)" }}>{x.title}</h3>
                {x.body ? <p className="pf-muted pf-small">{x.body}</p> : null}
                {x.meta ? <p className="pf-small" style={{ fontWeight: 600 }}>{x.meta}</p> : null}
              </article>
            ))}
          </div>
        </section>
      );
    case "list":
      return (
        <section className="pf-card">
          {b.title ? <h2 className="pf-h2">{b.title}</h2> : null}
          <div className="pf-list">
            {b.items.map((x, i) => (
              <div key={i} className="pf-row">
                <strong>{x.title}</strong>
                {x.meta ? <span className="pf-muted pf-small">{x.meta}</span> : null}
                {x.status ? <span className="pf-tag">{x.status}</span> : null}
              </div>
            ))}
          </div>
        </section>
      );
    case "schedule":
      return (
        <section className="pf-card">
          {b.title ? <h2 className="pf-h2">{b.title}</h2> : null}
          <div className="pf-sched" style={{ gridTemplateColumns: `repeat(${b.days.length}, minmax(0,1fr))` }}>
            {b.days.map((d) => (
              <div key={d} className="pf-sched__day">
                <span className="pf-sched__d">{d}</span>
                {b.items.filter((x) => x.day === d).map((x, i) => (
                  <div key={i} className="pf-slot">
                    <span className="pf-small pf-muted">{x.time}</span>
                    <b>{x.title}</b>
                    {x.meta ? <span className="pf-small pf-muted">{x.meta}</span> : null}
                  </div>
                ))}
              </div>
            ))}
          </div>
        </section>
      );
    case "stats":
      return (
        <section className="pf-stats" style={{ gridTemplateColumns: `repeat(${b.items.length}, minmax(0,1fr))` }}>
          {b.items.map((x, i) => (
            <div key={i} className="pf-card pf-stat">
              <span className="pf-muted pf-small">{x.label}</span>
              <strong>{x.value}</strong>
              {x.note ? <span className="pf-muted pf-small">{x.note}</span> : null}
            </div>
          ))}
        </section>
      );
    case "form":
      return (
        <section className="pf-card pf-form">
          <h2 className="pf-h2" style={{ marginBottom: 0 }}>{b.title}</h2>
          {b.fields.map((f, i) => (
            <label key={i} className={`pf-field${f.type === "textarea" ? " pf-field--textarea" : ""}`}>
              {f.label}
              <span />
            </label>
          ))}
          <span className="pf-btn" style={{ justifySelf: "start" }}>{b.action}</span>
        </section>
      );
    case "table":
      return (
        <section className="pf-card">
          {b.title ? <h2 className="pf-h2">{b.title}</h2> : null}
          <table className="pf-table">
            <thead><tr>{b.columns.map((c) => <th key={c}>{c}</th>)}</tr></thead>
            <tbody>{b.rows.map((r, i) => <tr key={i}>{b.columns.map((_, k) => <td key={k}>{r[k] ?? ""}</td>)}</tr>)}</tbody>
          </table>
        </section>
      );
    case "feature":
      return (
        <section className="pf-card">
          <h2 className="pf-h2">{b.title}</h2>
          <p className="pf-muted">{b.body}</p>
          {b.bullets?.length ? <ul className="pf-bullets">{b.bullets.map((x, i) => <li key={i}>{x}</li>)}</ul> : null}
        </section>
      );
    case "callout":
      return (
        <section className="pf-card" style={{ background: "color-mix(in srgb, var(--color-accent) 12%, var(--color-surface))", display: "grid", gap: 12 }}>
          <h2 style={{ fontSize: "var(--text-xl,1.5rem)" }}>{b.title}</h2>
          {b.body ? <p className="pf-muted">{b.body}</p> : null}
          {b.action ? <span className="pf-btn" style={{ justifySelf: "start" }}>{b.action}</span> : null}
        </section>
      );
    case "filters":
      return <div className="pf-chips">{b.chips.map((c) => <span key={c} className="pf-chip">{c}</span>)}</div>;
    case "detail":
      return (
        <section className="pf-card" style={{ display: "grid", gap: 10 }}>
          <h2 style={{ fontSize: "var(--text-xl,1.5rem)" }}>{b.title}</h2>
          {b.meta ? <p className="pf-small" style={{ fontWeight: 600 }}>{b.meta}</p> : null}
          <p className="pf-muted">{b.body}</p>
          {b.action ? <span className="pf-btn" style={{ justifySelf: "start" }}>{b.action}</span> : null}
        </section>
      );
  }
}

function Screen({ s }: { s: ProofScreen }) {
  const main = s.main.map((b, i) => <Block key={i} b={b} />);
  const aside = (s.aside ?? []).map((b, i) => <Block key={`a${i}`} b={b} />);
  // A split screen without an aside splits its own blocks in two.
  const half = Math.ceil(main.length / 2);
  const body =
    s.layout === "single" || (s.layout === "main-aside" && !aside.length) ? (
      <div className="pf-stack">{[...main, ...aside]}</div>
    ) : (
      <div className={`pf-cols pf-cols--${s.layout}`}>
        <div className="pf-stack">{aside.length ? main : main.slice(0, half)}</div>
        <div className="pf-stack">{aside.length ? aside : main.slice(half)}</div>
      </div>
    );
  return (
    <div className={`pf${s.frame === "side-nav" ? " pf--side" : ""}`}>
      {s.frame === "top-nav" ? (
        <header className="pf-top">
          <span className="pf-brand">{s.product}</span>
          <nav>{s.nav.map((n) => <span key={n}>{n}</span>)}</nav>
          <span className="pf-avatar" />
        </header>
      ) : s.frame === "side-nav" ? (
        <aside className="pf-side">
          <span className="pf-brand">{s.product}</span>
          <nav>{s.nav.map((n) => <span key={n}>{n}</span>)}</nav>
        </aside>
      ) : (
        <header className="pf-min"><span className="pf-brand">{s.product}</span></header>
      )}
      <main className="pf-body">
        <div className="pf-inner">{body}</div>
      </main>
    </div>
  );
}

const root = createRoot(document.getElementById("root")!);
let style: HTMLStyleElement | undefined;
window.addEventListener("message", (e: MessageEvent<ProofMessage>) => {
  if (e.origin !== location.origin || e.data?.type !== "fl-proof") return;
  const m = e.data;
  if (!style) {
    style = document.createElement("style");
    document.head.appendChild(style);
  }
  // FlowCode's bundled fonts and base tokens, the proof's surface style, then the proof's own tokens on top.
  style.textContent = [previewBaseCss("", ""), CSS, `:root{${Object.entries(m.tokens).map(([k, v]) => `${k}:${v}`).join(";")}}`].join("\n\n");
  root.render(<Screen s={m.screen} />);
});
parent.postMessage({ type: "fl-proof-ready" }, location.origin);
