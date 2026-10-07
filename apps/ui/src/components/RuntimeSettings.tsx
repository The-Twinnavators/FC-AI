/**
 * Settings → Speed & recovery: try a fast local model first, and what FlowCode does on its own when a run gets stuck.
 */
import { useEffect, useState } from "react";
import { post, useResource } from "../api";

interface Options {
  fastModel: { enabled: boolean; model: string; tries?: number };
  rollbackBlocked: boolean;
  autoRetry: boolean;
}

export function RuntimeSettings() {
  const res = useResource<Options>("/settings/runtime");
  const models = useResource<Array<{ name?: string; id?: string; model?: string } | string>>("/models/providers/ollama/models");
  const [o, setO] = useState<Options>();
  const [saved, setSaved] = useState<string>();
  useEffect(() => {
    if (res.data) setO(res.data);
  }, [res.data]);
  const names = (models.data ?? []).map((m) => (typeof m === "string" ? m : (m.name ?? m.model ?? m.id ?? ""))).filter((n) => n && !/embed/i.test(n));
  const update = async (patch: Partial<Options>) => {
    if (!o) return;
    const next = { ...o, ...patch, fastModel: { ...o.fastModel, ...(patch.fastModel ?? {}) } };
    setO(next);
    await post("/settings/runtime", patch);
    setSaved("Saved. Applies to the next step FlowCode starts.");
  };
  if (!o) return null;
  return (
    <section className="section" aria-labelledby="runtime-title">
      <div className="section__head">
        <h2 className="section__title" id="runtime-title">
          Speed &amp; recovery
        </h2>
      </div>
      <div className="section__body rt">
        <label className="rt__row">
          <input type="checkbox" checked={o.fastModel.enabled} onChange={(e) => void update({ fastModel: { ...o.fastModel, enabled: e.target.checked } })} />
          <span>
            <strong>Try a fast model first</strong>
            <span className="muted">Each coding step starts on a smaller model that fits your graphics card. The project&apos;s main coder model only takes over after the fast model&apos;s tries don&apos;t pass.</span>
          </span>
        </label>
        {o.fastModel.enabled ? (
          <div className="rt__sub">
            <label className="label" htmlFor="rt-fast">
              Fast model
            </label>
            <select id="rt-fast" className="select" value={o.fastModel.model} onChange={(e) => void update({ fastModel: { ...o.fastModel, model: e.target.value } })}>
              {[...new Set([o.fastModel.model, ...names])].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
            <label className="label" htmlFor="rt-fast-tries">
              Fast model tries before the main model
            </label>
            <select id="rt-fast-tries" className="select" value={o.fastModel.tries ?? 2} onChange={(e) => void update({ fastModel: { ...o.fastModel, tries: Number(e.target.value) } })}>
              <option value={1}>1 (write only)</option>
              <option value={2}>2 (write, then repair)</option>
              <option value={3}>3</option>
            </select>
          </div>
        ) : null}
        <label className="rt__row">
          <input type="checkbox" checked={o.rollbackBlocked} onChange={(e) => void update({ rollbackBlocked: e.target.checked })} />
          <span>
            <strong>Undo half-finished steps when a run gets stuck</strong>
            <span className="muted">Steps that passed are kept. Everything can still be restored from the Review tab.</span>
          </span>
        </label>
        <label className="rt__row">
          <input type="checkbox" checked={o.autoRetry} onChange={(e) => void update({ autoRetry: e.target.checked })} />
          <span>
            <strong>Retry once with a clearer request</strong>
            <span className="muted">FlowCode rewrites the request more precisely (files, names, what not to change) and tries once more. Never in Supervised projects.</span>
          </span>
        </label>
        <p className="muted" style={{ margin: 0, fontSize: 12.5 }}>
          Always on: rewrites that look cut off are refused, and checks no file could ever pass are swapped for the type check.
        </p>
        {saved ? (
          <p className="muted" role="status" style={{ margin: 0, fontSize: 12.5 }}>
            {saved}
          </p>
        ) : null}
      </div>
    </section>
  );
}
