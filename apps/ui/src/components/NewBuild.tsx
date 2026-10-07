/**
 * "New build" (§5.1): describe the product, optionally attach a PRD (.md) plus HTML / CSS / JSON
 * references, see the request score and what the HTML must preserve, then start a spec-driven build.
 * Laid out as four numbered steps so it is clear what is required and what is optional.
 */
import { SetupCard } from "./SetupCard";
import { useEffect, useMemo, useRef, useState, type DragEvent, type ReactNode } from "react";
import { NEW_BUILD_PRD_KEY } from "./PrdTemplates";
import { AUTONOMY_LEVELS, DESIGN_TEMPLATES, scoreRequest, suggestName, type ReferenceFile } from "@flowcode/contracts";

/** D3: the choices of the last build started here, offered (never applied on their own) for the next one. */
const LAST_KEY = "flowcode.lastBuildSettings";
type LastSettings = { project: string; template: string; extras: string[]; vibe?: string; autonomy: AutonomyLevel; coder: "local" | "cloud"; at: string };
function readLast(): LastSettings | undefined {
  try {
    const v = JSON.parse(localStorage.getItem(LAST_KEY) ?? "null") as LastSettings | null;
    return v && v.template && v.autonomy ? v : undefined;
  } catch {
    return undefined;
  }
}
import { post, useResource } from "../api";
import { Upload } from "lucide-react";
import { Icon, ErrorNotice } from "./ui";
import { AutonomyPicker } from "./AutonomyPicker";
import { LookStep, extrasInPrd, prdSetsLook, suggestedVibe } from "./LookStep";
import { readCaptureFile } from "./StyleCapture";
import type { AutonomyLevel } from "@flowcode/contracts";
import { navigate } from "../router";

type Ref = ReferenceFile & { size: number; summary: string };

const ACCEPT = ".md,.markdown,.html,.htm,.css,.json,.txt,.png,.jpg,.jpeg,.webp,.gif";
const MAX_FILE = 1_500_000;
/** Limits the backend enforces: description length and the total size of all spec files. */
const MAX_DESC = 20_000;
const MAX_TOTAL = 6_000_000;

function roleFor(name: string, hasPrd: boolean): ReferenceFile["role"] | undefined {
  const ext = name.toLowerCase().split(".").pop() ?? "";
  if (ext === "md" || ext === "markdown") return hasPrd ? "text" : "prd";
  if (ext === "html" || ext === "htm") return "html";
  if (ext === "css") return "css";
  if (ext === "json") return "json";
  if (ext === "txt") return "text";
  // Screenshots and mockups: the style is captured from them (Styles page), they aren't built from.
  if (/^(png|jpe?g|webp|gif)$/.test(ext)) return "image";
  return undefined;
}

/** Client-side preview of what a reference must preserve (the daemon re-checks after the build). */
function summarize(role: ReferenceFile["role"], content: string): string {
  if (role === "image") return "Its colours, fonts and corners are captured for the Styles page";
  try {
    if (role === "html") {
      const doc = new DOMParser().parseFromString(content, "text/html");
      doc.querySelectorAll("script,style,noscript,template").forEach((n) => n.remove());
      const words = (doc.body?.textContent ?? "").split(/\s+/).filter(Boolean).length;
      const links = doc.querySelectorAll("a[href]").length;
      const fields = Array.from(doc.querySelectorAll("input,select,textarea")).filter((f) => (f as HTMLInputElement).type !== "hidden").length;
      return `Keeps ${words} words, ${links} links and ${fields} form fields — checked after the build`;
    }
    if (role === "css") {
      const vars = (content.match(/--[\w-]+\s*:/g) ?? []).length;
      return `${(content.match(/\{/g) ?? []).length} rules, ${vars} custom properties`;
    }
    if (role === "json") {
      const v = JSON.parse(content) as unknown;
      return Array.isArray(v) ? `Array of ${v.length} items` : `Object with ${Object.keys(v as object).length} keys`;
    }
    const reqs = content.split("\n").filter((l) => /^\s*(?:[-*+]|\d+[.)])\s+\S/.test(l) || /\b(must|should|shall)\b/i.test(l)).length;
    return role === "prd" ? `PRD · ${reqs} requirement lines` : `${content.length.toLocaleString()} characters`;
  } catch (e) {
    return `Could not read: ${(e as Error).message}`;
  }
}

/** One numbered step of the form: number, title, optional tag and a one-line hint above its control. */
function Step({ n, title, hint, tag, done, htmlFor, children }: { n: number | null; title: string; hint?: ReactNode; tag?: string; done?: boolean; htmlFor?: string; children: ReactNode }) {
  const Title = htmlFor ? "label" : "span";
  return (
    <div className={`nb-step${done ? " is-done" : ""}`}>
      <span className={`nb-step__num${n === null ? " nb-step__num--none" : ""}`} aria-hidden="true">
        {n === null ? null : done ? <Icon name="check" size={12} /> : n}
      </span>
      <div className="nb-step__body">
        <div className="nb-step__head">
          <Title className="nb-step__title" {...(htmlFor ? { htmlFor } : {})}>
            {title}
          </Title>
          {tag ? <span className="nb-step__tag">{tag}</span> : null}
        </div>
        {hint ? <p className="nb-step__hint">{hint}</p> : null}
        {children}
      </div>
    </div>
  );
}

const STEP_NAMES = ["Describe", "Look and feel", "Name", "How hands-on"];

/**
 * New build. In `wizard` mode (the Start a prototype modal) it shows one step at a time with Back and Next: describe it
 * and attach spec files, choose the look (a visual style when the PRD doesn't set one) and extras, name it and pick a
 * starter, then choose autonomy. Only the description is required, so Start the build is on the last step and Next is the way through.
 */
export function NewBuild({ onCancel, wizard = false }: { onCancel?: () => void; wizard?: boolean }) {
  const [stepNo, setStepNo] = useState(1);
  const show = (n: number) => !wizard || stepNo === n;
  const stepBody = useRef<HTMLDivElement>(null);
  // Moving between steps puts focus on the new step's first control.
  useEffect(() => {
    if (!wizard) return;
    (stepBody.current?.querySelector<HTMLElement>("textarea") ?? stepBody.current?.querySelector<HTMLElement>("input, select, button"))?.focus();
  }, [stepNo, wizard]);
  const [description, setDescription] = useState("");
  const [name, setName] = useState("");
  const [nameTouched, setNameTouched] = useState(false);
  const [folder, setFolder] = useState<string>();
  const [refs, setRefs] = useState<Ref[]>([]);
  const [drag, setDrag] = useState(false);
  const [autonomy, setAutonomy] = useState<AutonomyLevel>("assisted");
  // Every new build starts from React + Vite + TypeScript.
  const starter = "react" as const;
  // Who writes the code: the local coder model, or the cloud coder set up on the Models page.
  const [coder, setCoder] = useState<"local" | "cloud">("local");
  const cloud = useResource<{ ready: boolean; model: string; problem: string; providerLabel?: string }>("/models/cloud-coder");
  // The coder actually configured (Models page), not a fixed name.
  const roles = useResource<{ coder?: { assignment?: { model: string } } }>("/models/roles");
  const localCoder = roles.data?.coder?.assignment?.model;
  const [template, setTemplate] = useState("clean-minimal");
  const [extras, setExtras] = useState<string[]>([]);
  // Surface style: follows the chosen template's suggestion until the user picks one.
  const [vibe, setVibe] = useState<string>();
  const [styleUrl, setStyleUrl] = useState("");
  // Extras the attached PRD already asks for start ticked (each once, so unticking sticks).
  const offered = useRef(new Set<string>());
  useEffect(() => {
    const fresh = extrasInPrd(refs).filter((id) => !offered.current.has(id));
    if (!fresh.length) return;
    fresh.forEach((id) => offered.current.add(id));
    setExtras((cur) => [...new Set([...cur, ...fresh])]);
  }, [refs]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [last] = useState(readLast);
  const [usedLast, setUsedLast] = useState(false);
  const useLast = () => {
    if (!last) return;
    setTemplate(last.template);
    setExtras(last.extras);
    if (last.vibe) setVibe(last.vibe);
    setAutonomy(last.autonomy);
    if (last.coder === "local" || cloud.data?.ready) setCoder(last.coder);
    setUsedLast(true);
  };
  const input = useRef<HTMLInputElement>(null);

  // A PRD handed over from Settings → PRD templates ("Start a prototype with it") is attached once, as the PRD.
  useEffect(() => {
    let raw: string | null = null;
    try {
      raw = sessionStorage.getItem(NEW_BUILD_PRD_KEY);
      sessionStorage.removeItem(NEW_BUILD_PRD_KEY);
    } catch {
      raw = null;
    }
    if (!raw) return;
    try {
      const { name: fileName, content, extra, description: ready } = JSON.parse(raw) as { name: string; content: string; extra?: { name: string; content: string }; description?: string };
      setRefs((cur) => [
        { name: fileName, role: "prd", content, size: content.length, summary: summarize("prd", content) },
        // Discover sends its idea summary or discovery report too, as background for the agents.
        ...(extra ? [{ name: extra.name, role: "text" as const, content: extra.content, size: extra.content.length, summary: summarize("text", extra.content) }] : []),
        ...cur.filter((r) => r.role !== "prd" && r.name !== extra?.name),
      ]);
      setDescription((d) => d || ready || "Build what the attached PRD describes.");
    } catch {
      /* malformed hand-over: ignore */
    }
  }, []);
  const quality = useMemo(() => scoreRequest(description, refs.map((r) => r.role)), [description, refs]);
  const autoName = nameTouched ? name : suggestName(description);

  const addFiles = async (files: FileList | File[]) => {
    setError(undefined);
    const next = [...refs];
    for (const f of Array.from(files)) {
      const role = roleFor(f.name, next.some((r) => r.role === "prd"));
      if (!role) {
        setError(`${f.name}: only .md, .html, .css, .json, .txt and image files are supported`);
        continue;
      }
      if (next.reduce((n, r) => n + r.size, 0) + f.size > MAX_TOTAL) {
        setError(`${f.name} would take the spec files over 6 MB in total`);
        continue;
      }
      if (f.size > MAX_FILE) {
        setError(`${f.name} is larger than 1.5 MB`);
        continue;
      }
      const read = role === "image" ? await readCaptureFile(f) : undefined;
      if (typeof read === "string") {
        setError(read);
        continue;
      }
      const content = read ? read.content : await f.text();
      next.push({ name: f.name, role, content, size: f.size, summary: summarize(role, content) });
    }
    setRefs(next);
  };

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDrag(false);
    void addFiles(e.dataTransfer.files);
  };

  const start = async () => {
    setBusy(true);
    setError(undefined);
    try {
      const res = await post<{ project: { id: string }; run: { id: string } }>("/builds", {
        description: description.trim(),
        name: autoName.trim() || undefined,
        workspacePath: folder,
        autonomy,
        starter,
        coder,
        references: refs.map(({ name: n, role, content }) => ({ name: n, role, content })),
        look: { template: prdSetsLook(refs) ? undefined : template, extras, vibe: vibe ?? suggestedVibe(refs, prdSetsLook(refs) ? undefined : template), styleUrl: styleUrl.trim() || undefined },
      });
      try {
        localStorage.setItem(LAST_KEY, JSON.stringify({ project: autoName.trim() || "your last build", template, extras, vibe, autonomy, coder, at: new Date().toISOString() } satisfies LastSettings));
      } catch {
        /* only a convenience */
      }
      navigate(`/projects/${res.project.id}/runs/${res.run.id}`);
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  };

  const meter = quality.verdict === "specific" ? "var(--sig-ok)" : quality.verdict === "workable" ? "var(--sig-warn)" : "var(--sig-bad)";
  const described = description.trim().length > 0;

  return (
    <form
      className="section reveal nb"
      data-guide="newbuild.form"
      aria-labelledby="newbuild-title"
      onSubmit={(e) => {
        e.preventDefault();
        if (wizard && stepNo < STEP_NAMES.length) {
          if (described) setStepNo(stepNo + 1);
          return;
        }
        void start();
      }}
    >
      <div className="section__head">
        <span className="stack-anim" aria-hidden="true" style={{ marginRight: 12, flex: "none" }}>
          <i />
          <i />
          <i />
          <i />
          <i />
          <i />
        </span>
        <h2 className="section__title" id="newbuild-title">
          New build
        </h2>
        <span className="label" style={{ marginLeft: "auto" }}>
          {wizard ? `Step ${stepNo} of ${STEP_NAMES.length}` : `${STEP_NAMES.length} steps · about a minute`}
        </span>
      </div>
      {wizard ? (
        <>
        {last && stepNo === 1 ? (
          <div className="nb-last" data-cp="nb-last" role="note">
            {usedLast ? (
              <span>
                <strong>Using the settings from {last.project}.</strong> Change any of them in the steps that follow.
              </span>
            ) : (
              <>
                <span>
                  Same settings as <strong>{last.project}</strong>? {DESIGN_TEMPLATES.find((t) => t.id === last.template)?.name ?? last.template}
                  {last.extras.length ? ` + ${last.extras.length} extra${last.extras.length === 1 ? "" : "s"}` : ""} · {AUTONOMY_LEVELS.find((l) => l.id === last.autonomy)?.label} · {last.coder === "cloud" ? "Cloud" : "Local"} coder
                </span>
                <button type="button" className="btn btn--sm" onClick={useLast}>
                  Use them
                </button>
              </>
            )}
          </div>
        ) : null}
        <ol className="nb-progress" aria-label="New build steps">
          {STEP_NAMES.map((name, i) => (
            <li key={name} className={i + 1 === stepNo ? "is-on" : i + 1 < stepNo ? "is-done" : ""}>
              <button type="button" onClick={() => setStepNo(i + 1)} disabled={i + 1 > stepNo && !described} aria-current={i + 1 === stepNo ? "step" : undefined}>
                <b>{i + 1 < stepNo ? <Icon name="check" size={11} /> : i + 1}</b>
                {name}
              </button>
            </li>
          ))}
        </ol>
        </>
      ) : null}
      <SetupCard compact />
      <div className="nb__proto" data-cp="nb-proto">
        <span className="nb__proto-dot" aria-hidden="true" />
        <div>
          <strong>FlowCode builds a clickable prototype: a working demo of your app on this computer.</strong>
          <div className="nb__proto-cols">
            <div>
              <span className="nb__proto-h">You get</span>
              <ul>
                <li>Real screens, links, forms and search you can click through</li>
                <li>Pretend data that saves in your browser</li>
                <li>A design checked at phone, tablet and desktop sizes</li>
              </ul>
            </div>
            <div>
              <span className="nb__proto-h">It won&apos;t, yet</span>
              <ul>
                <li>Go online or have its own web address</li>
                <li>Send anything to real people: no emails, bookings or payments</li>
                <li>Keep accounts or a shared database</li>
              </ul>
            </div>
          </div>
          <span className="nb__proto-next">When you&apos;re ready for the real thing, the project&apos;s Launch readiness checklist lists what it still needs.</span>
        </div>
      </div>
      <div className="section__body nb__steps" ref={stepBody}>
        {show(1) ? (
        <Step n={1} title="What do you want to make?" tag="Required" done={quality.verdict === "specific"} htmlFor="nb-desc" hint="Say who it’s for and what they should be able to do first. Everyday words are fine.">
          <div data-guide="newbuild.description" className="nb__field">
            <textarea id="nb-desc" data-cp="nb-desc" className="textarea" value={description} maxLength={MAX_DESC} onChange={(e) => setDescription(e.target.value)} placeholder="For example: A booking app for a small climbing gym. Members book a first lesson and see open climbing times. Staff see who is in today." required aria-describedby="nb-score" />
            <div id="nb-score" className="nb-score" aria-live="polite">
              <div className="nb-score__bar" aria-hidden="true">
                <div style={{ width: `${described ? quality.score : 0}%`, background: meter }} />
              </div>
              <span className="nb-score__val" style={{ color: described ? meter : undefined }}>
                {described ? `${quality.score}/100 · ${quality.verdict}` : "Not scored yet"}
              </span>
              <span className={`nb-count${description.length > MAX_DESC * 0.9 ? " is-near" : ""}`} aria-label={`${description.length} of ${MAX_DESC} characters`}>
                {description.length.toLocaleString()} / {MAX_DESC.toLocaleString()}
              </span>
            </div>
            {described && quality.suggestions.length ? <p className="nb-step__hint nb-step__hint--tip">{quality.suggestions.slice(0, 2).join(" ")}</p> : null}
          </div>
        </Step>
        ) : null}

        {show(1) ? (
        <Step n={null} title="Add your PRD and support files" tag="Optional" done={refs.length > 0} hint="A product plan (PRD), content as JSON, a page to copy (HTML or CSS), and screenshots or mockups of the look you want. FlowCode builds the prototype from the PRD, uses your content as the prototype's data, and captures the style from the images and pages.">
          <div data-guide="newbuild.files" className="nb__field">
            <div
              data-cp="nb-files"
              className={`nb-drop${drag ? " is-drag" : ""}`}
              onDragOver={(e) => {
                e.preventDefault();
                setDrag(true);
              }}
              onDragLeave={() => setDrag(false)}
              onDrop={onDrop}
            >
              <Upload size={22} strokeWidth={1.75} aria-hidden="true" className="nb-drop__icon" />
              <span>
                Drop files here or{" "}
                <button type="button" className="link-btn" onClick={() => input.current?.click()}>
                  choose files
                </button>
              </span>
              <span className="nb-drop__limit">Up to 1.5 MB per file · 6 MB in total{refs.length ? ` · ${(refs.reduce((n, r) => n + r.size, 0) / 1_000_000).toFixed(1)} MB used` : ""}</span>
              <span className="nb-drop__types" aria-label="Accepted file types">
                {[".md PRD", ".json content", ".html", ".css", "images"].map((t) => (
                  <span key={t} className="chip">
                    {t}
                  </span>
                ))}
              </span>
              <input ref={input} type="file" multiple accept={ACCEPT} hidden onChange={(e) => e.target.files && void addFiles(e.target.files)} />
            </div>
            {refs.length ? (
              <ul className="nb-files" aria-label="Attached spec files">
                {refs.map((r, i) => (
                  <li key={`${r.name}-${i}`}>
                    <span className="chip">{r.role}</span>
                    <span style={{ minWidth: 0 }}>
                      <span className="mono nb-files__name">
                        {r.name} <span className="muted">· {(r.size / 1024).toFixed(1)} KB</span>
                      </span>
                      <span className="muted" style={{ fontSize: 12 }}>
                        {r.summary}
                      </span>
                    </span>
                    <button type="button" className="btn btn--ghost btn--sm" aria-label={`Remove ${r.name}`} onClick={() => setRefs(refs.filter((_, j) => j !== i))}>
                      <Icon name="x" size={13} />
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        </Step>
        ) : null}

        {show(2) ? (
        <Step n={2} title="Choose the look" tag="Optional" done hint="How the app looks and feels. FlowCode applies the style when it sets up the app and builds the extras you tick.">
          <div data-guide="newbuild.look">
            <label className="nb__styleurl">
              <span className="label">Take the style from a website</span>
              <input className="input" data-cp="nb-style-url" type="url" inputMode="url" placeholder="https://example.com (optional)" value={styleUrl} onChange={(e) => setStyleUrl(e.target.value)} />
              <span className="muted">Its colours, fonts, corners and surfaces become your starting design. You can change all of it on the Design tab before the build starts.</span>
            </label>
            <LookStep refs={refs} template={template} onTemplate={setTemplate} extras={extras} onExtras={setExtras} vibe={vibe ?? suggestedVibe(refs, prdSetsLook(refs) ? undefined : template)} onVibe={setVibe} />
          </div>
        </Step>
        ) : null}

        {show(3) ? (
        <Step n={3} title="Name it" tag="Optional" done={!!autoName.trim()} hint="Filled in from your description. FlowCode makes a new folder for it on this computer.">
          <div className="nb__row">
            <input
              id="nb-name"
              aria-label="Project name"
              className="input"
              value={autoName}
              onChange={(e) => {
                setNameTouched(true);
                setName(e.target.value);
              }}
              placeholder="Project name"
            />
            <div className="nb__workspace">
              <Icon name="folder" size={14} />
              <span className="mono" title={folder}>
                {folder ?? "New folder made by FlowCode"}
              </span>
              {window.flowcode?.selectFolder ? (
                <button type="button" className="btn btn--sm" onClick={async () => setFolder((await window.flowcode!.selectFolder!()) ?? undefined)}>
                  {folder ? "Change" : "Use a folder…"}
                </button>
              ) : null}
            </div>
          </div>
          <p className="nb__starter muted" data-guide="newbuild.starter">
            Starts from <b>React + Vite + TypeScript</b>, a ready-made starting point FlowCode has tested, with a live preview.
          </p>
          <fieldset className="nb__coder" data-guide="newbuild.coder">
            <legend>Who writes the code</legend>
            <label className="check">
              <input type="radio" name="coder" checked={coder === "local"} onChange={() => setCoder("local")} /> Local model <span className="muted">· {localCoder ?? "the local coder"} on this computer. Code, design and screenshots stay here</span>
            </label>
            <label className="check">
              <input type="radio" name="coder" checked={coder === "cloud"} disabled={!cloud.data?.ready} onChange={() => setCoder("cloud")} /> Cloud model{" "}
              <span className="muted">{cloud.data?.ready ? `· ${cloud.data.model}. This project's code and screenshots are sent to that provider, which charges per use` : `· not set up yet (${cloud.data?.problem ?? "checking"}); set it up on the Models page`}</span>
            </label>
            {/* Only what FlowCode actually knows: no invented speeds or prices (VUS-07). */}
            <details className="nb__choose" data-cp="nb-help-choose-box">
              <summary data-cp="nb-help-choose" data-cp-safe>Help me choose</summary>
              <table className="nb__choose-table">
                <thead>
                  <tr>
                    <th scope="col"><span className="sr-only">Question</span></th>
                    <th scope="col">Local</th>
                    <th scope="col">Cloud</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <th scope="row">What leaves this computer?</th>
                    <td>Nothing. Code, design and screenshots stay here.</td>
                    <td>The project&apos;s code and screenshots go to {cloud.data?.providerLabel ?? "the provider"}.</td>
                  </tr>
                  <tr>
                    <th scope="row">Cost</th>
                    <td>Free. It uses this computer.</td>
                    <td>The provider charges per use. FlowCode doesn&apos;t track spending yet; your provider&apos;s dashboard shows it.</td>
                  </tr>
                  <tr>
                    <th scope="row">Quality</th>
                    <td>Measured on this computer: see first-try pass rates on the <a href="#/system/models">Models page</a>.</td>
                    <td>Not yet compared with local on the same tasks.</td>
                  </tr>
                  <tr>
                    <th scope="row">Speed</th>
                    <td colSpan={2}>Not measured side by side yet, so FlowCode doesn&apos;t claim either is faster.</td>
                  </tr>
                </tbody>
              </table>
              <p className="nb__choose-tip">Not sure? Start with Local. It costs nothing and nothing leaves this computer. You can choose Cloud for a later build.</p>
            </details>
          </fieldset>
        </Step>
        ) : null}

        {show(4) ? (
        <Step n={4} title="Choose how much FlowCode does on its own" done hint="You can change this later in the project's settings.">
          <div data-guide="newbuild.autonomy">
            <AutonomyPicker value={autonomy} onChange={setAutonomy} compact />
          </div>
        </Step>
        ) : null}

        {error ? (
          <ErrorNotice error={error} doing="start the build" />
        ) : null}
      </div>
      <div className="nb__foot">
        <span className="nb__foot-note">{described ? (autonomy === "supervised" ? "You'll approve the prototype plan and the design before anything is built." : "Routine steps run on their own. Everything is logged and can be undone.") : "Describe what you're building to start."}</span>
        {onCancel ? (
          <button className="btn btn--ghost" type="button" onClick={onCancel}>
            Cancel
          </button>
        ) : null}
        {wizard && stepNo > 1 ? (
          <button className="btn" type="button" onClick={() => setStepNo(stepNo - 1)}>
            Back
          </button>
        ) : null}
        {wizard && stepNo < STEP_NAMES.length ? (
          <button className="btn btn--primary" data-cp="nb-next" type="submit" disabled={!described}>
            Next: {STEP_NAMES[stepNo]} <Icon name="chevron" size={12} />
          </button>
        ) : (
          <button className="btn btn--primary" type="submit" disabled={busy || !described}>
            {busy ? "Starting…" : "Build the prototype"} <Icon name="chevron" size={12} />
          </button>
        )}
      </div>
    </form>
  );
}
