/** Models & capability lab (FR-M1, FR-M2, §4.1 module 4). */
import { ModelPerformance } from "../components/ModelPerformance";
import { useEffect, useRef, useState } from "react";
import type { CapabilityRecord, ModelAssignment, ProviderConfig } from "@flowcode/contracts";
import { post, useEventStream, useResource } from "../api";
import { Empty, Led, StatusChip, ago } from "../components/ui";
import { planAutoAssign, type Plan } from "../components/autoAssign";
import { Check, ChevronDown, Wand2 } from "lucide-react";

const PROBES = ["structured_read_file", "structured_create_file", "contextual_patch", "protected_manifest_edit", "tool_result_follow_up", "approval_request", "safe_command_result_interpretation", "bounded_repair_loop"];

type RoleRow = { assignment: ModelAssignment; eligibility?: { eligible: boolean; reason: string }; configHash: string };

export function ModelsView() {
  const providers = useResource<Array<ProviderConfig & { health: { ok: boolean; detail: string } }>>("/models/providers");
  const models = useResource<Array<{ name: string; sizeBytes?: number; parameterSize?: string; family?: string }>>("/models/providers/ollama/models");
  const roles = useResource<Record<string, RoleRow>>("/models/roles");
  const caps = useResource<CapabilityRecord[]>("/models/capabilities");
  const [probing, setProbing] = useState<string>();
  const [waiting, setWaiting] = useState(false);
  const [error, setError] = useState<string>();
  const [reasoning, setReasoning] = useState(false);
  useEventStream("/events?after=999999999", (e) => {
    if (e.type === "verification.completed" && e.message.startsWith("Capability lab")) {
      setProbing(undefined);
      caps.reload();
      roles.reload();
    }
  });
  const probe = async (model: string) => {
    setProbing(model);
    setError(undefined);
    const r = await post<{ waiting?: boolean }>("/models/capabilities/probe", { assignment: { providerId: "ollama", model, temperature: 0.1, ...(reasoning ? { reasoning: true } : {}) } });
    setWaiting(!!r.waiting);
  };
  /** The configuration a model actually passed in, so assigning it uses the one the lab approved. */
  const passedWith = (model: string) => caps.data?.find((c) => c.model === model && c.providerId === "ollama" && c.passed);
  const assignmentFor = (role: string, model: string) => {
    const rec = passedWith(model);
    return { providerId: "ollama", model, temperature: role === "planner" ? 0.2 : 0.1, ...(rec?.reasoning ? { reasoning: true } : {}) };
  };
  const assign = async (role: string, model: string) => {
    setError(undefined);
    try {
      const r = await post<{ switched?: number }>("/models/roles", { role, assignment: assignmentFor(role, model) });
      roles.reload();
      // Builds still going switch too: say so, so the change is never silent.
      setAutoDone(r.switched ? `${model} is the ${role.replace(/_/g, " ")} now, and ${r.switched === 1 ? "the build that's running uses" : `${r.switched} running builds use`} it from the next model call.` : undefined);
    } catch (e) {
      setError((e as Error).message);
    }
  };
  const latestFor = (model: string) => caps.data?.find((c) => c.model === model);
  /**
   * Turn a hosted provider off, or back on. Off means no build can reach it even with a project's
   * consent, which is the stronger of the two switches and the one that was missing.
   */
  const setProviderOn = async (p: ProviderConfig, enabled: boolean) => {
    setError(undefined);
    try {
      await post("/models/providers", { id: p.id, kind: p.kind, label: p.label, baseUrl: p.baseUrl, enabled, hosted: p.hosted, apiKeyRef: p.apiKeyRef });
      providers.reload();
      roles.reload();
    } catch (e) {
      setError((e as Error).message);
    }
  };
  // Auto-assign: preview the proposed models per role, then apply on confirm.
  const [auto, setAuto] = useState<{ plan: Plan[]; warnings: string[] }>();
  const [applying, setApplying] = useState(false);
  const [autoDone, setAutoDone] = useState<string>();
  const proposeAuto = () => {
    setAutoDone(undefined);
    const passed = new Set((caps.data ?? []).filter((c) => c.passed && c.providerId === "ollama").map((c) => c.model));
    const current = Object.fromEntries(Object.entries(roles.data ?? {}).map(([r, v]) => [r, v.assignment?.model]));
    setAuto(planAutoAssign(models.data ?? [], passed, current));
  };
  const applyAuto = async () => {
    if (!auto) return;
    setApplying(true);
    setError(undefined);
    try {
      const changes = auto.plan.filter((p) => p.to !== p.from);
      let switched = 0;
      for (const p of changes) switched = Math.max(switched, (await post<{ switched?: number }>("/models/roles", { role: p.role, assignment: assignmentFor(p.role, p.to) })).switched ?? 0);
      roles.reload();
      setAutoDone(changes.length ? `Updated ${changes.length} role${changes.length === 1 ? "" : "s"}${switched ? `; ${switched === 1 ? "the running build uses" : `${switched} running builds use`} them from the next model call` : ""}.` : "Everything was already set this way.");
      setAuto(undefined);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setApplying(false);
    }
  };
  return (
    <div className="page">
      <header className="page__head">
        <div>
          <span className="label">model router</span>
          <h1 className="page__title">Models &amp; capability lab</h1>
        </div>
      </header>

      {/* Two independent columns, so neither leaves a gap beside the other: the lab and the roles it decides on the
          left; providers, the cloud model, the design model and measured performance on the right. */}
      <div className="models-grid">
      <div className="models-col models-col--side">
      <section className="section models-providers">
        <div className="section__head">
          <h2 className="section__title">Providers</h2>
        </div>
        {/* One row per provider: name and state on one line, where it runs and its details below (a 4-column table
            squeezed the names into tall wrapped blocks). */}
        <ul className="prov-list">
          {providers.data?.map((p) => {
            const on = p.enabled && p.health.ok;
            // The daemon's note for a hosted provider that isn't set up points at "the Models page": we're on it.
            const detail = p.hosted && !p.enabled ? "Not set up. Choose a provider and model under Cloud model, below." : p.health.detail;
            return (
              <li key={p.id} className="prov-row">
                <Led status={p.health.ok ? "passed" : p.enabled ? "failed" : undefined} />
                <div className="prov-row__main">
                  <div className="prov-row__top">
                    <strong>{p.label}</strong>
                    {p.hosted ? (
                      p.enabled && !p.health.ok ? <span className="chip">Not reachable</span> : null
                    ) : (
                      <span className={`chip${on ? " chip--ok" : ""}`}>{on ? "On" : p.enabled ? "Not reachable" : "Off"}</span>
                    )}
                    {p.hosted ? (
                      <label className="check prov-row__switch" title={p.enabled ? `Switch ${p.label} off: no build can use it, whatever a project allows` : `Switch ${p.label} on: a build can use it when the project allows hosted models`}>
                        <input type="checkbox" checked={p.enabled} onChange={(e) => void setProviderOn(p, e.target.checked)} />
                        <span>{p.enabled ? "On" : "Off"}</span>
                      </label>
                    ) : null}
                  </div>
                  <span className="prov-row__where">{p.hosted ? "In the cloud · used only when you choose it, and only while this is on" : "On this computer · every role runs here, so it has no switch"}</span>
                  <span className="prov-row__detail">{detail}</span>
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      <CloudCoder onSaved={providers.reload} />
      <DesignModel />
      <ModelPerformance />
      </div>

      <div className="models-col models-col--main">
      <section className="section" data-guide="models.lab">
        <div className="section__head section__head--stack">
          <h2 className="section__title">Coder capability lab</h2>
          <label className="check" title="Runs the eight probes with the model's own thinking turned on. FlowCode keeps thinking off for normal work — it is slower, and the runtime checks results itself — so a pass here is recorded against this setting, not the one the Coder runs with.">
            <input type="checkbox" checked={reasoning} onChange={(e) => setReasoning(e.target.checked)} /> Probe with reasoning enabled — a model that passes this way is assigned this way
          </label>
        </div>
        <div className="section__body" style={{ display: "grid", gap: 12 }}>
          <p className="dim" style={{ margin: 0 }}>
            Eight probes run in a disposable workspace through the real governed tools. Only a model that passes all of them — with native tool calls — can be the Coder. Results are stored per provider, model, version and configuration.
          </p>
          {error ? <p role="alert" className="notice notice--bad">{error}</p> : null}
          {!models.data?.length ? (
            <Empty title="No local models found">Install Ollama and pull a tool-calling model (for example <span className="mono">ollama pull qwen3:14b</span>).</Empty>
          ) : (
            models.data.map((m) => {
              const rec = latestFor(m.name);
              return (
                <div key={m.name} style={{ border: "1px solid var(--line)", borderRadius: 8, padding: 12, display: "grid", gap: 10 }}>
                  <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                    <strong className="mono">{m.name}</strong>
                    <span className="muted" style={{ fontSize: 12 }}>
                      {m.family} {m.parameterSize}
                    </span>
                    {rec ? <StatusChip status={rec.passed ? "passed" : "failed"} /> : <span className="chip">not tested</span>}
                    {rec ? (
                      <span className="muted" style={{ fontSize: 12 }}>
                        {rec.results.filter((r) => r.passed).length}/{rec.results.length} · {rec.nativeToolCalls ? "native tool calls" : "no native tool calls"} ·{" "}
                        {rec.reasoning === undefined ? null : <>reasoning {rec.reasoning ? "on" : "off"} · </>}
                        {ago(rec.createdAt)}
                      </span>
                    ) : null}
                    <button className="btn btn--sm" style={{ marginLeft: "auto" }} disabled={!!probing} onClick={() => probe(m.name)}>
                      {probing === m.name ? (waiting ? "Waits for the build to finish…" : "Probing…") : "Run capability test"}
                    </button>
                  </div>
                  {rec ? (
                    <div className="probe-grid">
                      {PROBES.map((p) => {
                        const r = rec.results.find((x) => x.probe === p);
                        return (
                          <div key={p} title={r?.detail}>
                            <span style={{ display: "flex", gap: 6, alignItems: "center" }}>
                              <Led status={r ? (r.passed ? "passed" : "failed") : undefined} />
                              <span className="mono" style={{ fontSize: 9.5 }}>{p.replace(/_/g, " ")}</span>
                            </span>
                            <span className="muted">{r?.detail ?? "—"}</span>
                          </div>
                        );
                      })}
                    </div>
                  ) : null}
                </div>
              );
            })
          )}
        </div>
      </section>

      <section className="section" data-guide="models.roles">
        <div className="section__head">
          <h2 className="section__title">Role assignments</h2>
          <button className="btn btn--sm btn--primary" style={{ marginLeft: "auto" }} onClick={proposeAuto} disabled={!models.data || !roles.data} title="Pick a model for every role from what's installed and tested">
            <Wand2 size={14} aria-hidden="true" /> Auto-assign
          </button>
        </div>
        {autoDone ? <p className="notice notice--ok" role="status" style={{ margin: "12px 16px 0" }}>{autoDone}</p> : null}
        {auto ? (
          <div className="auto-assign" role="region" aria-label="Proposed role assignments">
            <strong>Proposed models</strong>
            {auto.warnings.map((w) => (
              <p key={w} className="notice notice--warn" style={{ margin: 0 }}>{w}</p>
            ))}
            <ul>
              {auto.plan.map((p) => (
                <li key={p.role} className={p.to === p.from ? "is-same" : undefined}>
                  <span className="auto-assign__role">{p.role.replace(/_/g, " ")}</span>
                  <span className="mono">{p.to === p.from ? p.to : `${p.from ?? "—"} → ${p.to}`}</span>
                  <span className="muted auto-assign__why">{p.to === p.from ? "unchanged" : p.why}</span>
                </li>
              ))}
            </ul>
            <div style={{ display: "flex", gap: 8 }}>
              <button className="btn btn--primary btn--sm" onClick={() => void applyAuto()} disabled={applying}>
                {applying ? "Applying…" : `Apply ${auto.plan.filter((p) => p.to !== p.from).length} change${auto.plan.filter((p) => p.to !== p.from).length === 1 ? "" : "s"}`}
              </button>
              <button className="btn btn--sm" onClick={() => setAuto(undefined)}>
                Cancel
              </button>
            </div>
          </div>
        ) : null}
        <table className="table">
          <thead>
            <tr>
              <th>Role</th>
              <th>Model</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {roles.data
              ? Object.entries(roles.data).map(([role, r]) => (
                  <tr key={role}>
                    <td style={{ textTransform: "capitalize" }}>{role.replace(/_/g, " ")}</td>
                    <td>
                      <select className="select" data-cp={`model-${role}`} style={{ height: 28, padding: "0 8px" }} aria-label={`Model for ${role}`} value={r.assignment.model} onChange={(e) => assign(role, e.target.value)}>
                        {[r.assignment.model, ...(models.data?.map((m) => m.name) ?? [])].filter((v, i, a) => a.indexOf(v) === i).map((n) => (
                          <option key={n} value={n}>
                            {n}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="muted" style={{ fontSize: 12 }}>
                      {r.eligibility ? (
                        <span style={{ display: "flex", gap: 6, alignItems: "center" }}>
                          <Led status={r.eligibility.eligible ? "passed" : "failed"} /> {r.eligibility.reason}
                        </span>
                      ) : role === "critic" ? (
                        "vision-capable model required for screenshot critique"
                      ) : (
                        "—"
                      )}
                    </td>
                  </tr>
                ))
              : null}
          </tbody>
        </table>
      </section>
      </div>
      </div>
    </div>
  );
}

/** Which model designs the screens: always the build's own coder, so Local means local for every step (VUS-01). */
function DesignModel() {
  return (
    <section className="section" data-guide="models.design">
      <div className="section__head">
        <h2 className="section__title">Design model</h2>
      </div>
      <div className="section__body" style={{ display: "grid", gap: 8 }}>
        <p className="muted" style={{ margin: 0, maxWidth: "68ch" }}>
          The screens are designed by the model that writes the build&apos;s code, chosen on New build under Who writes the code.
        </p>
        <ul className="muted" style={{ margin: 0, paddingLeft: 18, maxWidth: "68ch", display: "grid", gap: 4 }}>
          <li><strong>Local build:</strong> everything stays on this computer. The design review of the screenshots uses the local vision model.</li>
          <li><strong>Cloud build:</strong> the cloud model writes the code, designs the screens and reviews the screenshots. Its code and screenshots are sent to that provider.</li>
        </ul>
      </div>
    </section>
  );
}

/**
 * The cloud model: Anthropic (Claude, through its own API with prompt caching) or any OpenAI-compatible endpoint, and
 * the model to use. A build uses it when it's chosen as the coder on New build. FlowCode
 * never stores the API key: it goes into an environment variable on this computer and is never shown again.
 */
type CloudCfg = { provider: "hosted-openai-compatible" | "hosted-anthropic"; providerLabel: string; baseUrl: string; model: string; keyVariable: string; keyPresent: boolean; ready: boolean; problem: string };
const ANTHROPIC = "hosted-anthropic";
const CLAUDE_MODELS = [
  { id: "claude-sonnet-5-5", note: "Recommended for design: strong at layout and at judging screenshots, mid-priced" },
  { id: "claude-haiku-4-5-20251001", note: "Cheapest and fastest, for quick checks" },
  { id: "claude-opus-5-5", note: "Most capable and most expensive" },
];

function CloudCoder({ onSaved }: { onSaved: () => void }) {
  const cfg = useResource<CloudCfg>("/models/cloud-coder");
  const [baseUrl, setBaseUrl] = useState<string>();
  const [model, setModel] = useState<string>();
  const [error, setError] = useState<string>();
  const [saving, setSaving] = useState(false);
  const [key, setKey] = useState("");
  const [saved, setSaved] = useState<string>();
  // The model picker is a combobox: shut until you press it, filters as you type, and closes on a choice.
  const [listOpen, setListOpen] = useState(false);
  const [at, setAt] = useState(0);
  const picker = useRef<HTMLDivElement>(null);
  const anthropic = cfg.data?.provider === ANTHROPIC;
  const ids = useResource<{ models: string[]; error: string }>(cfg.data?.keyPresent && (anthropic || cfg.data?.baseUrl) ? "/models/cloud-coder/models" : null, [cfg.data?.keyPresent, cfg.data?.baseUrl, cfg.data?.provider]);
  const url = baseUrl ?? cfg.data?.baseUrl ?? "";
  const name = model ?? (cfg.data?.model || (anthropic ? "claude-sonnet-5-5" : ""));

  // Everything the key can reach, with a note against the three worth recommending. Typing narrows it; an exact
  // match does not, or choosing one would empty the list under your hand.
  const every = ids.data?.models?.length ? ids.data.models : anthropic ? CLAUDE_MODELS.map((m) => m.id) : [];
  const noteFor = (id: string) => CLAUDE_MODELS.find((m) => m.id === id)?.note;
  const typed = name.trim().toLowerCase();
  const options = !typed || every.includes(name.trim()) ? every : every.filter((m) => m.toLowerCase().includes(typed));

  const choose = (id: string) => {
    setModel(id);
    setListOpen(false);
  };

  useEffect(() => {
    if (!listOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setListOpen(false);
    const onDown = (e: MouseEvent) => {
      if (picker.current && !picker.current.contains(e.target as Node)) setListOpen(false);
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("mousedown", onDown);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("mousedown", onDown);
    };
  }, [listOpen]);
  const pickProvider = async (provider: CloudCfg["provider"]) => {
    setError(undefined);
    setSaved(undefined);
    setModel(undefined);
    setBaseUrl(undefined);
    try {
      await post("/models/cloud-coder/provider", { provider });
      cfg.reload();
    } catch (e) {
      setError((e as Error).message);
    }
  };
  // The key is sent once and never read back; the field clears whether or not saving worked.
  const saveKey = async () => {
    setSaving(true);
    setError(undefined);
    setSaved(undefined);
    try {
      await post("/models/cloud-coder/key", { key: key.trim() });
      setSaved("Key saved.");
      cfg.reload();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setKey("");
      setSaving(false);
    }
  };
  const removeKey = async () => {
    setSaving(true);
    try {
      await post("/models/cloud-coder/key/remove", {});
      cfg.reload();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };
  const save = async () => {
    setSaving(true);
    setError(undefined);
    try {
      const res = await post<{ model: string; reach: string }>("/models/cloud-coder", { ...(anthropic ? {} : { baseUrl: url.trim() }), model: name.trim() });
      setModel(res.model);
      setSaved(res.reach ? `Saved, but FlowCode couldn't check the model list: ${res.reach}` : `Saved: the cloud model is ${res.model}.`);
      cfg.reload();
      ids.reload();
      onSaved();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };
  return (
    <section className="section" data-guide="models.cloud">
      <div className="section__head">
        <h2 className="section__title">Cloud model</h2>
        <span className="chip" style={{ marginLeft: "auto" }}>{cfg.data?.ready ? `ready · ${cfg.data.model}` : "not set up"}</span>
      </div>
      <div className="section__body" style={{ display: "grid", gap: 12 }}>
        <p className="dim" style={{ margin: 0 }}>
          Used only when you choose it: for a whole build (Cloud on New build), or for one change (Use the cloud for this change in the builder chat). It then writes the code, designs the screens and reviews the screenshots, so that project's code and screenshots go to the provider, which bills you for it. Everything else runs on the local models.
        </p>
        <div className="field">
          <span>Provider</span>
          <div className="cloud-provider" role="tablist" aria-label="Cloud provider">
            {(
              [
                ["hosted-anthropic", "Anthropic (Claude)"],
                ["hosted-openai-compatible", "OpenAI-compatible"],
              ] as const
            ).map(([id, label]) => (
              <button key={id} type="button" role="tab" aria-selected={cfg.data?.provider === id} className={`cloud-provider__tab${cfg.data?.provider === id ? " is-on" : ""}`} onClick={() => pickProvider(id)}>
                {label}
              </button>
            ))}
          </div>
          {anthropic ? <span className="muted" style={{ fontSize: 12.5 }}>Anthropic's own API with prompt caching: the instructions and tools a step repeats every turn are billed at the cached rate after the first turn.</span> : null}
        </div>
        {anthropic ? null : (
          <label className="field">
            <span>Endpoint URL</span>
            <input className="input" value={url} placeholder="https://api.example.com/v1" onChange={(e) => setBaseUrl(e.target.value)} />
          </label>
        )}
        <div className="field">
          <label htmlFor="cloud-model">Model</label>
          <div className="cloud-picker" ref={picker}>
            <input
              id="cloud-model"
              className="input cloud-picker__input"
              role="combobox"
              aria-expanded={listOpen}
              aria-controls="cloud-model-list"
              aria-autocomplete="list"
              aria-activedescendant={listOpen && options[at] ? `cloud-model-${at}` : undefined}
              value={name}
              placeholder={anthropic ? "claude-sonnet-5-5" : "the provider's model id, e.g. gpt-5.6-sol"}
              onChange={(e) => {
                setModel(e.target.value);
                setAt(0);
                setListOpen(true);
              }}
              onMouseDown={() => options.length && setListOpen(true)}
              onKeyDown={(e) => {
                if (e.key === "ArrowDown" || e.key === "ArrowUp") {
                  e.preventDefault();
                  if (!listOpen) return setListOpen(true);
                  setAt((n) => (e.key === "ArrowDown" ? Math.min(options.length - 1, n + 1) : Math.max(0, n - 1)));
                } else if (e.key === "Enter" && listOpen && options[at]) {
                  e.preventDefault();
                  choose(options[at]);
                }
              }}
            />
            <button
              type="button"
              className="cloud-picker__toggle"
              tabIndex={-1}
              aria-label={listOpen ? "Close the model list" : "Open the model list"}
              aria-expanded={listOpen}
              onClick={() => setListOpen((v) => !v)}
            >
              <ChevronDown size={16} aria-hidden="true" />
            </button>
            {listOpen ? (
              <ul className="cloud-models" id="cloud-model-list" role="listbox" aria-label="Models">
                {options.length ? (
                  options.map((m, n) => (
                    <li
                      key={m}
                      id={`cloud-model-${n}`}
                      role="option"
                      aria-selected={m === name.trim()}
                      className={n === at ? "is-at" : undefined}
                      onMouseEnter={() => setAt(n)}
                      onMouseDown={(e) => {
                        e.preventDefault();
                        choose(m);
                      }}
                    >
                      <span className="cloud-models__tick" aria-hidden="true">
                        {m === name.trim() ? <Check size={14} /> : null}
                      </span>
                      <span>
                        <span className="mono">{m}</span>
                        {noteFor(m) ? <span className="muted">{noteFor(m)}</span> : null}
                      </span>
                    </li>
                  ))
                ) : (
                  <li className="cloud-models__none" aria-disabled="true">
                    Nothing matches "{name.trim()}"
                  </li>
                )}
              </ul>
            ) : null}
          </div>
          {ids.data?.error ? (
            <span className="muted" style={{ fontSize: 12.5 }}>Couldn't load the provider's models: {ids.data.error}</span>
          ) : ids.data?.models.length ? (
            <span className="muted" style={{ fontSize: 12.5 }}>{ids.data.models.length} models available with this key: press the field to pick one.</span>
          ) : null}
        </div>
        <div className="field">
          <span>API key</span>
          {cfg.data?.keyPresent ? (
            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              <span className="chip">Key saved</span>
              <button className="btn btn--sm" type="button" disabled={saving} onClick={removeKey}>
                Remove key
              </button>
            </div>
          ) : (
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <input className="input" type="password" autoComplete="off" value={key} placeholder={anthropic ? "Paste your Anthropic API key (console.anthropic.com, API keys)" : "Paste the provider's API key"} onChange={(e) => setKey(e.target.value)} style={{ flex: "1 1 260px" }} />
              <button className="btn" type="button" disabled={saving || key.trim().length < 10} onClick={saveKey}>
                Save key
              </button>
            </div>
          )}
          <span className="muted" style={{ fontSize: 12.5 }}>
            Kept in your Windows user environment variable <span className="mono">{cfg.data?.keyVariable || "FLOWCODE_HOSTED_API_KEY"}</span>, not in FlowCode's data or logs, and never shown again.
          </span>
        </div>
        {cfg.data && !cfg.data.ready && cfg.data.problem ? <p className="muted" style={{ margin: 0, fontSize: 13 }}>Not ready: {cfg.data.problem}.</p> : null}
        {error ? <p role="alert" className="notice notice--bad">{error}</p> : null}
        {saved && !error ? <p role="status" className="notice notice--ok" style={{ margin: 0 }}>{saved}</p> : null}
        <div>
          <button className="btn btn--primary" type="button" disabled={saving || (!anthropic && !url.trim()) || !name.trim()} onClick={save}>
            {saving ? "Saving…" : "Save cloud model"}
          </button>
        </div>
      </div>
    </section>
  );
}
