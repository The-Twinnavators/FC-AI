/**
 * Screens: every screen in the app, whether a design step has given it dedicated attention, pairs that look like they
 * do the same job (flagged for you to judge, never merged), and reusable screen specs that later design steps build to.
 * Drafting a spec uses a local model and saves nothing until you choose Save.
 */
import { useState } from "react";
import { post, useResource } from "../api";
import { ErrorNotice } from "./ui";

interface Spec {
  goal: string;
  primaryAction: string;
  hierarchy: string[];
  layout: string;
  responsive: string;
  components: string[];
  tokens: string[];
  copy: string[];
  data: string;
  states: { loading: string; empty: string; error: string; success?: string };
  accessibility: string[];
  icons: string;
  acceptance: string[];
  source?: string;
  updatedAt?: string;
}
interface Coverage {
  screens: Array<{ id: string; label?: string; file?: string; inNav: boolean; hasSpec: boolean; designedBy: Array<{ title: string; status: string; focus: "dedicated" | "broad" }> }>;
  uncovered: string[];
  similar: Array<{ a: string; b: string; why: string }>;
  specs: Record<string, Spec>;
}

export function ScreenCoverage({ projectId }: { projectId: string }) {
  const res = useResource<Coverage>(`/projects/${projectId}/screens`, [projectId]);
  const [draft, setDraft] = useState<{ id: string; spec: Spec } | null>(null);
  const [busy, setBusy] = useState<string>();
  const [error, setError] = useState<string>();
  const c = res.data;
  if (!c || !c.screens.length) return null;
  const makeDraft = async (id: string) => {
    setBusy(id);
    setError(undefined);
    try {
      setDraft({ id, spec: await post<Spec>(`/projects/${projectId}/screens/${encodeURIComponent(id)}/spec/draft`, {}) });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(undefined);
    }
  };
  const save = async () => {
    if (!draft) return;
    setBusy(draft.id);
    try {
      await post(`/projects/${projectId}/screens/${encodeURIComponent(draft.id)}/spec`, draft.spec);
      setDraft(null);
      res.reload();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(undefined);
    }
  };
  return (
    <section className="scov" aria-labelledby="scov-title">
      <h3 className="scov__title" id="scov-title">
        Screens
      </h3>
      <p className="scov__lede">
        {c.uncovered.length ? `${c.uncovered.length} of ${c.screens.length} screens haven't had a design step of their own.` : "Every screen has had a design step of its own or has a spec."} A spec gives a screen a clear job, layout and states that later design steps build to.
      </p>
      {c.similar.map((s) => (
        <p key={`${s.a}-${s.b}`} className="scov__similar" role="note">
          <strong>
            “{s.a}” and “{s.b}” may overlap.
          </strong>{" "}
          {s.why}
        </p>
      ))}
      {error ? <ErrorNotice error={error} doing="write that spec" /> : null}
      <ul className="scov__list">
        {c.screens.map((s) => {
          const dedicated = s.designedBy.filter((d) => d.focus === "dedicated" && d.status === "verified");
          const broad = s.designedBy.filter((d) => d.focus === "broad" && d.status === "verified");
          return (
            <li key={s.id} className="scov__item">
              <div className="scov__head">
                <span className="scov__name">
                  <strong>{s.label ?? s.id}</strong>
                  {!s.inNav ? <span className="scov__meta">Opened from another screen</span> : <span className="scov__meta">In the app's navigation</span>}
                </span>
                <span className={`chip${s.hasSpec || dedicated.length ? " chip--ok" : " chip--notes"}`}>{s.hasSpec ? "Has a spec" : dedicated.length ? "Designed" : broad.length ? "Only a broad polish pass" : "Not designed yet"}</span>
                <button type="button" className="btn btn--sm scov__act" disabled={!!busy} onClick={() => void makeDraft(s.id)}>
                  {busy === s.id ? "Drafting…" : s.hasSpec ? "Redraft spec" : "Draft a spec"}
                </button>
              </div>
              {s.hasSpec && c.specs[s.id] ? <p className="muted scov__goal">{c.specs[s.id].goal}</p> : null}
              {draft?.id === s.id ? (
                <div className="scov__draft">
                  <p className="muted">Draft from {draft.spec.source ?? "a local model"}. Check it, then save; design steps for this screen will build to it.</p>
                  <dl className="imp__facts">
                    <dt>Goal</dt>
                    <dd>{draft.spec.goal}</dd>
                    <dt>Primary action</dt>
                    <dd>{draft.spec.primaryAction}</dd>
                    <dt>Most important first</dt>
                    <dd>{draft.spec.hierarchy.join(" → ")}</dd>
                    <dt>Layout</dt>
                    <dd>{draft.spec.layout}</dd>
                    <dt>Narrow screens</dt>
                    <dd>{draft.spec.responsive}</dd>
                    <dt>States</dt>
                    <dd>
                      Loading: {draft.spec.states.loading} · Empty: {draft.spec.states.empty} · Error: {draft.spec.states.error}
                    </dd>
                    <dt>Done when</dt>
                    <dd>{draft.spec.acceptance.join("; ")}</dd>
                  </dl>
                  <div className="imp__actions">
                    <button type="button" className="btn btn--sm btn--primary" disabled={!!busy} onClick={() => void save()}>
                      Save spec
                    </button>
                    <button type="button" className="btn btn--sm" onClick={() => setDraft(null)}>
                      Discard
                    </button>
                  </div>
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
