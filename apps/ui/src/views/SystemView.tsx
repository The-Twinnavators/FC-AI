/** System: daemon health & controls, environment & connections, AI engine, governed tool catalog. */
import { useEffect, useRef, useState, lazy, Suspense } from "react";
import { get, post, useResource } from "../api";
import { Icon, Led, Tabs, time } from "../components/ui";
import { navigate } from "../router";
import { ConfirmButton } from "../components/ConfirmButton";
import { ModelProblems } from "../components/ModelProblems";
import { DecisionCalendar } from "../components/DecisionCalendar";
import { RobotHead, ROLE_COLOR, ROLE_LABEL } from "../components/RobotHead";

interface Health {
  version: string;
  pid: number;
  uptimeMs: number;
  node: string;
  electron: string | null;
  activeRuns: number;
  queueDepth: number;
  pendingApprovals: number;
  subsystems: Array<{ id: string; label: string; status: string; detail: string }>;
  log: Array<{ at: string; level: string; message: string }>;
}

interface Env {
  toolchain: Array<{ id: string; label: string; value: string; ok: boolean; optional?: boolean }>;
  variables: Array<{ name: string; purpose: string; set: boolean; secret: boolean; value: string | null }>;
  providers: Array<{ id: string; label: string; kind: string; hosted: boolean; enabled: boolean; endpoint: string | null; credential: { name: string; set: boolean } | null; health: { ok: boolean; detail: string } }>;
  searchAdapters: Array<{ id: string; label: string; consent: string }>;
  allowedDirectories: Array<{ project: string; projectId: string | null; path: string; exists: boolean }>;
}

interface Engine {
  provider: { label: string; endpoint: string; health: { ok: boolean; detail: string } };
  contextPerCall: number;
  models: Array<{ name: string; family?: string; parameterSize?: string; sizeBytes?: number; contextLength?: number; capabilities: string[]; capability: { passed: boolean; score: string; at: string } | null; usage: { week: number; all: number; calls: number }; roles: string[] }>;
}


type Tab = "health" | "environment" | "engine" | "models" | "stuck" | "problems";
const TAB_IDS: Tab[] = ["health", "environment", "models", "engine", "stuck", "problems"];
const ModelsView = lazy(() => import("./ModelsView").then((x) => ({ default: x.ModelsView })));

/** What a system log line is about, for its color and label (errors and warnings first, then by subject). */
function logKind(level: string, message: string): { id: string; label: string } {
  const m = message.toLowerCase();
  if (level === "error" || /\b[1-9]\d* failed\b|crash|error/.test(m)) return { id: "error", label: "Error" };
  if (level === "warning") return { id: "warn", label: "Warning" };
  if (/scheduler paused/.test(m)) return { id: "warn", label: "Scheduler" };
  if (/scheduler resumed|ready|started/.test(m)) return { id: "ok", label: /scheduler/.test(m) ? "Scheduler" : "Started" };
  if (/shutdown|restart|cleanup|stopped/.test(m)) return { id: "life", label: /restart/.test(m) ? "Restart" : "Cleanup" };
  if (/knowledge|source saved|research/.test(m)) return { id: "know", label: "Knowledge" };
  if (/retention/.test(m)) return { id: "muted", label: "Retention" };
  return { id: "info", label: "System" };
}

const statusLed = (s: string) => (s === "online" || s === "running" ? "passed" : s === "paused" || s === "missing" ? "awaiting_approval" : s === "offline" ? "failed" : undefined);

function fmtUptime(ms: number) {
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return { h, m, s: s % 60 };
}

const compact = (n: number) => (n >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `${(n / 1e3).toFixed(1)}K` : String(n));

export function SystemView({ tab: initial }: { tab?: Tab }) {
  const [tab, setTabState] = useState<Tab>(TAB_IDS.includes(initial as Tab) ? (initial as Tab) : "health");
  // The tab is part of the address (/system/models) so links and Back work.
  const setTab = (t: Tab) => {
    setTabState(t);
    history.replaceState(null, "", `#/system/${t}`);
  };
  const stuck = useResource<{ hits: LimitHit[] }>("/system/flowcode-limits", [], 30_000);
  const stuckCount = stuck.data?.hits.length ?? 0;
  const problems = useResource<{ codeFix: unknown[] }>("/skill-proposals", [], 30_000);
  const problemCount = problems.data?.codeFix.length ?? 0;
  return (
    <div className="page" style={{ maxWidth: 1360 }}>
      <header className="page__head">
        <div>
          <span className="label">System</span>
          <h1 className="page__title">System Health</h1>
          <p className="lrc__meta">Is everything running: FlowCode's engine, its connections on this computer, the AI models and how they perform.</p>
        </div>
      </header>
      <div className="sys-tabs page-tabs" data-guide="system.tabs">
        <Tabs
          label="system"
          value={tab}
          onChange={setTab}
          tabs={[
            { id: "health", label: "Health & controls" },
            { id: "environment", label: "Environment & connections" },
            { id: "models", label: "Models & capability lab" },
            { id: "engine", label: "AI engine" },
            { id: "stuck", label: "Stuck steps", ...(stuckCount ? { count: stuckCount } : {}) },
            { id: "problems", label: "Model problems", ...(problemCount ? { count: problemCount } : {}) },
          ]}
        />
        <div role="tabpanel" className="sys-tabs__panel" id={`panel-system-${tab}`} aria-labelledby={`tab-system-${tab}`}>
          {tab === "health" && <HealthPanel />}
          {tab === "problems" && <ModelProblems />}
          {tab === "stuck" && <StuckSteps hits={stuck.data?.hits} reload={stuck.reload} />}
          {tab === "environment" && <EnvironmentPanel />}
          {tab === "engine" && <EnginePanel />}
          {tab === "models" ? (
            <div className="system-embed">
              <Suspense fallback={<p className="muted">Checking the AI models on this computer…</p>}>
                <ModelsView />
              </Suspense>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function Stat({ label, children, live }: { label: string; children: React.ReactNode; live?: boolean }) {
  return (
    <div style={{ border: "1px solid var(--line)", borderRadius: 8, padding: "12px 14px", background: "var(--bg-2)", display: "grid", gap: 6 }}>
      <span className="label" style={{ display: "flex", justifyContent: "space-between" }}>
        {label}
        {live ? (
          <span style={{ display: "inline-flex", gap: 6, alignItems: "center", color: "var(--sig-ok)" }}>
            <Led status="passed" /> live
          </span>
        ) : null}
      </span>
      <span style={{ fontSize: 26, fontWeight: 650, letterSpacing: "-0.02em", fontVariantNumeric: "tabular-nums" }}>{children}</span>
    </div>
  );
}

/**
 * The system log fills the window down to 112px above its bottom edge (clear of the footer), measured from where the
 * list starts on the page, so it fits any window height. At least 220px on short windows.
 */
function useFitToWindow(ready: boolean, gap = 112) {
  const ref = useRef<HTMLUListElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const fit = () => {
      const scroller = document.getElementById("main");
      const top = el.getBoundingClientRect().top + (scroller?.scrollTop ?? window.scrollY);
      el.style.maxHeight = `${Math.max(220, Math.round(window.innerHeight - top - gap))}px`;
      // Padding and borders sit outside the measured top: correct by what is actually left below the list.
      const left = window.innerHeight - (el.getBoundingClientRect().bottom + (scroller?.scrollTop ?? window.scrollY));
      const h = parseFloat(el.style.maxHeight) + (left - gap);
      if (Math.abs(left - gap) >= 1 && h >= 220) el.style.maxHeight = `${Math.round(h)}px`;
    };
    fit();
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, [ready, gap]);
  return ref;
}

function HealthPanel() {
  const { data, reload } = useResource<Health>("/system", [], 5000);
  const [tick, setTick] = useState(0);
  const [busy, setBusy] = useState<string>();
  const [paused, setPaused] = useState(false);
  const [note, setNote] = useState<{ ok: boolean; text: string }>();
  const logRef = useFitToWindow(!!data);
  useEffect(() => {
    const t = setInterval(() => setTick((x) => x + 1), 1000);
    return () => clearInterval(t);
  }, []);
  useEffect(() => setPaused(data?.subsystems.find((s) => s.id === "orchestrator")?.status === "paused"), [data]);
  if (!data) return <p className="muted">Reading daemon state…</p>;
  const up = fmtUptime(data.uptimeMs + (tick % 5) * 1000);
  const act = async (what: "restart" | "stop" | "pause") => {
    setBusy(what);
    setNote(undefined);
    try {
      if (what === "pause") {
        await post("/system/scheduler", { paused: !paused });
        setNote({ ok: true, text: paused ? "Scheduler resumed: queued steps start again." : "Scheduler paused: running steps finish, and no new ones start until you resume." });
      } else if (what === "stop") {
        await post("/system/stop");
        setNote({ ok: true, text: "Daemon stopped. It stays off until you start it again: reopen the desktop app, or run npm run dev:daemon." });
      } else {
        await post("/system/restart");
        setNote({ ok: true, text: "Restarting…" });
        // The daemon is down for a moment: wait until it answers again, then say so.
        const back = await (async () => {
          for (let i = 0; i < 30; i++) {
            await new Promise((r) => setTimeout(r, 1000));
            try {
              const h = await get<{ ok?: boolean }>("/health");
              if (h.ok && i > 0) return true;
            } catch {
              /* still starting */
            }
          }
          return false;
        })();
        setNote(back ? { ok: true, text: "Daemon restarted. Running builds pick up where they were." } : { ok: false, text: "The daemon didn't come back within 30 seconds. Start it from the desktop app, or run npm run dev:daemon." });
      }
    } catch (e) {
      setNote({ ok: false, text: (e as Error).message });
    } finally {
      setBusy(undefined);
      reload();
    }
  };
  return (
    <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1.4fr) minmax(280px, 0.6fr)", gap: 16 }}>
      <div data-guide="system.health" style={{ display: "grid", gap: 12, alignContent: "start" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10 }}>
          <Stat label="Uptime" live>
            {up.h}
            <span className="muted" style={{ fontSize: 14 }}>h </span>
            {String(up.m).padStart(2, "0")}
            <span className="muted" style={{ fontSize: 14 }}>m </span>
            {String(up.s).padStart(2, "0")}
            <span className="muted" style={{ fontSize: 14 }}>s</span>
          </Stat>
          <Stat label="Version">
            <span className="muted" style={{ fontSize: 14 }}>v</span>
            {data.version}
          </Stat>
          <Stat label="Active runs">{data.activeRuns}</Stat>
          <Stat label="Queue depth">{data.queueDepth}</Stat>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(210px, 1fr))", gap: 10 }} role="list" aria-label="Subsystems">
          {data.subsystems.map((s) => (
            <div key={s.id} role="listitem" style={{ border: "1px solid var(--line)", borderRadius: 8, padding: "10px 12px", display: "grid", gap: 4, borderLeft: `2px solid ${statusLed(s.status) === "passed" ? "var(--sig-ok)" : statusLed(s.status) === "failed" ? "var(--sig-bad)" : "var(--sig-warn)"}` }}>
              <span style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                <strong style={{ fontSize: 13 }}>{s.label}</strong>
                <span style={{ display: "inline-flex", gap: 6, alignItems: "center", fontSize: 11.5, color: "var(--text-1)", textTransform: "capitalize" }}>
                  <Led status={statusLed(s.status)} /> {s.status}
                </span>
              </span>
              <span className="muted" style={{ fontSize: 12 }}>
                {s.detail}
              </span>
            </div>
          ))}
        </div>
        <details className="section" open>
          <summary className="section__head" style={{ cursor: "pointer" }}>
            <span className="label">launcher &amp; system log</span>
            <span className="muted mono" style={{ marginLeft: "auto" }}>
              pid {data.pid} · node {data.node}
              {data.electron ? ` · electron ${data.electron}` : ""}
            </span>
          </summary>
          <ul ref={logRef} className="feed syslog-feed" tabIndex={0} aria-label="Recent system events">
            {data.log.length ? (
              data.log
                .slice()
                .reverse()
                .map((l, i) => (
                  (() => {
                    const k = logKind(l.level, l.message);
                    return (
                      <li key={i} className={`feed__item syslog syslog--${k.id}`}>
                        <span className="feed__time">{time(l.at)}</span>
                        <span className="syslog__dot" aria-hidden="true" />
                        <span className="syslog__tag">{k.label}</span>
                        <span className="feed__msg">{l.message}</span>
                      </li>
                    );
                  })()
                ))
            ) : (
              <li className="feed__item muted">No system events yet.</li>
            )}
          </ul>
        </details>
      </div>
      <div style={{ display: "grid", gap: 12, alignContent: "start" }}>
        <section className="section" data-guide="system.controls">
          <div className="section__head">
            <h2 className="section__title">Daemon controls</h2>
          </div>
          <div className="section__body" style={{ display: "grid", gap: 8 }}>
            <ConfirmButton className="btn btn--danger sys-ctl" disabled={!!busy} question="Stop the daemon? Running builds pause, and FlowCode stays off until you start it again." confirmLabel="Stop it" cancelLabel="Cancel" onConfirm={() => act("stop")}>
              <Icon name="stop" size={14} /> Stop daemon
            </ConfirmButton>
            <ConfirmButton className="btn sys-ctl" disabled={!!busy} question="Restart the daemon? Running builds pause and pick up again after it starts." confirmLabel="Restart" cancelLabel="Cancel" onConfirm={() => act("restart")}>
              <Icon name="refresh" size={14} /> {busy === "restart" ? "Restarting…" : "Restart daemon"}
            </ConfirmButton>
            <button className="btn" disabled={!!busy} onClick={() => act("pause")} style={{ justifyContent: "center", height: 36 }} aria-pressed={paused}>
              <Icon name={paused ? "play" : "stop"} size={14} /> {paused ? "Resume scheduler" : "Pause scheduler"}
            </button>
            {note ? (
              <p className={`notice${note.ok ? " notice--ok" : " notice--bad"}`} role={note.ok ? "status" : "alert"} style={{ margin: 0 }}>
                {note.text}
              </p>
            ) : null}
            <p className="muted" style={{ margin: 0, fontSize: 12 }}>
              Pausing lets running tasks finish and starts no new ones. Stop and restart clean up every owned process first; in the desktop app the shell restarts the daemon.
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}

function Row({ dot, label, sub, right }: { dot?: string; label: React.ReactNode; sub?: React.ReactNode; right: React.ReactNode }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "14px minmax(0, 1fr) auto", gap: 10, alignItems: "center", padding: "7px 10px", borderRadius: 6 }} className="sys-row">
      <Led status={dot} />
      <span style={{ minWidth: 0 }}>
        <span style={{ fontSize: 13 }}>{label}</span>
        {sub ? (
          <span className="mono muted" style={{ marginLeft: 8 }}>
            {sub}
          </span>
        ) : null}
      </span>
      <span className="mono" style={{ color: "var(--text-1)", textAlign: "right", maxWidth: 420, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {right}
      </span>
    </div>
  );
}

function EnvironmentPanel() {
  const { data } = useResource<Env>("/system/environment");
  const [net, setNet] = useState<Array<{ label: string; url: string; ok: boolean; detail: string }>>();
  const [checking, setChecking] = useState(false);
  if (!data) return <p className="muted">Inspecting the environment…</p>;
  const connected = data.providers.filter((p) => p.health.ok).length + data.toolchain.filter((t) => t.ok).length;
  const missing = data.toolchain.filter((t) => !t.ok && !t.optional).length;
  return (
    <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)", gap: 16 }}>
      <section className="section" style={{ gridColumn: "1 / -1" }}>
        <div className="section__head">
          <h2 className="section__title">Environment &amp; connections</h2>
          <span className="mono" style={{ marginLeft: "auto", color: "var(--sig-ok)" }}>
            {connected} connected
          </span>
          {missing ? <span className="mono" style={{ color: "var(--sig-warn)" }}>{missing} missing</span> : null}
        </div>
        <div className="section__body" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "4px 24px" }}>
          <div>
            <span className="label">model providers</span>
            {data.providers.map((p) => (
              <Row key={p.id} dot={p.health.ok ? "passed" : p.enabled ? "failed" : undefined} label={p.label} sub={p.hosted ? "hosted · consent required" : "local"} right={p.health.ok ? "connected" : p.enabled ? "unreachable" : "disabled"} />
            ))}
            <span className="label" style={{ display: "block", marginTop: 12 }}>
              credentials (values never shown)
            </span>
            {data.providers
              .filter((p) => p.credential)
              .map((p) => (
                <Row key={p.id} dot={p.credential!.set ? "passed" : undefined} label={p.label} sub={p.credential!.name} right={p.credential!.set ? "••••••" : "missing"} />
              ))}
            <span className="label" style={{ display: "block", marginTop: 12 }}>
              search adapters
            </span>
            {data.searchAdapters.map((a) => (
              <Row key={a.id} dot="awaiting_approval" label={a.label} right={`consent ${a.consent}`} />
            ))}
          </div>
          <div>
            <span className="label">toolchain</span>
            {data.toolchain.map((t) => (
              <Row key={t.id} dot={t.ok ? "passed" : t.optional ? undefined : "failed"} label={t.label} right={t.value} />
            ))}
            <span className="label" style={{ display: "block", marginTop: 12 }}>
              environment variables
            </span>
            {data.variables.map((v) => (
              <Row key={v.name} dot={v.set ? "passed" : undefined} label={v.purpose} sub={v.name} right={v.set ? (v.secret ? "••••••" : v.value ?? "set") : "not set"} />
            ))}
          </div>
        </div>
        <div style={{ borderTop: "1px solid var(--line)", padding: "10px 16px", display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <button
            className="btn btn--sm"
            disabled={checking}
            onClick={async () => {
              setChecking(true);
              try {
                setNet(await post("/system/environment/check"));
              } finally {
                setChecking(false);
              }
            }}
          >
            {checking ? "Checking…" : "Check network reachability"}
          </button>
          {net?.map((n) => (
            <span key={n.url} style={{ display: "inline-flex", gap: 6, alignItems: "center", fontSize: 12 }}>
              <Led status={n.ok ? "passed" : "failed"} /> {n.label}: <span className="mono muted">{n.detail}</span>
            </span>
          ))}
          <span className="muted" style={{ fontSize: 12, marginLeft: "auto" }}>
            Environment variables load when the daemon starts — restart it from Health &amp; controls to apply changes.
          </span>
        </div>
      </section>
      <section className="section" style={{ gridColumn: "1 / -1" }}>
        <div className="section__head">
          <Icon name="quality" size={15} />
          <h2 className="section__title">Allowed directories</h2>
          <span className="muted" style={{ fontSize: 12 }}>
            Agents and commands can only touch these roots (path jail). Add one by opening a repository.
          </span>
        </div>
        <div className="section__body" style={{ display: "grid", gap: 8, minWidth: 0 }}>
          {data.allowedDirectories.map((d) => (
            <div key={`${d.projectId}-${d.path}`} style={{ display: "flex", gap: 10, alignItems: "center", minWidth: 0, padding: "9px 12px", border: "1px solid var(--line)", borderRadius: 8, background: "var(--bg-2)" }}>
              <Icon name="folder" size={14} />
              <span className="mono" style={{ flex: "1 1 auto", minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={d.path}>
                {d.path}
              </span>
              <span className="muted" style={{ fontSize: 12, marginLeft: "auto", whiteSpace: "nowrap" }}>
                {d.project}
                {d.exists ? "" : " · missing"}
              </span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function EnginePanel() {
  const { data, reload } = useResource<Engine>("/system/models");
  const [error, setError] = useState<string>();
  if (!data) return <p className="muted">Querying the local model provider…</p>;
  const maxAll = Math.max(1, ...data.models.map((m) => m.usage.all));
  const use = async (model: string) => {
    setError(undefined);
    try {
      for (const role of ["planner", "coder", "debugger"]) await post("/models/roles", { role, assignment: { providerId: "ollama", model, temperature: role === "planner" ? 0.2 : 0.1 } });
      reload();
    } catch (e) {
      setError((e as Error).message);
    }
  };
  return (
    <section className="section">
      <div className="section__head">
        <Icon name="models" size={15} />
        <h2 className="section__title">AI engine</h2>
        <span className={`chip ${data.provider.health.ok ? "chip--ok" : "chip--bad"}`}>{data.provider.health.ok ? "Ollama online" : "Ollama offline"}</span>
        <span className="muted mono" style={{ marginLeft: "auto" }}>
          {data.provider.endpoint} · ctx per call {compact(data.contextPerCall)}
        </span>
      </div>
      {error ? (
        <p role="alert" className="notice notice--bad" style={{ margin: 12 }}>
          {error}
        </p>
      ) : null}
      <table className="table">
        <thead>
          <tr>
            <th>Model</th>
            <th>Size</th>
            <th>Context</th>
            <th>Disk</th>
            <th>Capabilities</th>
            <th>Coder test</th>
            <th>Tokens · 7 days</th>
            <th>All time</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {data.models.map((m) => (
            <tr key={m.name}>
              <td>
                <span className="mono" style={{ fontSize: 12 }}>
                  {m.name}
                </span>
                {m.roles.length ? <div className="muted" style={{ fontSize: 11 }}>{m.roles.join(", ")}</div> : null}
              </td>
              <td>{m.parameterSize ? <span className="chip">{m.parameterSize}</span> : "—"}</td>
              <td className="mono" style={{ color: "var(--brand-ink)" }}>
                {m.contextLength ? compact(m.contextLength) : "—"}
              </td>
              <td className="mono muted">{m.sizeBytes ? `${(m.sizeBytes / 1e9).toFixed(1)} GB` : "—"}</td>
              <td className="muted" style={{ fontSize: 11.5 }}>
                {m.capabilities.join(" · ") || "—"}
              </td>
              <td>{m.capability ? <span className={`chip ${m.capability.passed ? "chip--ok" : "chip--bad"}`}>{m.capability.score}</span> : <span className="muted">not tested</span>}</td>
              <td className="mono">{m.usage.week ? compact(m.usage.week) : "—"}</td>
              <td style={{ minWidth: 120 }}>
                <span className="mono">{m.usage.all ? compact(m.usage.all) : "—"}</span>
                <div aria-hidden="true" style={{ height: 3, background: "var(--bg-3)", borderRadius: 2, marginTop: 4 }}>
                  <div style={{ width: `${(m.usage.all / maxAll) * 100}%`, height: "100%", background: "var(--brand-ink)", borderRadius: 2 }} />
                </div>
              </td>
              <td>
                <button className="btn btn--sm" disabled={!m.capability?.passed || m.roles.includes("coder")} title={m.capability?.passed ? "Use for Planner, Coder and Debugger" : "Pass the Coder capability test first (Models page)"} onClick={() => use(m.name)}>
                  {m.roles.includes("coder") ? "in use" : "use"}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="muted" style={{ margin: 0, padding: "10px 16px", fontSize: 12 }}>
        "Use" is available only for models that passed all eight Coder probes. Run the capability test on the Models page.
      </p>
    </section>
  );
}


interface LimitHit {
  at: string;
  runId: string;
  projectId: string;
  taskId: string;
  step: string;
  guard: string;
  model?: string;
  /** The agent whose step it was (coder, debugger…). */
  role?: string;
}

/**
 * Times one of FlowCode's own limits (not the app) stopped a build step twice. FlowCode then retried the step with
 * the limit relaxed; these are worth reporting, because the limit may be wrong for that model or that kind of step.
 */
/**
 * Stuck steps: times one of FlowCode's own limits (e.g. reading files over and over without changing anything) stopped
 * the same build step twice. That's FlowCode's agents getting stuck, not a problem in the app being built.
 */
function StuckSteps({ hits = [], reload }: { hits?: LimitHit[]; reload: () => void }) {
  const [copied, setCopied] = useState<string>();
  const projects = useResource<Array<{ id: string; name: string }>>("/projects", []);
  const projectName = new Map((projects.data ?? []).map((p) => [p.id, p.name.replace(/\s+/g, " ")]));
  const report = (h: LimitHit) =>
    [`FlowCode stuck step`, `When: ${h.at}`, `Step: ${h.step}`, `Limit: ${h.guard}`, `Model: ${h.model ?? "unknown"}`, `Run: ${h.runId} (project ${h.projectId}, task ${h.taskId})`].join("\n");
  const copy = async (h: LimitHit) => {
    try {
      await navigator.clipboard.writeText(report(h));
      setCopied(h.at);
    } catch {
      setCopied(undefined);
    }
  };
  return (
    <section className="stuck" aria-labelledby="stuck-title">
      <header className="stuck__head">
        <div>
          <h2 className="stuck__title" id="stuck-title">
            Stuck steps
          </h2>
          <p className="muted stuck__lede">
            Times FlowCode&apos;s own agents got stuck: one of its limits (such as reading files over and over without making a change) stopped the same build step twice. FlowCode retries the step with that limit relaxed. These point at FlowCode or its model, not at the app being built.
          </p>
        </div>
        {hits.length ? (
          <button className="btn btn--sm" onClick={() => void post("/system/flowcode-limits/clear").then(reload)}>
            Clear
          </button>
        ) : null}
      </header>
      {/* A month calendar on the left (today selected), that day's stuck steps on the right. */}
      <DecisionCalendar
        noun={["stuck step", "stuck steps"]}
        kindLabel="Model"
        entries={hits.map((h) => ({ id: h.at + h.taskId, at: h.at, chip: h.model ?? "unknown model", summary: h.step, reason: h.guard, who: projectName.get(h.projectId) ?? "", projectId: h.projectId, runId: h.runId }))}
        renderItem={(e) => {
          const h = hits.find((x) => x.at + x.taskId === e.id)!;
          return (
            <>
              <span className="apv-log__when">{new Date(h.at).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}</span>
              {/* The agent that got stuck. */}
              <span className="stuck__agent" title={`The ${ROLE_LABEL[h.role ?? "coder"] ?? h.role} agent got stuck on this step`}>
                <RobotHead color={ROLE_COLOR[h.role ?? "coder"] ?? "#9a9fd6"} id={`stuck-${h.at}`} size={26} />
                <span>{ROLE_LABEL[h.role ?? "coder"] ?? h.role}</span>
              </span>
              <span className="apv-log__what">
                <strong>{h.step}</strong>
                <span className="muted stuck__meta">
                  {h.guard}
                  {h.model ? ` · ${h.model}` : ""}
                  {projectName.get(h.projectId) ? ` · ${projectName.get(h.projectId)}` : ""}
                </span>
              </span>
              <span className="stuck__actions">
                <button className="btn btn--sm btn--ghost" onClick={() => navigate(`/projects/${h.projectId}/runs/${h.runId}`)}>
                  Open the build
                </button>
                <button className="btn btn--sm" onClick={() => void copy(h)}>
                  {copied === h.at ? "Copied" : "Copy report"}
                </button>
              </span>
            </>
          );
        }}
      />
    </section>
  );
}
