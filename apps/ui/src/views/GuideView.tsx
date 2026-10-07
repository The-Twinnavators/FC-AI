/**
 * About FlowCode: the FlowCode feature catalog, readable in the app. Areas on the left; each feature shows what it is,
 * its parts, how to use it and what it relates to, with "Show me" (a guided tour to it) and "Ask Copilot".
 * The Copilot and "Explain this feature" read from the same catalog.
 */
import { useMemo, useState } from "react";
import { FEATURE_CATALOG, LANGUAGE_SUPPORT, NEW_FOR_DAYS, isNewFeature, type Feature } from "@flowcode/contracts";
import { Compass, MessageCircle } from "lucide-react";
import { copilot } from "../components/Copilot";
import { startJourney } from "../components/CopilotDriver";
import { FEATURE_JOURNEYS, stepsJourney } from "../components/copilotJourneys";
import { get } from "../api";
import { stepTarget } from "@flowcode/contracts";

/** Show me: the cursor walks there (sidebar, card, tab) and points at it; a project feature opens your last project. */
async function showMe(f: Feature) {
  // The Copilot's own features live in its panel: open it (first drafts: with the way to ask already typed).
  if (f.area === "Copilot" && f.id !== "topbar.copilot") return copilot({ kind: "prefill", text: f.id === "copilot.drafts" ? "Help me write a skill for " : "" });
  // Features inside New build need their own walk (open the modal, go to the right step).
  const own = FEATURE_JOURNEYS[f.id];
  if (own) return startJourney({ ...own(), id: f.id }, "show");
  let projectId: string | undefined;
  if (f.route?.includes(":project")) {
    try {
      projectId = localStorage.getItem("flowcode.topbarProject") ?? undefined;
    } catch {
      projectId = undefined;
    }
    if (!projectId) {
      const list = await get<Array<{ id: string; updatedAt: string }>>("/projects").catch(() => []);
      projectId = [...list].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0]?.id;
    }
    if (!projectId) return copilot({ kind: "ask", question: `Where do I find ${f.title}?` });
  }
  startJourney({ ...stepsJourney([{ anchor: f.id, text: f.summary }], (a) => stepTarget(a, projectId)), title: `Show me: ${f.title}` }, "show");
}
import { VERSION } from "../components/AppFooter";

const WHATS_NEW = "What's new";
const NEW_FEATURES = FEATURE_CATALOG.filter((f) => isNewFeature(f));
const AREAS = [...(NEW_FEATURES.length ? [WHATS_NEW] : []), ...new Set(FEATURE_CATALOG.map((f) => f.area))];
const inArea = (a: string) => (a === WHATS_NEW ? NEW_FEATURES : FEATURE_CATALOG.filter((f) => f.area === a));
const KIND_LABEL: Record<Feature["kind"], string> = { page: "Page", section: "Section", component: "Component", action: "Action", setting: "Setting", concept: "Concept" };

export function GuideView() {
  const [area, setArea] = useState(AREAS[0]);
  const [q, setQ] = useState("");
  const [focus, setFocus] = useState<string>();
  const needle = q.trim().toLowerCase();
  const shown = useMemo(
    () =>
      needle
        ? FEATURE_CATALOG.filter((f) => `${f.title} ${f.summary} ${f.details ?? ""} ${f.keywords.join(" ")} ${(f.parts ?? []).map((p) => `${p.name} ${p.what}`).join(" ")}`.toLowerCase().includes(needle))
        : inArea(area),
    [needle, area],
  );
  const open = (id: string) => {
    const f = FEATURE_CATALOG.find((x) => x.id === id);
    if (!f) return;
    setQ("");
    setArea(f.area);
    setFocus(id);
    setTimeout(() => document.getElementById(`feat-${id}`)?.scrollIntoView({ behavior: "smooth", block: "start" }), 60);
  };
  return (
    <div className="page">
      <header className="page__head">
        <div>
          <span className="label">System · v{VERSION}</span>
          <h1 className="page__title">Feature guide</h1>
          <p className="lib__lede">
            Below is everything in FlowCode: {FEATURE_CATALOG.length} features in {AREAS.length} areas. The Copilot and &ldquo;Explain this feature&rdquo; answer from this guide. New to FlowCode? Start with <a href="#/about">About FlowCode</a>.
          </p>
        </div>
        <div className="guide-search">
          <label className="sr-only" htmlFor="guide-q">
            Search the guide
          </label>
          <input id="guide-q" className="input" placeholder="Search features, parts, settings…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
      </header>
      <div className="settings-layout guide-layout">
        <nav className="settings-nav" role="tablist" aria-orientation="vertical" aria-label="Areas">
          {AREAS.map((a) => (
            <button key={a} type="button" role="tab" aria-selected={!needle && area === a} className="settings-nav__item" onClick={() => (setQ(""), setArea(a), setFocus(undefined))}>
              <span className="settings-nav__label">{a}</span>
              {a !== WHATS_NEW && inArea(a).some((f) => isNewFeature(f)) ? (
                <span className="guide-new guide-new--dot" title={`${inArea(a).filter((f) => isNewFeature(f)).length} new`}>
                  {inArea(a).filter((f) => isNewFeature(f)).length} new
                </span>
              ) : null}
              <span className="settings-nav__count" title={`${inArea(a).length} features`}>{inArea(a).length}</span>
            </button>
          ))}
        </nav>
        <div className="settings-panel" role="tabpanel" aria-label={needle ? `Search results for ${q}` : area}>
          {needle ? <p className="muted" style={{ margin: 0 }}>{shown.length} result{shown.length === 1 ? "" : "s"} for &ldquo;{q}&rdquo;</p> : null}
          {shown.map((f) => (
            <FeatureCard key={f.id} f={f} focused={focus === f.id} onOpen={open} />
          ))}
        </div>
      </div>
    </div>
  );
}

function FeatureCard({ f, focused, onOpen }: { f: Feature; focused: boolean; onOpen: (id: string) => void }) {
  const children = FEATURE_CATALOG.filter((c) => c.parent === f.id);
  const parts = children.length ? children.map((c) => ({ name: c.title, what: c.summary, id: c.id })) : (f.parts ?? []).map((p) => ({ ...p, id: undefined as string | undefined }));
  const related = (f.related ?? []).map((r) => FEATURE_CATALOG.find((x) => x.id === r)).filter((x): x is Feature => !!x);
  return (
    <section className={`section guide-card${focused ? " is-focused" : ""}`} id={`feat-${f.id}`} aria-labelledby={`feat-${f.id}-t`}>
      <div className="section__body guide-card__body">
        <div className="guide-card__head">
          <span className="guide-card__kind">{KIND_LABEL[f.kind]}</span>
          {isNewFeature(f) ? (
            <span className="guide-new" title={`Added ${new Date(`${f.added}T00:00:00`).toLocaleDateString()}; marked new for ${NEW_FOR_DAYS} days`}>
              New
            </span>
          ) : null}
          <h2 className="guide-card__title" id={`feat-${f.id}-t`}>
            {f.title}
          </h2>
          <span className="guide-card__actions">
            <button type="button" className="btn btn--sm" onClick={() => void showMe(f)} title="The Copilot's cursor takes you there">
              <Compass size={14} aria-hidden="true" /> Show me
            </button>
            <button type="button" className="btn btn--sm btn--ghost" onClick={() => copilot({ kind: "explain", anchor: f.id })}>
              <MessageCircle size={14} aria-hidden="true" /> Ask Copilot
            </button>
          </span>
        </div>
        <p className="guide-card__summary">{f.summary}</p>
        {f.details ? <p className="guide-card__details">{f.details}</p> : null}
        {f.id === "concept.languages" ? <LanguageTable /> : null}
        {parts.length ? (
          <div>
            <h3 className="guide-card__h">What&apos;s in it</h3>
            <ul className="guide-card__parts">
              {parts.map((p) => (
                <li key={p.name}>
                  {p.id ? (
                    <button type="button" className="link-btn" onClick={() => onOpen(p.id!)}>
                      {p.name}
                    </button>
                  ) : (
                    <strong>{p.name}</strong>
                  )}{" "}
                  <span className="muted">— {p.what}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        {f.howTo?.length ? (
          <div>
            <h3 className="guide-card__h">How to use it</h3>
            <ol className="guide-card__steps">
              {f.howTo.map((h) => (
                <li key={h}>{h}</li>
              ))}
            </ol>
          </div>
        ) : null}
        {related.length ? (
          <p className="guide-card__related">
            Related:{" "}
            {related.map((r, i) => (
              <span key={r.id}>
                {i ? ", " : ""}
                <button type="button" className="link-btn" onClick={() => onOpen(r.id)}>
                  {r.title}
                </button>
              </span>
            ))}
          </p>
        ) : null}
      </div>
    </section>
  );
}

const LEVEL: Record<(typeof LANGUAGE_SUPPORT)[number]["level"], string> = { full: "Checked automatically", partial: "Partly checked", weak: "Mostly manual" };

/** Languages FlowCode writes and how much it checks on its own (How builds work → Languages and checks). */
function LanguageTable() {
  return (
    <div className="lang-table" role="region" aria-label="Languages FlowCode writes and checks" tabIndex={0}>
      <table>
        <thead>
          <tr>
            <th scope="col">Language</th>
            <th scope="col">Writes it</th>
            <th scope="col">Checks it automatically</th>
          </tr>
        </thead>
        <tbody>
          {LANGUAGE_SUPPORT.map((r) => (
            <tr key={r.language}>
              <th scope="row">{r.language}</th>
              <td>{r.writes}</td>
              <td>
                <span className={`lang-level lang-level--${r.level}`}>
                  <span className="lang-level__dot" aria-hidden="true" />
                  {LEVEL[r.level]}
                </span>
                <span className="lang-table__checks">{r.checks}</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
