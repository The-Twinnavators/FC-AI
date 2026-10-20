/**
 * Settings → Speed & recovery: try a fast local model first, and what FlowCode does on its own when a run gets stuck.
 */
import { useEffect, useState } from "react";
import { post, useResource } from "../api";
import "../styles/settings-groups.css";

interface Options {
  fastModel: { enabled: boolean; model: string; tries?: number };
  rollbackBlocked: boolean;
  autoRetry: boolean;
  investigationBudget?: number;
  visualCritic?: "off" | "advisory";
  routineThinking?: boolean;
  gpuProfile?: "standard" | "8gb";
  profileContext?: number;
  coderCorrections?: number;
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
      <div className="section__body sg">
        {/* Grouped by what they're about; each row is one setting: what it does in a line, its control on the right. */}
        <Group title="Speed">
          <Toggle
            label="Try a fast model first"
            hint="Each coding step starts on a smaller model; the main coder takes over if it doesn't pass."
            checked={o.fastModel.enabled}
            onChange={(v) => void update({ fastModel: { ...o.fastModel, enabled: v } })}
          />
          {o.fastModel.enabled ? (
            <>
              <Choice id="rt-fast" label="Fast model" hint="Pick one that fits your graphics card." sub>
                <select id="rt-fast" className="select" value={o.fastModel.model} onChange={(e) => void update({ fastModel: { ...o.fastModel, model: e.target.value } })}>
                  {[...new Set([o.fastModel.model, ...names])].map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
              </Choice>
              <Choice id="rt-fast-tries" label="Fast model tries" hint="Tries before the main coder takes over." sub>
                <select id="rt-fast-tries" className="select" value={o.fastModel.tries ?? 2} onChange={(e) => void update({ fastModel: { ...o.fastModel, tries: Number(e.target.value) } })}>
                  <option value={1}>1 (write only)</option>
                  <option value={2}>2 (write, then repair)</option>
                  <option value={3}>3</option>
                </select>
              </Choice>
            </>
          ) : null}
          <Toggle
            label="Thinking on routine coding"
            hint="Off is several times faster on a local model, with the same results on routine edits. The debugger always thinks."
            checked={!!o.routineThinking}
            onChange={(v) => void update({ routineThinking: v })}
          />
          <Choice id="rt-gpu" label="Graphics card" hint={o.gpuProfile === "8gb" ? "8 GB: one local model request at a time, smaller support models, a fixed coding context." : "Standard: no limits for a smaller graphics card."}>
            <select id="rt-gpu" className="select" value={o.gpuProfile ?? "standard"} onChange={(e) => void update({ gpuProfile: e.target.value as "standard" | "8gb" })}>
              <option value="standard">Standard</option>
              <option value="8gb">8 GB</option>
            </select>
          </Choice>
          {o.gpuProfile === "8gb" ? (
            <Choice id="rt-ctx" label="Coding context" hint="How much code the coder sees at once." sub>
              <select id="rt-ctx" className="select" value={o.profileContext ?? 16384} onChange={(e) => void update({ profileContext: Number(e.target.value) })}>
                <option value={12288}>12k (all on the GPU)</option>
                <option value={16384}>16k</option>
              </select>
            </Choice>
          ) : null}
        </Group>

        <Group title="When a step fails">
          <Choice id="rt-corrections" label="Coder corrections first" hint="A clear error (a type error, a failing test) goes back to the coder this many times before the debugger takes over.">
            <select id="rt-corrections" className="select" value={o.coderCorrections ?? 2} onChange={(e) => void update({ coderCorrections: Number(e.target.value) })}>
              <option value={0}>None</option>
              <option value={1}>1</option>
              <option value={2}>2</option>
              <option value={3}>3</option>
            </select>
          </Choice>
          <Toggle
            label="Retry once with a clearer request"
            hint="FlowCode rewrites the request (files, names, what not to change) and tries again. Not in Guided projects."
            checked={o.autoRetry}
            onChange={(v) => void update({ autoRetry: v })}
          />
          <Choice id="rt-investigate" label="Files read before a stuck step reports" hint="Automatic: 40 on a local model, 120 on a cloud one. Then the step says where it stands.">
            <select id="rt-investigate" className="select" value={o.investigationBudget ?? 0} onChange={(e) => void update({ investigationBudget: Number(e.target.value) })}>
              <option value={0}>Automatic</option>
              <option value={20}>20 files</option>
              <option value={60}>60 files</option>
              <option value={120}>120 files</option>
            </select>
          </Choice>
          <Toggle
            label="Undo half-finished steps when a build gets stuck"
            hint="Steps that passed are kept, and everything can be restored from the Review tab."
            checked={o.rollbackBlocked}
            onChange={(v) => void update({ rollbackBlocked: v })}
          />
        </Group>

        <Group title="Design review">
          <Toggle
            label="AI design notes"
            hint="A vision model leaves notes on the screenshots for your review. They never send a step back."
            checked={o.visualCritic === "advisory"}
            onChange={(v) => void update({ visualCritic: v ? "advisory" : "off" })}
          />
        </Group>

        <p className="sg__foot">
          Always on: measured design checks (contrast, overflow, placeholder text), refusing rewrites that look cut off, and swapping checks no file could pass for the type check.
          {saved ? <span role="status"> {saved}</span> : null}
        </p>
      </div>
    </section>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <fieldset className="sg__group">
      <legend className="sg__title">{title}</legend>
      <div className="sg__rows">{children}</div>
    </fieldset>
  );
}

function Toggle({ label, hint, checked, onChange }: { label: string; hint: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="sg__row">
      <span className="sg__text">
        <strong>{label}</strong>
        <span>{hint}</span>
      </span>
      <input type="checkbox" className="sg__switch" checked={checked} onChange={(e) => onChange(e.target.checked)} />
    </label>
  );
}

function Choice({ id, label, hint, sub, children }: { id: string; label: string; hint: string; sub?: boolean; children: React.ReactNode }) {
  return (
    <div className={`sg__row${sub ? " sg__row--sub" : ""}`}>
      <span className="sg__text">
        <label htmlFor={id}>
          <strong>{label}</strong>
        </label>
        <span>{hint}</span>
      </span>
      <span className="sg__control">{children}</span>
    </div>
  );
}
