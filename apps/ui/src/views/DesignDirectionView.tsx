/**
 * Design direction: the project's Look, set in words or with direct controls, shown live on the project's own app.
 *
 * Same record and endpoints as the Look editor (workspace/designState.ts): a draft saved as you go, "Save as version"
 * makes it the chosen direction, "Apply to the app" writes the tokens (snapshotted) and checks the rendered page.
 * Locked groups can't change, here or on the server. The preview shows the draft on the running app through its
 * preview listener (previewBridge.ts) without writing anything; a reload shows the app's real styles.
 *
 * What changes at once (colours, type, shape, motion: tokens) is kept apart from what a build step makes (layout,
 * composition, imagery, component variants), and what isn't built yet says so.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  BASE_APPEARANCE,
  BORDER_WEIGHTS,
  BUNDLED_FONTS,
  DENSITIES,
  DENSITY_LABEL,
  LOOK_GROUPS,
  MOTION_LABEL,
  MOTION_LEVELS,
  STYLE_CAPTURE_OFF,
  TYPE_RATIOS,
  appearanceChecks,
  appearanceTokens,
  interpretDirection,
  type Appearance,
  type DirectionReading,
  type LookGroup,
  type NeutralTone,
} from "@flowcode/contracts";
import { get, post, useResource } from "../api";
import { navigate } from "../router";
import { Icon } from "../components/ui";
import { ColorPicker } from "../components/ColorPicker";

type Sources = Partial<Record<keyof Appearance, string>>;
interface Version {
  version: number;
  appearance: Appearance;
  selectedAt: string;
}
interface State {
  label: string;
  draft?: { appearance: Appearance; sources: Sources; updatedAt: string };
  selected?: { appearance: Appearance; sources: Sources; version: number };
  applied?: { appearance: Appearance; version: number; appliedAt: string; verification?: { technical: { status: string; checks: Check[] }; browser: { status: string; checks: Check[]; note?: string } } };
  lastFailure?: { version: number; reason: string };
  hasApp: boolean;
  locks: string[];
  versions: Version[];
  previewBridge?: boolean;
  prd?: { colors: Array<{ hex: string; name: string }>; direction?: string };
}
interface Check {
  kind: string;
  status: string;
  summary: string;
}

const NEUTRALS: Array<{ id: NeutralTone; label: string }> = [
  { id: "warm", label: "Warm" },
  { id: "cool", label: "Cool" },
  { id: "pure", label: "Grey" },
  { id: "brand", label: "Tinted" },
];
const CHECK_LABEL: Record<string, string> = { typecheck: "Typecheck", build: "Build", preview_health: "Preview", screenshots: "Screenshots", functional_journey: "Journey", look_reached: "Rendered page uses it" };
const SHAPE_DEFAULT = { radius: 10, density: "comfortable" as const, borders: "fine" as const };
const SCALE_DEFAULT = { base: 16, ratio: 1.2 };
const fontsFor = (a: Appearance) =>
  [...new Set([a.fonts.display, a.fonts.body])]
    .map((family) => BUNDLED_FONTS.find((f) => f.family === family))
    .filter((f): f is (typeof BUNDLED_FONTS)[number] => !!f)
    .map((f) => ({ family: f.family, url: `${location.origin}/fonts/${f.file}.woff2` }));

export function DesignDirectionView({ projectId }: { projectId: string }) {
  const res = useResource<State>(`/projects/${projectId}/design/state`, [projectId]);
  const preview = useResource<{ url?: string } | null>(`/projects/${projectId}/preview`, [projectId]);
  const s = res.data;
  const [a, setA] = useState<Appearance>();
  const [sources, setSources] = useState<Sources>({});
  const [saving, setSaving] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [msg, setMsg] = useState<string>();
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState<string>();
  const [text, setText] = useState("");
  const [reading, setReading] = useState<DirectionReading>();
  const [showing, setShowing] = useState<"draft" | "app" | number>("draft");
  const saveTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // Start from the draft, else the chosen direction, else the applied one, else FlowCode's base with the PRD's colour.
  const inited = useRef(false);
  useEffect(() => {
    if (!s || inited.current) return;
    inited.current = true;
    const start = s.draft?.appearance ?? s.selected?.appearance ?? s.applied?.appearance ?? (s.prd?.colors[0] ? { ...BASE_APPEARANCE, primary: s.prd.colors[0].hex } : BASE_APPEARANCE);
    setA(start);
    setSources(s.draft?.sources ?? s.selected?.sources ?? {});
    if (s.prd?.direction) setText(s.prd.direction.split("\n").slice(0, 8).join("\n"));
  }, [s]);
  const locks = s?.locks ?? [];
  const isLocked = (g: LookGroup) => locks.includes(g);

  const save = useCallback(
    (next: Appearance, nextSources: Sources) => {
      setSaving("saving");
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => {
        saveTimer.current = undefined;
        post(`/projects/${projectId}/design/draft`, { appearance: next, sources: nextSources })
          .then(() => (setSaving("saved"), res.reload()))
          .catch((e: Error) => (setSaving("error"), setError(e.message)));
      }, 450);
    },
    [projectId, res],
  );
  const edit = (patch: Partial<Appearance>, source = "you") => {
    const next = { ...(a ?? BASE_APPEARANCE), ...patch };
    const nextSources = { ...sources, ...Object.fromEntries(Object.keys(patch).map((k) => [k, source])) };
    setA(next);
    setSources(nextSources);
    setShowing("draft");
    setMsg(undefined);
    setError(undefined);
    save(next, nextSources);
  };

  // ── The live preview of the project's own app ──
  const frame = useRef<HTMLIFrameElement>(null);
  const [bridge, setBridge] = useState<"unknown" | "ready" | "missing">("unknown");
  const [paintMs, setPaintMs] = useState<number>();
  const sentAt = useRef(new Map<number, number>());
  const seq = useRef(0);
  const [device, setDevice] = useState<"desktop" | "phone">("desktop");
  const previewed: Appearance | undefined = showing === "draft" ? a : showing === "app" ? undefined : s?.versions.find((v) => v.version === showing)?.appearance;
  const send = useCallback((look: Appearance | undefined) => {
    const w = frame.current?.contentWindow;
    if (!w) return;
    const id = ++seq.current;
    sentAt.current.set(id, performance.now());
    if (look) w.postMessage({ type: "flowcode:fonts", fonts: fontsFor(look) }, "*");
    w.postMessage({ type: "flowcode:tokens", id, tokens: look ? appearanceTokens(look) : null }, "*");
  }, []);
  useEffect(() => {
    const on = (e: MessageEvent) => {
      if (e.source !== frame.current?.contentWindow) return;
      const d = e.data as { type?: string; id?: number } | null;
      if (d?.type === "flowcode:ready") setBridge("ready");
      if (d?.type === "flowcode:painted" && typeof d.id === "number") {
        // The first paint includes the app loading; only edits after it are timed.
        const t = sentAt.current.get(d.id);
        if (t !== undefined && d.id > 1) setPaintMs(Math.round(performance.now() - t));
      }
    };
    window.addEventListener("message", on);
    return () => window.removeEventListener("message", on);
  }, []);
  const hello = () => {
    setBridge("unknown");
    frame.current?.contentWindow?.postMessage({ type: "flowcode:hello" }, "*");
    // An app without the bridge never answers (a slow first load still answers within this).
    setTimeout(() => setBridge((b) => (b === "unknown" ? "missing" : b)), 4000);
  };
  useEffect(() => {
    if (bridge === "ready") send(previewed);
  }, [bridge, previewed, send]);

  const startPreview = async () => {
    setBusy("preview");
    try {
      await post(`/projects/${projectId}/preview/start`);
      preview.reload();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(undefined);
    }
  };
  const addBridge = async () => {
    setBusy("bridge");
    try {
      await post(`/projects/${projectId}/design/preview-bridge`);
      setMsg("Live preview turned on for this app (one change to src/main.tsx, undoable in Changes).");
      res.reload();
      setTimeout(() => frame.current && (frame.current.src = frame.current.src), 800);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(undefined);
    }
  };

  // ── Actions ──
  const flush = async () => {
    if (saveTimer.current) {
      clearTimeout(saveTimer.current);
      saveTimer.current = undefined;
      await post(`/projects/${projectId}/design/draft`, { appearance: a, sources });
    }
  };
  const run = async (key: string, fn: () => Promise<string | void>) => {
    setBusy(key);
    setError(undefined);
    setMsg(undefined);
    try {
      const m = await fn();
      if (m) setMsg(m);
      res.reload();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(undefined);
    }
  };
  const read = () => {
    const r = interpretDirection(text, a ?? BASE_APPEARANCE, locks);
    setReading(r);
    const changed = r.understood.filter((u) => u.group !== "build" && !u.locked).length;
    if (changed) edit(r.appearance, "direction");
  };
  const toggleLock = (g: LookGroup) => void run("lock", async () => void (await post(`/projects/${projectId}/design/locks`, { locks: isLocked(g) ? locks.filter((x) => x !== g) : [...locks, g] })));
  const saveVersion = () => void run("select", async () => (await flush(), await post(`/projects/${projectId}/design/select`, {}), "Saved as a version. Apply it to change the app."));
  const apply = () =>
    void run("apply", async () => {
      await flush();
      if (s?.draft || saveTimer.current !== undefined) await post(`/projects/${projectId}/design/select`, {});
      const r = await post<{ ok: boolean; reason?: string }>(`/projects/${projectId}/design/apply`, {});
      // The checks after an apply may have (re)started the project's preview: read its address again.
      preview.reload();
      setTimeout(() => frame.current && (frame.current.src = frame.current.src), 300);
      return r.ok ? "Applied to the app. The checks below say what the rendered app shows." : `Not applied: ${r.reason}. Your draft and the previous look are kept.`;
    });
  const restore = (v: number) =>
    void run("restore", async () => {
      await post(`/projects/${projectId}/design/restore`, { version: v });
      const st = await get<State>(`/projects/${projectId}/design/state`);
      if (st.draft) (setA(st.draft.appearance), setSources(st.draft.sources));
      setShowing("draft");
      return `Version ${v} is back as the draft. Save it or apply it to make it current.`;
    });
  const discard = () =>
    void run("discard", async () => {
      await post(`/projects/${projectId}/design/draft/discard`, {});
      const back = s?.selected?.appearance ?? s?.applied?.appearance ?? BASE_APPEARANCE;
      setA(back);
      setShowing("draft");
      return "Draft discarded. The saved and applied directions are unchanged.";
    });

  const cur = a ?? BASE_APPEARANCE;
  const checks = useMemo(() => appearanceChecks(cur), [cur]);
  const failing = checks.filter((c) => !c.ok);
  const hasDraft = !!s?.draft || saving === "saving";
  const url = preview.data?.url;
  const status = !s ? "Loading…" : hasDraft ? "Draft (not saved as a version)" : s.selected && (!s.applied || s.selected.version > s.applied.version) ? `Version ${s.selected.version} saved, not applied` : s.applied ? `Version ${s.applied.version} applied` : "No direction yet";

  if (!s || !a) return <main className="page" id="main"><p className="dim">Loading the design direction…</p></main>;
  return (
    <main className="dd" id="main">
      <header className="dd-head">
        <button type="button" className="btn btn--sm" onClick={() => navigate(`/projects/${projectId}`)}>
          <Icon name="chevron" size={14} /> Back to the project
        </button>
        <h1>Design direction</h1>
        <p className="dd-head__state" role="status">
          <span className={`dd-pill dd-pill--${hasDraft ? "draft" : s.applied ? "applied" : "saved"}`}>{status}</span>
          <span className="dim">{saving === "saving" ? "Saving draft…" : saving === "saved" ? "Draft saved" : ""}</span>
        </p>
      </header>

      <div className="dd-body">
        <div className="dd-controls">
          <section className="dd-sec" aria-labelledby="dd-words">
            <h2 id="dd-words">Describe it</h2>
            <p className="dd-hint">In your own words. FlowCode reads phrases it knows and shows what each one changed; anything else is listed back unread.</p>
            <textarea className="dd-text" rows={5} value={text} onChange={(e) => setText(e.target.value)} placeholder="Warm off-white, near-black text, muted cobalt accent, restrained corners, spacious" aria-label="Describe the look" />
            <div className="dd-row">
              <button type="button" className="btn btn--primary btn--sm" disabled={!text.trim()} onClick={read}>
                Read my direction
              </button>
              {s.prd?.direction ? (
                <button type="button" className="btn btn--sm" onClick={() => setText(s.prd!.direction!)}>
                  Use the PRD's direction
                </button>
              ) : null}
            </div>
            {reading ? (
              <div className="dd-reading" aria-live="polite">
                <ul>
                  {reading.understood.map((u, i) => (
                    <li key={i} className={u.locked ? "is-locked" : u.group === "build" ? "is-build" : ""}>
                      <span className="dd-reading__words">{u.words}</span>
                      <span className="dd-reading__change">
                        {u.group === "build" ? <span className="dd-tag dd-tag--build">Build step</span> : u.locked ? <span className="dd-tag">Locked</span> : u.changed === false ? <span className="dd-tag">Noted</span> : <span className="dd-tag dd-tag--now">Changed</span>} {u.change}
                      </span>
                    </li>
                  ))}
                </ul>
                {reading.unread.length ? (
                  <p className="dd-unread">
                    Not read (FlowCode's vocabulary doesn't cover these yet; set them with the controls below): {reading.unread.map((u) => `"${u}"`).join(", ")}
                  </p>
                ) : null}
              </div>
            ) : null}
          </section>

          <Group id="colors" title="Colours" locked={isLocked("colors")} onLock={() => toggleLock("colors")}>
            <div className="dd-seg" role="radiogroup" aria-label="Light or dark">
              {(["light", "dark"] as const).map((m) => (
                <button key={m} type="button" role="radio" aria-checked={cur.mode === m} disabled={isLocked("colors")} onClick={() => edit({ mode: m })}>
                  {m === "light" ? "Light" : "Dark"}
                </button>
              ))}
            </div>
            <div className="dd-seg" role="radiogroup" aria-label="Neutral family">
              {NEUTRALS.map((n) => (
                <button key={n.id} type="button" role="radio" aria-checked={cur.neutral === n.id} disabled={isLocked("colors")} onClick={() => edit({ neutral: n.id })}>
                  {n.label}
                </button>
              ))}
            </div>
            <div className={isLocked("colors") ? "dd-disabled" : ""}>
              <span className="dd-label">Accent (primary actions, selected states)</span>
              <ColorPicker label="Accent colour" value={cur.primary} onChange={(hex) => edit({ primary: hex })} swatches={(s.prd?.colors ?? []).map((c) => ({ label: `PRD: ${c.name}`, hex: c.hex }))} />
            </div>
            <ul className="dd-swatches" aria-label="Semantic colours this gives">
              {(["--color-bg", "--color-surface", "--color-text", "--color-text-muted", "--color-accent", "--color-border", "--color-success", "--color-warning", "--color-danger"] as const).map((k) => (
                <li key={k} title={k}>
                  <span style={{ background: appearanceTokens(cur)[k] }} />
                  {k.replace("--color-", "").replace("-", " ")}
                </li>
              ))}
            </ul>
            <p className={`dd-contrast${failing.length ? " is-bad" : ""}`}>{failing.length ? `${failing.length} of ${checks.length} colour pairs are below their contrast target: ${failing.map((c) => c.label.toLowerCase()).join(", ")}` : `All ${checks.length} colour pairs meet their contrast target`}</p>
          </Group>

          <Group id="type" title="Typography" locked={isLocked("type")} onLock={() => toggleLock("type")}>
            <div className="dd-two">
              {(["display", "body"] as const).map((role) => (
                <label key={role} className="dd-field">
                  <span className="dd-label">{role === "display" ? "Headings" : "Text"}</span>
                  <select className="select" aria-label={role === "display" ? "Heading font" : "Text font"} value={cur.fonts[role]} disabled={isLocked("type")} onChange={(e) => edit({ fonts: { ...cur.fonts, [role]: e.target.value } })}>
                    {BUNDLED_FONTS.filter((f) => f.kind !== "mono").map((f) => (
                      <option key={f.family} value={f.family}>
                        {f.family} ({f.kind})
                      </option>
                    ))}
                  </select>
                </label>
              ))}
            </div>
            <label className="dd-field">
              <span className="dd-label">
                Body size <span className="dim">{(cur.typeScale ?? SCALE_DEFAULT).base}px</span>
              </span>
              <input type="range" min={14} max={20} step={1} disabled={isLocked("type")} value={(cur.typeScale ?? SCALE_DEFAULT).base} onChange={(e) => edit({ typeScale: { ...(cur.typeScale ?? SCALE_DEFAULT), base: Number(e.target.value) } })} />
            </label>
            <div className="dd-seg" role="radiogroup" aria-label="Heading steps">
              {TYPE_RATIOS.map((r) => (
                <button key={r.ratio} type="button" role="radio" aria-checked={(cur.typeScale ?? SCALE_DEFAULT).ratio === r.ratio} disabled={isLocked("type")} onClick={() => edit({ typeScale: { ...(cur.typeScale ?? SCALE_DEFAULT), ratio: r.ratio } })}>
                  {r.label}
                </button>
              ))}
            </div>
            <p className="dd-hint">FlowCode's {BUNDLED_FONTS.filter((f) => f.kind !== "mono").length} bundled, licensed fonts, any pairing. Other font sources: not yet.</p>
          </Group>

          <Group id="shape" title="Shape and density" locked={isLocked("shape")} onLock={() => toggleLock("shape")}>
            <label className="dd-field">
              <span className="dd-label">
                Corners <span className="dim">{(cur.shape ?? SHAPE_DEFAULT).radius}px</span>
              </span>
              <input type="range" min={0} max={24} step={1} disabled={isLocked("shape")} value={(cur.shape ?? SHAPE_DEFAULT).radius} onChange={(e) => edit({ shape: { ...(cur.shape ?? SHAPE_DEFAULT), radius: Number(e.target.value) } })} />
            </label>
            <div className="dd-seg" role="radiogroup" aria-label="Density">
              {DENSITIES.map((d) => (
                <button key={d} type="button" role="radio" aria-checked={(cur.shape ?? SHAPE_DEFAULT).density === d} title={DENSITY_LABEL[d].detail} disabled={isLocked("shape")} onClick={() => edit({ shape: { ...(cur.shape ?? SHAPE_DEFAULT), density: d } })}>
                  {DENSITY_LABEL[d].name}
                </button>
              ))}
            </div>
            <div className="dd-seg" role="radiogroup" aria-label="Borders">
              {BORDER_WEIGHTS.map((b) => (
                <button key={b} type="button" role="radio" aria-checked={(cur.shape ?? SHAPE_DEFAULT).borders === b} disabled={isLocked("shape")} onClick={() => edit({ shape: { ...(cur.shape ?? SHAPE_DEFAULT), borders: b } })}>
                  {b === "fine" ? "Fine borders" : "Strong borders"}
                </button>
              ))}
            </div>
          </Group>

          <Group id="motion" title="Motion" locked={isLocked("motion")} onLock={() => toggleLock("motion")}>
            <div className="dd-seg" role="radiogroup" aria-label="Motion level">
              {MOTION_LEVELS.map((m) => (
                <button key={m} type="button" role="radio" aria-checked={cur.motion?.level === m} title={MOTION_LABEL[m].detail} disabled={isLocked("motion")} onClick={() => edit({ motion: { ...cur.motion, level: m } })}>
                  {MOTION_LABEL[m].name}
                </button>
              ))}
            </div>
            <p className="dd-hint">{cur.motion ? MOTION_LABEL[cur.motion.level].detail : ""} Reduced motion on a person's device always wins: quick fades, no travel.</p>
          </Group>

          <section className="dd-sec" aria-labelledby="dd-build">
            <h2 id="dd-build">Made by a build step</h2>
            <p className="dd-hint">These change the screens' structure, not their tokens, so FlowCode's design step builds them from your direction.</p>
            <ul className="dd-later">
              <li>
                <span>Screen layout and composition (for example a photo-led grid)</span>
                <span className="dd-tag dd-tag--build">Build step</span>
              </li>
              <li>
                <span>Component alternatives and variants</span>
                <span className="dd-tag">Not yet here</span>
              </li>
              <li>
                <span>Imagery and icons</span>
                <span className="dd-tag">Not yet</span>
              </li>
              <li>
                <span>Changes for one screen or component only</span>
                <span className="dd-tag">Not yet</span>
              </li>
              <li title={STYLE_CAPTURE_OFF}>
                <span>Reference images and brand capture</span>
                <span className="dd-tag">Off for now</span>
              </li>
            </ul>
          </section>

          <section className="dd-sec" aria-labelledby="dd-versions">
            <h2 id="dd-versions">Versions</h2>
            {s.versions.length ? (
              <ol className="dd-versions">
                {[...s.versions].reverse().map((v) => (
                  <li key={v.version}>
                    <span className="dd-versions__dot" style={{ background: v.appearance.primary }} aria-hidden="true" />
                    <span>
                      Version {v.version}
                      {s.applied?.version === v.version ? <span className="dd-tag dd-tag--now">Applied</span> : null}
                      <span className="dim"> {v.appearance.fonts.display}, {v.appearance.primary}</span>
                    </span>
                    <button type="button" className="btn btn--sm" aria-pressed={showing === v.version} onClick={() => setShowing(showing === v.version ? "draft" : v.version)}>
                      {showing === v.version ? "Back to draft" : "Preview"}
                    </button>
                    <button type="button" className="btn btn--sm" disabled={!!busy} onClick={() => restore(v.version)}>
                      Restore
                    </button>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="dd-hint">No saved versions yet. "Save as version" keeps this direction to compare and come back to.</p>
            )}
          </section>
        </div>

        <section className="dd-preview" aria-label="Preview of the project">
          <div className="dd-preview__bar">
            <div className="dd-seg" role="radiogroup" aria-label="What the preview shows">
              <button type="button" role="radio" aria-checked={showing === "draft"} onClick={() => setShowing("draft")}>
                Draft
              </button>
              <button type="button" role="radio" aria-checked={showing === "app"} onClick={() => setShowing("app")}>
                As the app is
              </button>
            </div>
            <div className="dd-seg" role="radiogroup" aria-label="Device">
              <button type="button" role="radio" aria-checked={device === "desktop"} onClick={() => setDevice("desktop")}>
                Desktop
              </button>
              <button type="button" role="radio" aria-checked={device === "phone"} onClick={() => setDevice("phone")}>
                Phone
              </button>
            </div>
            <span className="dim dd-preview__meta" aria-live="polite">
              {typeof showing === "number" ? `Showing version ${showing}` : showing === "app" ? "Showing the app's own styles" : "Showing your draft (not applied)"}
              {bridge === "ready" && paintMs !== undefined ? `. Updated in ${paintMs} ms` : ""}
            </span>
          </div>
          {!url ? (
            <div className="dd-empty">
              <p>The project's preview isn't running.</p>
              <button type="button" className="btn btn--primary" disabled={busy === "preview"} onClick={() => void startPreview()}>
                {busy === "preview" ? "Starting…" : "Start the preview"}
              </button>
            </div>
          ) : (
            <>
              {bridge === "missing" ? (
                <div className="dd-note" role="status">
                  This app was made before the live design preview. Turning it on adds a few lines to its preview listener (src/main.tsx), recorded and undoable; nothing else changes.
                  <button type="button" className="btn btn--sm btn--primary" disabled={busy === "bridge"} onClick={() => void addBridge()}>
                    Turn on live preview
                  </button>
                </div>
              ) : null}
              <div className={`dd-frame dd-frame--${device}`}>
                <iframe ref={frame} src={url} title="The project's app" onLoad={hello} sandbox="allow-scripts allow-same-origin allow-forms" />
              </div>
            </>
          )}
          {s.applied?.verification ? (
            <div className="dd-verify" aria-label={`Checks after applying version ${s.applied.version}`}>
              <p className="dd-label">After applying version {s.applied.version}</p>
              <ul>
                {[...s.applied.verification.technical.checks, ...s.applied.verification.browser.checks].map((c) => (
                  <li key={c.kind} className={`is-${c.status}`}>
                    <span aria-hidden="true">{c.status === "passed" ? "✓" : c.status === "failed" ? "✕" : "–"}</span> {CHECK_LABEL[c.kind] ?? c.kind}: <span className="dim">{c.summary}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </section>
      </div>

      <footer className="dd-foot">
        <button type="button" className="btn btn--primary" disabled={!!busy || !s.hasApp} onClick={apply} title={s.hasApp ? "" : "The build applies the saved direction once the app exists"}>
          {busy === "apply" ? "Applying and checking…" : "Apply to the app"}
        </button>
        <button type="button" className="btn" disabled={!!busy || !hasDraft} onClick={saveVersion}>
          Save as version
        </button>
        <button type="button" className="btn" disabled={!!busy || !hasDraft} onClick={discard}>
          Discard draft
        </button>
        {msg ? <span className="dd-msg" role="status">{msg}</span> : null}
        {error ? <span className="dd-err" role="alert">{error}</span> : null}
      </footer>
    </main>
  );
}

function Group({ id, title, locked, onLock, children }: { id: LookGroup; title: string; locked: boolean; onLock: () => void; children: React.ReactNode }) {
  const label = LOOK_GROUPS.find((g) => g.id === id)?.label ?? title;
  return (
    <section className={`dd-sec${locked ? " is-locked" : ""}`} aria-labelledby={`dd-${id}`}>
      <header className="dd-sec__head">
        <h2 id={`dd-${id}`}>{title}</h2>
        <span className="dd-tag dd-tag--now" title="Changes the app's tokens: shown at once, applied without a build step">Instant</span>
        <button type="button" className="dd-lock" aria-pressed={locked} onClick={onLock} title={locked ? `Unlock ${label.toLowerCase()}` : `Lock ${label.toLowerCase()}: later changes, in words or controls, keep it`}>
          <Icon name={locked ? "pin" : "pin"} size={13} /> {locked ? "Locked" : "Lock"}
        </button>
      </header>
      <div className="dd-sec__body">{children}</div>
    </section>
  );
}
