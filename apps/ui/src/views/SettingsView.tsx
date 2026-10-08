/**
 * System Settings: the default project policy (applied to new projects), web search, data retention and what
 * leaves this machine. Each project's own policy lives on its project settings page (linked from here, the
 * workspace header and the project menu). Appearance picks light or dark: the top-bar toggle, the system, or per page.
 */
import { DisplayModeSettings } from "../displayMode";
import { useEffect, useState, type ComponentType } from "react";
import { BookOpen, FileText, Gauge, Globe, LockKeyhole, ShieldCheck, Smartphone, SunMoon, UserRound } from "lucide-react";
import { ProjectSettings as ProjectSettingsSchema, type Project, type ProjectSettings } from "@flowcode/contracts";
import { post, useResource } from "../api";
import { navigate } from "../router";
import { Icon } from "../components/ui";
import { PolicyFields } from "../components/PolicyForm";
import { WebSearchSettings } from "../components/WebSearchSettings";
import { CopilotProfile } from "../components/CopilotProfile";
import { RuntimeSettings } from "../components/RuntimeSettings";
import { PrdTemplates } from "../components/PrdTemplates";
import { AppearanceSettings } from "../components/AppearanceSettings";
import { PhoneApprovals } from "../components/PhoneApprovals";

interface AppSettings {
  retention: { snapshotsDays: number; eventsDays: number };
  projectDefaults: ProjectSettings;
}

type SectionId = "copilot" | "explain" | "appearance" | "phone" | "prd" | "speed" | "policy" | "search" | "data";
const SECTIONS: Array<{ id: SectionId; label: string; hint: string; icon: ComponentType<{ size?: number; "aria-hidden"?: boolean }> }> = [
  { id: "copilot", label: "About you", hint: "How FlowCode addresses you, notes about you", icon: UserRound },
  { id: "explain", label: "Explanations", hint: "Plain language or technical details", icon: BookOpen },
  { id: "appearance", label: "Appearance", hint: "Light and dark: a toggle, your system, or per page", icon: SunMoon },
  { id: "phone", label: "Phone", hint: "Approvals, blocked builds and notifications on your phone", icon: Smartphone },
  { id: "prd", label: "PRD templates", hint: "Starting points for websites, SaaS, e-commerce and more", icon: FileText },
  { id: "speed", label: "Speed & recovery", hint: "Fast model, what happens when a run gets stuck", icon: Gauge },
  { id: "policy", label: "Project policy", hint: "Defaults for new projects, per-project settings", icon: ShieldCheck },
  { id: "search", label: "Web search", hint: "SearXNG, safe search, blocked sites", icon: Globe },
  { id: "data", label: "Data & privacy", hint: "Retention, what leaves this machine", icon: LockKeyhole },
];

export function SettingsView({ projects }: { projects: Project[] }) {
  // The section is part of the address (#/settings/copilot), so links can open a section directly.
  const fromHash = () => (location.hash.replace(/^#\/?/, "").split(/[/?]/)[1] ?? "") as SectionId;
  const [tab, setTab] = useState<SectionId>(() => (SECTIONS.some((x) => x.id === fromHash()) ? fromHash() : "copilot"));
  // Follow the address too (links and the Copilot's guided steps can open a section directly).
  useEffect(() => {
    const sync = () => {
      const id = fromHash();
      if (SECTIONS.some((x) => x.id === id)) setTab(id);
    };
    addEventListener("hashchange", sync);
    return () => removeEventListener("hashchange", sync);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const go = (id: SectionId) => {
    setTab(id);
    navigate(`/settings/${id}`);
  };
  const global = useResource<AppSettings>("/settings");
  const [defaults, setDefaults] = useState<ProjectSettings>();
  const [saved, setSaved] = useState<string>();
  // Older backends don't send defaults yet: start from the standard policy.
  useEffect(() => {
    if (global.data) setDefaults(global.data.projectDefaults ?? ProjectSettingsSchema.parse({}));
  }, [global.data]);

  const saveDefaults = async () => {
    if (!defaults) return;
    await post("/settings", { projectDefaults: defaults });
    setSaved("Default project policy saved. New projects will start with it.");
    global.reload();
  };

  return (
    <div className="page">
      <header className="page__head">
        <div>
          <span className="label">System</span>
          <h1 className="page__title">Settings</h1>
          <p className="lrc__meta">How FlowCode works on this computer and for each project: how hands-on builds are, what's kept and for how long, and how the app looks.</p>
        </div>
      </header>

      <div className="settings-layout">
        <nav className="settings-nav" role="tablist" aria-orientation="vertical" aria-label="Settings sections">
          {SECTIONS.map((x) => (
            <button key={x.id} type="button" role="tab" id={`settings-tab-${x.id}`} aria-selected={tab === x.id} aria-controls={`settings-panel-${x.id}`} className="settings-nav__item" onClick={() => go(x.id)}>
              <span className="settings-nav__icon" aria-hidden="true">
                <x.icon size={18} aria-hidden />
              </span>
              <span className="settings-nav__label">{x.label}</span>
              <span className="settings-nav__hint">{x.hint}</span>
            </button>
          ))}
        </nav>
        <div className="settings-panel" role="tabpanel" id={`settings-panel-${tab}`} aria-labelledby={`settings-tab-${tab}`}>
      {tab === "copilot" ? <CopilotProfile /> : null}
      {tab === "explain" ? <DisplayModeSettings /> : null}
      {tab === "appearance" ? <AppearanceSettings /> : null}
      {tab === "phone" ? <PhoneApprovals /> : null}
      {tab === "prd" ? <PrdTemplates /> : null}
      {tab === "speed" ? <RuntimeSettings /> : null}
      {tab === "search" ? <WebSearchSettings /> : null}
      {tab === "policy" ? (
        <section className="section">
          <div className="section__head">
            <h2 className="section__title">Default project policy</h2>
          </div>
          {defaults ? (
            <form
              className="section__body"
              style={{ display: "grid", gap: 14 }}
              onSubmit={(e) => {
                e.preventDefault();
                void saveDefaults();
              }}
            >
              <p className="muted" style={{ margin: 0, fontSize: 13 }}>
                New projects start with this policy. To change an existing project, open its settings below.
              </p>
              <PolicyFields s={defaults} onChange={setDefaults} idPrefix="def" />
              <button className="btn btn--primary" type="submit" style={{ justifySelf: "start" }}>
                Save default policy
              </button>
              {saved ? <p role="status" className="muted" style={{ margin: 0 }}>{saved}</p> : null}
            </form>
          ) : (
            <p className="muted" style={{ padding: 16 }}>Opening your settings…</p>
          )}
          {projects.length ? (
            <div className="section__body settings-projects">
              <span className="label">Project settings</span>
              <ul>
                {projects.map((p) => (
                  <li key={p.id}>
                    <button className="settings-projects__row" onClick={() => navigate(`/projects/${p.id}/settings`)}>
                      <span>{p.name}</span>
                      <span className="muted">{p.settings.autonomy}</span>
                      <Icon name="chevron" size={14} />
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </section>
      ) : null}
      {tab === "data" ? (
        <div style={{ display: "grid", gap: 16, alignContent: "start" }}>
          <section className="section">
            <div className="section__head">
              <h2 className="section__title">Retention</h2>
            </div>
            {global.data ? (
              <form
                className="section__body"
                style={{ display: "grid", gap: 10 }}
                onSubmit={(e) => {
                  e.preventDefault();
                  const f = new FormData(e.currentTarget);
                  void post("/settings", { retention: { snapshotsDays: Number(f.get("snap")), eventsDays: Number(f.get("events")) } }).then(() => setSaved("Retention saved"));
                }}
              >
                <div className="field">
                  <label className="label" htmlFor="snap">
                    Keep snapshots & screenshots (days)
                  </label>
                  <input id="snap" name="snap" className="input" type="number" min={1} defaultValue={global.data.retention.snapshotsDays} />
                </div>
                <div className="field">
                  <label className="label" htmlFor="events">
                    Keep activity & command logs (days)
                  </label>
                  <input id="events" name="events" className="input" type="number" min={1} defaultValue={global.data.retention.eventsDays} />
                </div>
                <button className="btn" type="submit" style={{ justifySelf: "start" }}>
                  Save retention
                </button>
              </form>
            ) : null}
          </section>
          <section className="section">
            <div className="section__head">
              <h2 className="section__title">Data that leaves this machine</h2>
            </div>
            <div className="section__body">
              <dl className="kv">
                <dt>Local models</dt>
                <dd>Nothing — prompts and code stay on this computer (Ollama on 127.0.0.1).</dd>
                <dt>Local search</dt>
                <dd>Nothing — indexes live in the local database.</dd>
                <dt>Web search</dt>
                <dd>Search queries go to your local SearXNG, which forwards them to search engines.</dd>
                <dt>Hosted models</dt>
                <dd>Disabled. Requires configuring a provider and enabling it per project.</dd>
                <dt>Installs</dt>
                <dd>Package downloads from the npm registry, after approval.</dd>
              </dl>
            </div>
          </section>
        </div>
      ) : null}
        </div>
      </div>
    </div>
  );
}

/** One project's own policy (overrides the default for that project). */
export function ProjectSettingsView({ projectId, onClose, onSaved }: { projectId: string; /** Shown in a modal: closes it. */ onClose?: () => void; /** Called after a successful save (the modal closes and confirms). */ onSaved?: () => void }) {
  const [saving, setSaving] = useState(false);
  const [justSaved, setJustSaved] = useState(false);
  const [saveError, setSaveError] = useState<string>();
  const project = useResource<{ project: Project }>(`/projects/${projectId}`, [projectId]);
  const [s, setS] = useState<ProjectSettings>();
  const [saved, setSaved] = useState<string>();
  useEffect(() => setS(project.data?.project.settings), [project.data]);
  const name = project.data?.project.name ?? "Project";
  const body = (
    <>
        {s ? (
          <form
            className="section__body"
            style={{ display: "grid", gap: 14 }}
            onSubmit={(e) => {
              e.preventDefault();
              setSaving(true);
              setSaveError(undefined);
              setSaved(undefined);
              void post(`/projects/${projectId}/settings`, s)
                .then(() => {
                  project.reload();
                  // The button itself confirms: it turns green and reads "Saved", then the modal closes.
                  setJustSaved(true);
                  setTimeout(() => {
                    setJustSaved(false);
                    onSaved?.();
                  }, 900);
                })
                .catch((err: Error) => setSaveError(`Couldn't save: ${err.message}`))
                .finally(() => setSaving(false));
            }}
          >
            <p className="muted" style={{ margin: 0, fontSize: 13 }}>
              Applies to this project only. The default for new projects is in{" "}
              <button type="button" className="link-btn" onClick={() => navigate("/settings")}>
                Settings
              </button>
              .
            </p>
            <PolicyFields s={s} onChange={setS} showApprovals idPrefix="prj" />
            {saveError ? (
              <p role="alert" className="notice notice--bad" style={{ margin: 0 }}>
                {saveError}
              </p>
            ) : null}
            <div className="settings-savebar">
            <button className={`btn btn--primary save-btn${justSaved ? " is-saved" : ""}`} type="submit" style={{ justifySelf: "start" }} disabled={saving || justSaved}>
              <span className="save-btn__label" key={justSaved ? "saved" : saving ? "saving" : "save"}>
                {justSaved ? (
                  <>
                    <Icon name="check" size={14} /> Saved
                  </>
                ) : saving ? (
                  "Saving…"
                ) : (
                  "Save project policy"
                )}
              </span>
            </button>
            </div>
            <span className="sr-only" role="status">
              {justSaved ? "Project settings saved" : ""}
            </span>
          </form>
        ) : (
          <p className="muted" style={{ padding: 16 }}>Opening this project's settings…</p>
        )}
    </>
  );
  if (onClose) {
    return (
      <section className="section proj-settings-modal" aria-labelledby="proj-settings-title">
        <div className="section__head">
          <h2 className="section__title" id="proj-settings-title">
            Project settings <span className="muted">· {name}</span>
          </h2>
          <button type="button" className="icon-btn" style={{ marginLeft: "auto" }} onClick={onClose} aria-label="Close project settings">
            <Icon name="x" size={16} />
          </button>
        </div>
        <div className="proj-settings-modal__body">{body}</div>
      </section>
    );
  }
  return (
    <div className="page">
      <button className="lrc__back back-link" onClick={() => navigate(`/projects/${projectId}`)}>
        <span style={{ transform: "rotate(180deg)", display: "inline-flex" }}>
          <Icon name="chevron" size={16} />
        </span>
        Back to {name}
      </button>
      <header className="page__head">
        <div>
          <span className="label">project settings</span>
          <h1 className="page__title">{name}</h1>
        </div>
      </header>
      <section className="section" style={{ maxWidth: 760 }}>
        <div className="section__head">
          <h2 className="section__title">Project policy</h2>
        </div>
        {body}
      </section>
    </div>
  );
}
