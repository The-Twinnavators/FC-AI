/** Prompt & skill library (FR-K1, FR-K2): versioned specs with schemas, policies, examples and evaluations. */
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { REQUEST_TEMPLATES, type PromptSpec, type SkillSpec } from "@flowcode/contracts";
import { get, post, useResource } from "../api";
import { ConfirmButton } from "../components/ConfirmButton";
import { Plus, Search } from "lucide-react";
import { SKILL_CATEGORIES, categoryOf, skillMatches, type SkillCategory } from "../skillCategories";
import { Tabs } from "../components/ui";
import { navigate } from "../router";
import { AgentTools } from "../components/AgentTools";
import { McpServers } from "../components/McpServers";
import { SkillProposals } from "../components/SkillProposals";
import { AgentHeads, CardSwitch, LibModal, VersionHistory } from "../components/LibModal";
import { PromptForm, PromptImportButton, blankPrompt } from "../components/PromptEditor";
import { SkillDetail, SkillForm, SkillImportButton, blankSkill } from "../components/SkillEditor";

/** "skill.fix-typescript-error" → "Fix typescript error". */
/** Words that keep their own spelling in a title made from an id ("seo-aeo-metadata" → "SEO AEO metadata"). */
const TITLE_WORDS: Record<string, string> = { seo: "SEO", aeo: "AEO", ui: "UI", ux: "UX", cro: "CRO", adrs: "ADRs", jsonld: "JSON-LD", aria: "ARIA", wcag: "WCAG", hig: "HIG", ios: "iOS", macos: "macOS", e2e: "E2E", prd: "PRD", mvp: "MVP", svg: "SVG", ai: "AI", api: "API", css: "CSS", qa: "QA", rls: "RLS", a11y: "a11y", typescript: "TypeScript", threejs: "three.js", react: "React", vite: "Vite", shadcn: "shadcn", postgres: "Postgres", python: "Python", angular: "Angular", anthropic: "Anthropic", emil: "Emil", jakub: "Jakub", apple: "Apple", sonner: "Sonner", playwright: "Playwright", figma: "Figma" };
const skillTitle = (id: string) => {
  const t = id
    .replace(/^skill./, "")
    .split(/[-_.]+/)
    .map((w) => TITLE_WORDS[w] ?? w)
    .join(" ");
  return t.charAt(0).toUpperCase() + t.slice(1);
};


/** Skills as searchable cards, grouped by what they help with; a category chip narrows the grid to one group. */

function SkillGrid({ skills, onOpen, onToggle }: { skills: SkillSpec[]; onOpen: (id: string) => void; onToggle: (s: SkillSpec, on: boolean) => void }) {
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<SkillCategory | "all">("all");
  const matching = skills.filter((s) => skillMatches(s, q));
  const counts = new Map<SkillCategory, number>();
  for (const s of matching) counts.set(categoryOf(s), (counts.get(categoryOf(s)) ?? 0) + 1);
  const groups = SKILL_CATEGORIES.filter((c) => (cat === "all" || c.id === cat) && counts.get(c.id));
  const card = (x: SkillSpec) => {
    const on = x.enabled !== false;
    return (
      <li key={x.id} className="has-switch">
        <button type="button" className={`lib-card${on ? "" : " is-off"}`} onClick={() => onOpen(x.id)}>
          <span className="lib-card__top">
            <strong className="lib-card__title">{skillTitle(x.id)}</strong>
            <span className="lib-card__ver mono">v{x.version}</span>
          </span>
          <span className="lib-card__purpose">{x.purpose}</span>
          <span className="lib-card__meta">
            <span className="lib-card__used">Used by <AgentHeads roles={x.roles} id={`sc-${x.id}`} max={2} /></span>
            {x.source === "user" ? <span className="chip">yours</span> : null}
          </span>
        </button>
        <CardSwitch on={on} label={`Use ${skillTitle(x.id)}`} onChange={(v) => onToggle(x, v)} />
      </li>
    );
  };
  const total = groups.reduce((n, g) => n + (counts.get(g.id) ?? 0), 0);
  const pick = (id: SkillCategory | "all") => {
    setCat(id);
    // Back to the top of the catalog, like choosing a shelf in the Knowledge hub.
    // Scrolled down into the list: go back up to its top (just under the top bar); already above it: stay put.
    const top = document.getElementById("skill-room-top");
    if (top && top.getBoundingClientRect().top < 72) top.scrollIntoView({ block: "start", behavior: "smooth" });
  };
  return (
    <div className="skill-room">
      <nav className="lib-shelves skill-room__nav" aria-label="Skill categories">
        <button type="button" className="lib-shelf" aria-current={cat === "all"} onClick={() => pick("all")} title="All skills">
          <i className="lib-shelf__spine" style={{ background: "var(--text-2)" }} aria-hidden="true" />
          <span className="lib-shelf__label">All skills</span>
          <span className="lib-shelf__count">{matching.length}</span>
        </button>
        <p className="lib-shelves__heading">Categories</p>
        {SKILL_CATEGORIES.filter((c) => counts.get(c.id)).map((c) => (
          <button key={c.id} type="button" className="lib-shelf" aria-current={cat === c.id} onClick={() => pick(c.id)} title={c.hint}>
            <i className="lib-shelf__spine" style={{ background: CAT_COLOR[c.id] }} aria-hidden="true" />
            <span className="lib-shelf__label">{c.label}</span>
            <span className="lib-shelf__count">{counts.get(c.id)}</span>
          </button>
        ))}
      </nav>
      <div className="skill-browse" id="skill-room-top">
        <div className="skill-browse__filters">
          <label className="skill-browse__search">
            <Search size={15} aria-hidden="true" />
            <span className="sr-only">Search skills</span>
            <input type="search" className="input" placeholder="Search skills by name, purpose or trigger" value={q} onChange={(e) => setQ(e.target.value)} />
          </label>
        </div>
        <p className="sr-only" role="status">{`${total} skills shown`}</p>
        {groups.length ? (
          groups.map((g) => (
            <section key={g.id} className="skill-browse__group" aria-labelledby={`skill-cat-${g.id}`}>
              <header className="skill-browse__head">
                <i className="lib-shelf__spine" style={{ background: CAT_COLOR[g.id] }} aria-hidden="true" />
                <h3 id={`skill-cat-${g.id}`} className="skill-browse__title">
                  {g.label} <span className="skill-browse__n">{counts.get(g.id)}</span>
                </h3>
                <p className="muted skill-browse__hint">{g.hint}</p>
              </header>
              <ul className="lib-cards" aria-label={g.label}>
                {matching.filter((s) => categoryOf(s) === g.id).map(card)}
              </ul>
            </section>
          ))
        ) : (
          <div className="skill-browse__empty">
            <p>No skills match &ldquo;{q}&rdquo;.</p>
            <button type="button" className="btn btn--sm" onClick={() => (setQ(""), setCat("all"))}>
              Clear search
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

/** One color per category, for the spine in the nav and on each category's container (the Knowledge hub's shelves). */
export const CAT_COLOR: Record<SkillCategory, string> = {
  planning: "#84a0db",
  design: "#a78bfa",
  recipes: "#f0a35e",
  process: "#5fb8a6",
  quality: "#e07a8f",
  code: "#7fb069",
  growth: "#d9b44a",
  learned: "var(--line-strong)",
  yours: "var(--text-2)",
};

export function LibraryView({ query }: { query?: URLSearchParams } = {}) {
  const [tab, setTab] = useState<"prompts" | "skills" | "tools" | "servers" | "proposals">("prompts");
  const [skillSort, setSkillSort] = useState<"recent" | "category" | "name">(() => {
    try {
      const v = localStorage.getItem("flowcode.skillSort");
      return v === "category" || v === "name" ? v : "recent";
    } catch {
      return "recent";
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem("flowcode.skillSort", skillSort);
    } catch {
      /* private mode */
    }
  }, [skillSort]);
  // Every list tab shows how many it holds (proposals waiting for you are flagged by the sidebar and Approvals badges).
  const proposalCount = useResource<{ items: Array<{ status: string }> }>("/skill-proposals", [], 30_000).data?.items.filter((i) => i.status !== "dismissed").length;
  const toolCount = useResource<unknown[]>("/system/tools", [], 0).data?.length;
  const serverCount = useResource<{ servers: unknown[] }>("/mcp/servers", [], 30_000).data?.servers.length;
  const prompts = useResource<Array<PromptSpec & { builtin?: boolean }>>("/prompts");
  // Polled so skills added elsewhere (API, another window) appear without a reload.
  const skills = useResource<SkillSpec[]>("/skills", [], 15_000);
  const [selected, setSelected] = useState<string>();
  // The build prompt open in the modal (built in, so read-only).
  const [tplId, setTplId] = useState<string>();
  const tpl = REQUEST_TEMPLATES.find((t) => t.id === tplId);
  // Deep links from search (?tab=skills&open=skill.x): open that tab and that item.
  const linkTab = query?.get("tab");
  const linkOpen = query?.get("open");
  useEffect(() => {
    if (linkTab === "skills" || linkTab === "tools" || linkTab === "servers" || linkTab === "prompts" || linkTab === "proposals") setTab(linkTab);
    // The skill pipeline moved to Data process → Skill pipeline; old links go there.
    if (linkTab === "pipeline") navigate("/pipeline");
    if (linkOpen) (setDraft(undefined), setPromptDraft(undefined), setSelected(linkOpen));
  }, [linkTab, linkOpen]); // eslint-disable-line react-hooks/exhaustive-deps
  /** Skill editor: a draft being created (new/imported) or the selected skill being edited. */
  const [draft, setDraft] = useState<{ spec: SkillSpec; isNew: boolean }>();
  const startNew = (spec = blankSkill()) => (setSelected(undefined), setPromptDraft(undefined), setDraft({ spec, isNew: true }));
  const [promptDraft, setPromptDraft] = useState<PromptSpec>();
  const startPrompt = (spec = blankPrompt()) => (setSelected(undefined), setDraft(undefined), setPromptDraft(spec));
  const prompt = prompts.data?.find((p) => p.id === selected);
  const skill = skills.data?.find((s) => s.id === selected);
  // Nothing open: just the cards. Picking one (or New / Import) opens it in a modal over them.
  const landing = !selected && !draft && !promptDraft;
  const showAll = () => (setSelected(undefined), setDraft(undefined), setPromptDraft(undefined));
  return (
    <div className="page">
      <header className="page__head">
        <div>
          <span className="label">Intelligence</span>
          <h1 className="page__title">Prompts &amp; Skills</h1>
          <p className="lrc__meta">How FlowCode's agents think and act: the versioned prompts for each role, the skills they follow (design, UX, testing and more) including the ones FlowCode proposes from what went wrong in past builds, and the tools they're allowed to use.</p>
        </div>
      </header>
      <div className="page-tabs">
        <Tabs label="library" value={tab} onChange={(t) => (setTab(t), setSelected(undefined), setDraft(undefined), setPromptDraft(undefined))} tabs={[{ id: "prompts", label: "Prompts", count: prompts.data ? prompts.data.length + REQUEST_TEMPLATES.length : undefined }, { id: "skills", label: "Skills", count: skills.data?.length }, { id: "proposals", label: "Proposed by FlowCode", count: proposalCount }, { id: "tools", label: "Built-in tools", count: toolCount }, { id: "servers", label: "Connected servers", count: serverCount }]} />
        {tab === "tools" ? (
          <div role="tabpanel" id="panel-library-tools" aria-labelledby="tab-library-tools" className="library-tools">
            <AgentTools />
          </div>
        ) : tab === "servers" ? (
          <div role="tabpanel" id="panel-library-servers" aria-labelledby="tab-library-servers" className="library-tools">
            <McpServers />
          </div>
        ) : tab === "proposals" ? (
          <div role="tabpanel" id="panel-library-proposals" aria-labelledby="tab-library-proposals" className="library-grid">
            <SkillProposals onOpenSkill={(id) => (setTab("skills"), setSelected(id))} />
          </div>
        ) : (
          <div key="grid" role="tabpanel" id={`panel-library-${tab}`} aria-labelledby={`tab-library-${tab}`} className="library-grid">
            <div className="library-grid__bar">
              <p className="muted">
                {tab === "skills"
                  ? `${skills.data?.length ?? 0} skills. Agents use the ones that match their role and the task in front of them.`
                  : `${(prompts.data?.length ?? 0) + REQUEST_TEMPLATES.length} prompts: ${prompts.data?.length ?? 0} that each agent starts from (yours to edit, every edit versioned) and ${REQUEST_TEMPLATES.length} build prompts FlowCode applies on its own.`}
              </p>
              <div className="library-grid__actions">
                {tab === "skills" ? (
                  <>
                    <SkillImportButton onImport={(spec) => startNew(spec)} />
                    <button className="btn btn--sm btn--primary" data-cp="lib-new-skill" onClick={() => startNew()}>
                      <Plus size={14} strokeWidth={2.25} aria-hidden="true" />
                      New skill
                    </button>
                  </>
                ) : (
                  <>
                    <PromptImportButton onImport={(spec) => startPrompt(spec)} />
                    <button className="btn btn--sm btn--primary" data-cp="lib-new-prompt" onClick={() => startPrompt()}>
                      <Plus size={14} strokeWidth={2.25} aria-hidden="true" />
                      New prompt
                    </button>
                  </>
                )}
              </div>
            </div>
            {tab === "skills" ? (
              <SkillGrid skills={skills.data ?? []} onOpen={setSelected} onToggle={(s, on) => void post("/skills", { ...s, enabled: on }).then(skills.reload)} />
            ) : (
            <>
            <h3 className="styles-group__title lib-group-title">
              Agent prompts <span className="muted">{prompts.data?.length ?? 0}</span>
            </h3>
            <ul className="lib-cards" aria-label="Agent prompts">
              {prompts.data?.map((x) => (
                    <li key={x.id}>
                      <button type="button" className="lib-card" onClick={() => setSelected(x.id)}>
                        <span className="lib-card__top">
                          <strong className="lib-card__title">{x.title}</strong>
                          <span className="lib-card__ver mono">v{x.version}</span>
                        </span>
                        <span className="lib-card__purpose">{x.purpose}</span>
                        <span className="lib-card__meta">
                          <span className="lib-card__used">Used by <AgentHeads roles={x.roles} id={`pc-${x.id}`} max={2} /></span>
                          {x.scope !== "global" ? <span className="chip">{x.scope}</span> : null}
                        </span>
                      </button>
                    </li>
                  ))}
            </ul>
            </>
            )}
            {tab === "prompts" ? (
              <section className="req-tpls" aria-labelledby="req-tpls-title">
                <h3 id="req-tpls-title" className="styles-group__title">
                  Build prompts <span className="muted">{REQUEST_TEMPLATES.length}</span>
                </h3>
                <p className="muted req-tpls__lede">FlowCode applies these on its own. When your request or PRD describes one of these features, the planner gets its guidance and the coding steps get its skills.</p>
                <ul className="lib-cards" aria-label="Build prompts">
                  {REQUEST_TEMPLATES.map((t) => (
                    <li key={t.id}>
                      <button type="button" className="lib-card req-tpl-card" onClick={() => setTplId(t.id)}>
                        <span className="lib-card__top">
                          <strong className="lib-card__title">{t.label}</strong>
                          <span className="chip">built in</span>
                        </span>
                        <span className="lib-card__purpose">{t.description}</span>
                        <span className="lib-card__meta">
                          <span>
                            {t.skills.length} skill{t.skills.length === 1 ? "" : "s"}: {t.skills.map((id) => skillTitle(id)).join(", ")}
                          </span>
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}
            {(tab === "skills" ? skills.data : prompts.data)?.length === 0 ? (
              <p className="muted">{tab === "skills" ? "No skills yet. Create one, or import a Markdown file." : "No prompts yet. Create one, or import a Markdown file."}</p>
            ) : null}
          </div>
        )}
      </div>
      {tpl ? (
        <LibModal label="Build prompt · built in" onClose={() => setTplId(undefined)}>
          <div className="tpl-detail">
            <div>
              <h2 className="tpl-detail__title">{tpl.label}</h2>
              <p className="dim">{tpl.description}</p>
            </div>
            <p className="muted tpl-detail__how">FlowCode applies this on its own: when your request or PRD describes this kind of feature, the planner gets this outline and the coding steps get its skills.</p>
            <section className="tpl-detail__section">
              <span className="label">Skills it brings in</span>
              <ul className="tpl-detail__skills">
                {tpl.skills.map((id) => {
                  const sk = skills.data?.find((x) => x.id === id);
                  return (
                    <li key={id}>
                      <button type="button" className="tpl-skill" onClick={() => (setTplId(undefined), setTab("skills"), setSelected(id))}>
                        <strong>{skillTitle(id)}</strong>
                        {sk ? <span className="muted">{sk.purpose}</span> : null}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </section>
            <section className="tpl-detail__section">
              <span className="label">The outline the planner works from</span>
              <pre className="tpl-detail__body">{tpl.body}</pre>
            </section>
          </div>
        </LibModal>
      ) : null}
      {!landing ? (
        // A prompt or skill opens in a modal over the cards, so the page behind it stays where it was.
        <LibModal onClose={showAll} label={promptDraft ? "New prompt" : draft ? (draft.isNew ? "New skill" : "Edit skill") : prompt ? "Prompt" : "Skill"}>
              {promptDraft ? (
                <PromptForm
                  key={promptDraft.title + promptDraft.template.length}
                  initial={promptDraft}
                  existingIds={(prompts.data ?? []).map((x) => x.id)}
                  onSaved={(id) => (setPromptDraft(undefined), setSelected(id), prompts.reload())}
                  onCancel={() => setPromptDraft(undefined)}
                />
              ) : draft ? (
                <SkillForm
                  key={draft.spec.id + draft.spec.version + draft.isNew}
                  initial={draft.spec}
                  isNew={draft.isNew}
                  existingIds={(skills.data ?? []).map((x) => x.id)}
                  onSaved={(id) => (setDraft(undefined), setSelected(id), skills.reload())}
                  onCancel={() => setDraft(undefined)}
                />
              ) : prompt ? (
                <PromptDetail prompt={prompt} onSaved={prompts.reload} onDeleted={() => (setSelected(undefined), prompts.reload())} />
              ) : skill ? (
                <SkillDetail key={skill.id + skill.version} skill={skill} onChanged={skills.reload} onEdit={() => setDraft({ spec: skill, isNew: false })} onDeleted={() => (setSelected(undefined), skills.reload())} />
              ) : (
                null
              )}
        </LibModal>
      ) : null}
    </div>
  );
}

function PromptDetail({ prompt, onSaved, onDeleted }: { prompt: PromptSpec & { builtin?: boolean }; onSaved: () => void; onDeleted: () => void }) {
  const [template, setTemplate] = useState(prompt.template);
  const [error, setError] = useState<string>();
  const remove = async () => {
    setError(undefined);
    try {
      await post(`/prompts/${encodeURIComponent(prompt.id)}/delete`, {});
      onDeleted();
    } catch (e) {
      setError((e as Error).message);
    }
  };
  const bump = (v: string) => {
    const [a, b] = v.split(".").map(Number);
    return `${a}.${(b ?? 0) + 1}.0`;
  };
  const save = async () => {
    setError(undefined);
    const version = bump(prompt.version);
    try {
      await post("/prompts", { ...prompt, template, version, changelog: [...prompt.changelog, { version, date: new Date().toISOString().slice(0, 10), note: "Edited in Prompts & Skills" }] });
      onSaved();
    } catch (e) {
      setError((e as Error).message);
    }
  };
  return (
    <div style={{ display: "grid", gap: 12 }} key={prompt.id + prompt.version}>
      <div>
        <h2 style={{ margin: 0, fontSize: 18 }}>{prompt.title}</h2>
        <p className="dim" style={{ margin: "4px 0 0" }}>{prompt.purpose}</p>
      </div>
      <dl className="kv">
        <dt>Roles</dt>
        <dd>{prompt.roles.join(", ")}</dd>
        <dt>Inputs</dt>
        <dd className="mono">{prompt.inputs.join(", ") || "—"}</dd>
        <dt>Output schema</dt>
        <dd className="mono">{prompt.outputSchema ?? "—"}</dd>
        <dt>Constraints</dt>
        <dd>{prompt.constraints.join(" · ") || "—"}</dd>
        <dt>Evaluations</dt>
        <dd className="mono">{prompt.evaluations.map((e) => JSON.stringify(e)).join(" ") || "—"}</dd>
        <dt>Owner / scope</dt>
        <dd>
          {prompt.owner} · {prompt.scope}
        </dd>
      </dl>
      <div className="field">
        <label className="label" htmlFor="tpl">
          Template (v{prompt.version})
        </label>
        <textarea id="tpl" className="textarea mono" style={{ minHeight: 260, fontSize: 11 }} value={template} onChange={(e) => setTemplate(e.target.value)} />
      </div>
      {error ? <p role="alert" className="notice notice--bad">{error}</p> : null}
      <VersionHistory path={`/prompts/${prompt.id}/versions`} current={prompt.version} />
      <div className="detail-actions">
        <button className="btn btn--primary" disabled={template === prompt.template} onClick={save}>
          Save as v{bump(prompt.version)}
        </button>
        {/* Built-ins are seeded again on every start, so Delete there would undo itself. Say why instead. */}
        {prompt.builtin ? (
          <span className="muted" style={{ marginLeft: "auto", fontSize: 12 }}>Built in — FlowCode keeps this one. Your edits to it are kept too.</span>
        ) : (
          <span style={{ marginLeft: "auto" }}>
            <ConfirmButton
              className="btn btn--ghost"
              data-cp="lib-delete-prompt"
              question={`Delete ${prompt.title}? ${prompt.roles.length ? `${prompt.roles.join(", ")} will stop using it. ` : ""}Its version history goes too, and this cannot be undone.`}
              confirmLabel="Delete prompt"
              onConfirm={remove}
            >
              Delete
            </ConfirmButton>
          </span>
        )}
      </div>
    </div>
  );
}

