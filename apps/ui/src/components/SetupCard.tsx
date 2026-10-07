/**
 * First-run setup: shown until this computer can build, with the one next step in plain words (install or start
 * Ollama, download a model, test it as the coder, use it). Checks again on its own every few seconds, so each step
 * ticks off as you do it. Hidden once everything is ready.
 */
import { useState } from "react";
import { post, useResource } from "../api";

type Status = {
  step: "start-ollama" | "install-ollama" | "pull-model" | "test-coder" | "testing" | "use-coder" | "ready";
  ready: boolean;
  ollama: { running: boolean; installed: boolean };
  models: Array<{ name: string; sizeGb: number; tools: boolean }>;
  coder: { model: string; installed: boolean; eligible: boolean };
  candidate?: { model: string; sizeGb: number };
  recommend: { model: string; sizeGb: number; why: string; lighter?: { model: string; sizeGb: number; why: string } };
  testing?: { model: string; since: string };
  lastError?: string;
};

const STEPS = [
  { id: "ollama", label: "Ollama running" },
  { id: "model", label: "A model downloaded" },
  { id: "test", label: "Coder test passed" },
] as const;

function Copy({ text }: { text: string }) {
  const [done, setDone] = useState(false);
  return (
    <span className="setup__cmd">
      <code>{text}</code>
      <button
        type="button"
        className="btn btn--sm btn--ghost"
        onClick={() => {
          void navigator.clipboard?.writeText(text).then(() => setDone(true), () => undefined);
          setTimeout(() => setDone(false), 1500);
        }}
      >
        {done ? "Copied" : "Copy"}
      </button>
    </span>
  );
}

export function SetupCard({ compact }: { compact?: boolean }) {
  const res = useResource<Status>("/setup/status", [], 5000);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const s = res.data;
  if (!s || s.ready) return null;
  const done = { ollama: s.ollama.running, model: s.models.some((m) => m.tools), test: false };
  const act = async (path: string, model: string) => {
    setBusy(true);
    setError(undefined);
    try {
      const r = await post<{ ok?: boolean; reason?: string }>(path, { model });
      if (r?.ok === false) setError(r.reason);
      res.reload();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const mins = s.testing ? Math.max(0, Math.round((Date.now() - Date.parse(s.testing.since)) / 60_000)) : 0;
  return (
    <section className={`setup${compact ? " setup--compact" : ""}`} data-cp="setup-card" aria-labelledby="setup-h">
      <div className="setup__head">
        <div>
          <h2 id="setup-h">Set up FlowCode to build on this computer</h2>
          <p className="setup__lede">FlowCode runs AI models on your own computer with Ollama, a free program. A few steps, once.</p>
        </div>
      </div>
      <ol className="setup__steps" aria-label="Setup steps">
        {STEPS.map((st) => (
          <li key={st.id} className={done[st.id] ? "is-done" : ""}>
            <span className="setup__tick" aria-hidden="true">{done[st.id] ? "✓" : ""}</span>
            {st.label}
          </li>
        ))}
      </ol>
      <div className="setup__now">
        {s.step === "install-ollama" ? (
          <>
            <strong>1. Install Ollama.</strong>
            <p>Download it from ollama.com and run the installer. It then runs in the background (look for its icon by the clock). This card checks again by itself.</p>
            <a className="btn btn--sm btn--primary" href="https://ollama.com/download" target="_blank" rel="noreferrer">
              Download Ollama
            </a>
          </>
        ) : s.step === "start-ollama" ? (
          <>
            <strong>1. Start Ollama.</strong>
            <p>Ollama is installed but not running. Open it from the Start menu; this card notices within a few seconds.</p>
          </>
        ) : s.step === "pull-model" ? (
          <>
            <strong>2. Download a model.</strong>
            <p>
              In a terminal, run this ({s.recommend.sizeGb} GB download). {s.recommend.why}
            </p>
            <Copy text={`ollama pull ${s.recommend.model}`} />
            {s.recommend.lighter ? (
              <p className="setup__alt">
                Or a lighter one ({s.recommend.lighter.sizeGb} GB): <Copy text={`ollama pull ${s.recommend.lighter.model}`} /> {s.recommend.lighter.why}
              </p>
            ) : null}
            <p className="setup__alt">Optional, for the visual review of your screens: <Copy text="ollama pull qwen2.5vl:3b" /></p>
          </>
        ) : s.step === "test-coder" && s.candidate ? (
          <>
            <strong>3. Test {s.candidate.model} as the coder.</strong>
            <p>FlowCode only lets a model write code after it passes 8 quick checks of reading, creating and editing files safely. It takes a few minutes; when it passes, FlowCode uses it as the coder.</p>
            <button type="button" className="btn btn--sm btn--primary" disabled={busy} onClick={() => void act("/setup/test", s.candidate!.model)}>
              Test and use {s.candidate.model}
            </button>
          </>
        ) : s.step === "testing" && s.testing ? (
          <>
            <strong>Testing {s.testing.model}…</strong>
            <p>{mins ? `${mins} min so far. ` : ""}Usually a few minutes. You can keep using FlowCode; this card updates when it's done.</p>
          </>
        ) : s.step === "use-coder" && s.candidate ? (
          <>
            <strong>Use {s.candidate.model} as the coder.</strong>
            <p>It has passed the coder test. FlowCode's coder is set to {s.coder.model}{s.coder.installed ? "" : ", which isn't downloaded"}.</p>
            <button type="button" className="btn btn--sm btn--primary" disabled={busy} onClick={() => void act("/setup/use", s.candidate!.model)}>
              Use {s.candidate.model}
            </button>
          </>
        ) : null}
        {error || s.lastError ? <p className="setup__error" role="alert">{error ?? s.lastError}</p> : null}
      </div>
      {compact ? null : <p className="setup__foot">You can look around FlowCode meanwhile; building starts working once these are done.</p>}
    </section>
  );
}
