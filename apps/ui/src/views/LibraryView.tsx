/** Prompt & skill library (FR-K1, FR-K2): versioned specs with schemas, policies, examples and evaluations. */
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { REQUEST_TEMPLATES, type PromptSpec, type SkillSpec } from "@flowcode/contracts";
import { get, post, useResource } from "../api";
import { LayoutGrid, Plus, Search } from "lucide-react";
import { ViewLayoutToggle, useViewLayout, type ViewLayout } from "../components/ViewLayoutToggle";
import { SKILL_CATEGORIES, categoryOf, skillMatches, type SkillCategory } from "../skillCategories";
import { Tabs } from "../components/ui";
import { LibraryOverview } from "../components/LibraryOverview";
import { AgentTools } from "../components/AgentTools";
import { McpServers } from "../components/McpServers";
import { SkillProposals } from "../components/SkillProposals";
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

/**
 * Sizes the library panel to the window: from its top edge down to the sticky footer, so the page itself doesn't
 * scroll and the list and details scroll inside their own columns. Re-measured on resize.
 */
function useFitToWindow(deps: unknown[]) {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    const main = document.getElementById("main");
    if (!el || !main) return;
    const fit = () => {
      const top = el.getBoundingClientRect().top - main.getBoundingClientRect().top + main.scrollTop;
      const foot = main.querySelector(".app-footer") as HTMLElement | null;
      const footer = foot ? foot.offsetHeight + parseFloat(getComputedStyle(foot).marginTop) : 0;
      // Space below the panel inside the page: bottom padding, borders and margins of its containers.
      let below = 0;
      for (let n: HTMLElement | null = el; n && n !== main; n = n.parentElement) {
        const cs = getComputedStyle(n);
        below += parseFloat(cs.marginBottom) + (n === el ? 0 : parseFloat(cs.paddingBottom) + parseFloat(cs.borderBottomWidth));
      }
      el.style.height = `${Math.max(520, main.clientHeight - top - footer - below)}px`;
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(main);
    return () => {
      ro.disconnect();
      // The height is set by script; clear it so a view reusing this element (the card grid) isn't stuck at it.
      el.style.height = "";
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return ref;
}

/** Skills as searchable cards, grouped by what they help with; a category chip narrows the grid to one group. */
type SkillLayout = ViewLayout;

function SkillGrid({ skills, onOpen, usedBy, layout }: { skills: SkillSpec[]; onOpen: (id: string) => void; usedBy: (roles?: string[]) => string; layout: SkillLayout }) {
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<SkillCategory | "all">("all");
  const row = (x: SkillSpec) => {
    const on = x.enabled !== false;
    return (
      <li key={x.id}>
        <button type="button" className={`skill-row${on ? "" : " is-off"}`} onClick={() => onOpen(x.id)}>
          <strong className="skill-row__title">{skillTitle(x.id)}</strong>
          <span className="skill-row__purpose">{x.purpose}</span>
          <span className="skill-row__meta">
            {x.source === "user" ? <span className="chip">yours</span> : null}
            {on ? null : <span className="chip">off</span>}
            <span className="skill-row__roles">{usedBy(x.roles)}</span>
            <span className="mono skill-row__ver">v{x.version}</span>
          </span>
        </button>
      </li>
    );
  };
  const matching = skills.filter((s) => skillMatches(s, q));
  const counts = new Map<SkillCategory, number>();
  for (const s of matching) counts.set(categoryOf(s), (counts.get(categoryOf(s)) ?? 0) + 1);
  const groups = SKILL_CATEGORIES.filter((c) => (cat === "all" || c.id === cat) && counts.get(c.id));
  const card = (x: SkillSpec) => {
    const on = x.enabled !== false;
    return (
      <li key={x.id}>
        <button type="button" className={`lib-card${on ? "" : " is-off"}`} onClick={() => onOpen(x.id)}>
          <span className="lib-card__top">
            <strong className="lib-card__title">{skillTitle(x.id)}</strong>
            <span className="lib-card__ver mono">v{x.version}</span>
          </span>
          <span className="lib-card__purpose">{x.purpose}</span>
          <span className="lib-card__meta">
            <span>Used by {usedBy(x.roles)}</span>
            {x.source === "user" ? <span className="chip">yours</span> : null}
            {on ? null : <span className="chip">off</span>}
          </span>
        </button>
      </li>
    );
  };
  const total = groups.reduce((n, g) => n + (counts.get(g.id) ?? 0), 0);
  const pick = (id: SkillCategory | "all") => {
    setCat(id);
    // Back to the top of the catalogue, like choosing a shelf in the Knowledge hub.
    document.getElementById("skill-room-top")?.scrollIntoView({ block: "nearest" });
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
              <ul className={layout === "list" ? "skill-rows" : "lib-cards"} aria-label={g.label}>
                {matching.filter((s) => categoryOf(s) === g.id).map(layout === "list" ? row : card)}
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

/** One colour per category, for the spine in the nav and on each category's container (the Knowledge hub's shelves). */
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
  const [tab, setTab] = useState<"prompts" | "skills" | "tools" | "servers" | "proposals" | "pipeline">("prompts");
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
  const proposalCount = useResource<{ items: Array<{ status: string }> }>("/skill-proposals", [], 30_000).data?.items.filter((i) => i.status === "proposed").length;
  const prompts = useResource<PromptSpec[]>("/prompts");
  // Polled so skills added elsewhere (API, another window) appear without a reload.
  const skills = useResource<SkillSpec[]>("/skills", [], 15_000);
  const [selected, setSelected] = useState<string>();
  const [skillLayout, setSkillLayout] = useViewLayout("skills");
  const [promptLayout, setPromptLayout] = useViewLayout("prompts");
  const [proposalLayout, setProposalLayout] = useViewLayout("proposals");
  // Deep links from search (?tab=skills&open=skill.x): open that tab and that item.
  const linkTab = query?.get("tab");
  const linkOpen = query?.get("open");
  useEffect(() => {
    if (linkTab === "skills" || linkTab === "tools" || linkTab === "servers" || linkTab === "prompts" || linkTab === "proposals" || linkTab === "pipeline") setTab(linkTab);
    if (linkOpen) (setDraft(undefined), setPromptDraft(undefined), setSelected(linkOpen));
  }, [linkTab, linkOpen]); // eslint-disable-line react-hooks/exhaustive-deps
  /** Skill editor: a draft being created (new/imported) or the selected skill being edited. */
  const [draft, setDraft] = useState<{ spec: SkillSpec; isNew: boolean }>();
  const startNew = (spec = blankSkill()) => (setSelected(undefined), setPromptDraft(undefined), setDraft({ spec, isNew: true }));
  const [promptDraft, setPromptDraft] = useState<PromptSpec>();
  const startPrompt = (spec = blankPrompt()) => (setSelected(undefined), setDraft(undefined), setPromptDraft(spec));
  const prompt = prompts.data?.find((p) => p.id === selected);
  const skill = skills.data?.find((s) => s.id === selected);
  // Nothing open: the tab opens on a full-width grid of cards. Picking one switches to the list + details split.
  const landing = !selected && !draft && !promptDraft;
  const panelRef = useFitToWindow([tab, landing]);
  const showAll = () => (setSelected(undefined), setDraft(undefined), setPromptDraft(undefined));
  const usedBy = (roles?: string[]) => (roles?.length ? roles.map((r) => r.replace(/_/g, " ")).join(", ") : "any agent");
  return (
    <div className="page">
      <header className="page__head">
        <div>
          <span className="label">Intelligence</span>
          <h1 className="page__title">Prompts &amp; Skills</h1>
          <p className="lrc__meta">How FlowCode's agents think and act: the versioned prompts for each role, the skills they follow (design, UX, testing and more), the tools they're allowed to use, and the skills FlowCode proposes from what went wrong in past builds.</p>
        </div>
      </header>
      <div className="page-tabs">
        <Tabs label="library" value={tab} onChange={(t) => (setTab(t), setSelected(undefined), setDraft(undefined), setPromptDraft(undefined))} tabs={[{ id: "prompts", label: "Prompts", count: prompts.data?.length }, { id: "skills", label: "Skills", count: skills.data?.length }, { id: "tools", label: "Built-in tools" }, { id: "servers", label: "Connected servers" }, { id: "proposals", label: "Proposed by FlowCode", count: proposalCount || undefined }, { id: "pipeline", label: "Skill pipeline" }]} />
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
            <SkillProposals onOpenSkill={(id) => (setTab("skills"), setSelected(id))} layout={proposalLayout} layoutToggle={<ViewLayoutToggle layout={proposalLayout} setLayout={setProposalLayout} label="Show proposals as" />} />
          </div>
        ) : tab === "pipeline" ? (
          <div role="tabpanel" id="panel-library-pipeline" aria-labelledby="tab-library-pipeline" className="library-pipeline">
            <LibraryOverview embedded />
          </div>
        ) : landing ? (
          <div key="grid" role="tabpanel" id={`panel-library-${tab}`} aria-labelledby={`tab-library-${tab}`} className="library-grid">
            <div className="library-grid__bar">
              <p className="muted">
                {tab === "skills"
                  ? `${skills.data?.length ?? 0} skills. Agents use the ones that match their role and the task in front of them.`
                  : `${prompts.data?.length ?? 0} prompts. Each agent role starts from one of these; your edits are versioned.`}
              </p>
              <div className="library-grid__actions">
                {tab === "skills" ? (
                  <>
                    <ViewLayoutToggle layout={skillLayout} setLayout={setSkillLayout} label="Show skills as" />
                    <SkillImportButton onImport={(spec) => startNew(spec)} />
                    <button className="btn btn--sm btn--primary" data-cp="lib-new-skill" onClick={() => startNew()}>
                      <Plus size={14} strokeWidth={2.25} aria-hidden="true" />
                      New skill
                    </button>
                  </>
                ) : (
                  <>
                    <ViewLayoutToggle layout={promptLayout} setLayout={setPromptLayout} label="Show prompts as" />
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
              <SkillGrid skills={skills.data ?? []} onOpen={setSelected} usedBy={usedBy} layout={skillLayout} />
            ) : promptLayout === "list" ? (
              <ul className="skill-rows" aria-label="Prompts">
                {prompts.data?.map((x) => (
                  <li key={x.id}>
                    <button type="button" className="skill-row" onClick={() => setSelected(x.id)}>
                      <strong className="skill-row__title">{x.title}</strong>
                      <span className="skill-row__purpose">{x.purpose}</span>
                      <span className="skill-row__meta">
                        {x.scope !== "global" ? <span className="chip">{x.scope}</span> : null}
                        <span>{usedBy(x.roles)}</span>
                        <span className="mono">v{x.version}</span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
            <ul className="lib-cards" aria-label={tab}>
              {prompts.data?.map((x) => (
                    <li key={x.id}>
                      <button type="button" className="lib-card" onClick={() => setSelected(x.id)}>
                        <span className="lib-card__top">
                          <strong className="lib-card__title">{x.title}</strong>
                          <span className="lib-card__ver mono">v{x.version}</span>
                        </span>
                        <span className="lib-card__purpose">{x.purpose}</span>
                        <span className="lib-card__meta">
                          <span>Used by {usedBy(x.roles)}</span>
                          {x.scope !== "global" ? <span className="chip">{x.scope}</span> : null}
                        </span>
                      </button>
                    </li>
                  ))}
            </ul>
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
                      <div className="lib-card req-tpl-card">
                        <span className="lib-card__top">
                          <strong className="lib-card__title">{t.label}</strong>
                        </span>
                        <span className="lib-card__purpose">{t.description}</span>
                        <span className="lib-card__meta">
                          <span>Skills: {t.skills.map((s) => s.replace(/^skill\./, "")).join(", ")}</span>
                        </span>
                      </div>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}
            {(tab === "skills" ? skills.data : prompts.data)?.length === 0 ? (
              <p className="muted">{tab === "skills" ? "No skills yet. Create one, or import a Markdown file." : "No prompts yet. Create one, or import a Markdown file."}</p>
            ) : null}
          </div>
        ) : (
        <div key="split" ref={panelRef} role="tabpanel" id={`panel-library-${tab}`} aria-labelledby={`tab-library-${tab}`} className="library-panel">
          <div className="library-panel__list" tabIndex={-1}>
          <button type="button" className="btn btn--sm btn--ghost library-panel__back" onClick={showAll}>
            <LayoutGrid size={14} aria-hidden="true" />
            {tab === "skills" ? "All skills" : "All prompts"}
          </button>
          {tab === "prompts" ? (
            <div className="skill-toolbar">
              <button className="btn btn--sm btn--primary" onClick={() => startPrompt()}>
                <Plus size={14} strokeWidth={2.25} aria-hidden="true" />
                New prompt
              </button>
              <PromptImportButton onImport={(spec) => startPrompt(spec)} />
            </div>
          ) : null}
          {tab === "skills" ? (
            <div className="skill-toolbar">
              <button className="btn btn--sm btn--primary" onClick={() => startNew()}>
                <Plus size={14} strokeWidth={2.25} aria-hidden="true" />
                New skill
              </button>
              <SkillImportButton onImport={(spec) => startNew(spec)} />
            </div>
          ) : null}
          {tab === "skills" ? (
            <>
              <label className="skill-sort">
                <span>Sort</span>
                <select className="select" value={skillSort} onChange={(e) => setSkillSort(e.target.value as typeof skillSort)} aria-label="Sort skills">
                  <option value="recent">Recently updated</option>
                  <option value="category">By category</option>
                  <option value="name">By name</option>
                </select>
              </label>
              {(skillSort === "category"
                ? SKILL_CATEGORIES.map((c) => ({ id: c.id, label: c.label, items: (skills.data ?? []).filter((x) => categoryOf(x) === c.id) })).filter((g) => g.items.length)
                : [{ id: "all", label: "", items: skillSort === "name" ? [...(skills.data ?? [])].sort((p, q) => skillTitle(p.id).localeCompare(skillTitle(q.id))) : skills.data ?? [] }]
              ).map((g) => (
                <div key={g.id} className="skill-sort__group">
                  {g.label ? (
                    <p className="skill-sort__heading">
                      <i className="lib-shelf__spine" style={{ background: CAT_COLOR[g.id as SkillCategory] }} aria-hidden="true" />
                      {g.label} <span className="skill-browse__n">{g.items.length}</span>
                    </p>
                  ) : null}
                  <ul className="skill-cards" aria-label={g.label || "skills"}>
                    {g.items.map((x) => {
                const on = x.enabled !== false;
                return (
                  <li key={x.id}>
                    <button className={`skill-card${on ? "" : " is-off"}`} title={`Used by: ${x.roles?.length ? x.roles.map((r) => r.replace(/_/g, " ")).join(", ") : "any agent"}`} aria-current={selected === x.id} onClick={() => (setSelected(x.id), setDraft(undefined))}>
                      <span className="skill-card__top">
                        <strong>{skillTitle(x.id)}</strong>
                        {x.source === "user" ? <span className="chip">yours</span> : null}
                        {on ? null : <span className="chip">off</span>}
                        <span className="skill-card__ver mono">v{x.version}</span>
                      </span>
                      <span className="skill-card__purpose" title={x.purpose}>
                        {x.purpose}
                      </span>
                    </button>
                  </li>
                );
                    })}
                  </ul>
                </div>
              ))}
            </>
          ) : (
          // Prompts use the same card treatment as skills.
          <ul className="skill-cards" aria-label="prompts">
            {prompts.data?.map((x) => (
              <li key={x.id}>
                <button className="skill-card" title={`${x.id} · used by: ${x.roles.map((r) => r.replace(/_/g, " ")).join(", ") || "any agent"}`} aria-current={selected === x.id} onClick={() => (setSelected(x.id), setPromptDraft(undefined))}>
                  <span className="skill-card__top">
                    <strong>{x.title}</strong>
                    {x.scope !== "global" ? <span className="chip">{x.scope}</span> : null}
                    <span className="skill-card__ver mono">v{x.version}</span>
                  </span>
                  <span className="skill-card__purpose" title={x.purpose}>
                    {x.purpose}
                  </span>
                </button>
              </li>
            ))}
          </ul>
          )}
          </div>
          <div className="library-panel__detail" tabIndex={0} aria-label="Details">
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
              <PromptDetail prompt={prompt} onSaved={prompts.reload} />
            ) : skill ? (
              <SkillDetail key={skill.id + skill.version} skill={skill} onChanged={skills.reload} onEdit={() => setDraft({ spec: skill, isNew: false })} onDeleted={() => (setSelected(undefined), skills.reload())} />
            ) : (
              <p className="muted">{tab === "skills" ? "Select a skill, or create one. Agents automatically use the skills that match their role and task." : "Select an item to inspect its specification."}</p>
            )}
          </div>
        </div>
        )}
      </div>
    </div>
  );
}

function PromptDetail({ prompt, onSaved }: { prompt: PromptSpec; onSaved: () => void }) {
  const [template, setTemplate] = useState(prompt.template);
  const [versions, setVersions] = useState<PromptSpec[]>();
  const [error, setError] = useState<string>();
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
      {versions ? (
        <table className="table">
          <thead>
            <tr>
              <th>Version</th>
              <th>Changelog</th>
            </tr>
          </thead>
          <tbody>
            {versions.map((v) => (
              <tr key={v.version}>
                <td className="mono">{v.version}</td>
                <td>{v.changelog.at(-1)?.note}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : null}
      <div className="detail-actions">
        <button className="btn btn--primary" disabled={template === prompt.template} onClick={save}>
          Save as v{bump(prompt.version)}
        </button>
        <button className="btn" onClick={() => get<PromptSpec[]>(`/prompts/${prompt.id}/versions`).then(setVersions)}>
          Version history
        </button>
      </div>
    </div>
  );
}

