/** Knowledge hub (§4.2, FR-K3–K5, FR-R1–R3): search with provenance, pin/exclude, notes and research. */
import { DesignPlaybook } from "../components/DesignPlaybook";
import { useEffect, useRef, useState } from "react";
import type { KnowledgeItem, Project, ResearchJob } from "@flowcode/contracts";
import { get, post, useResource } from "../api";
import { Empty, Icon, StatusChip, Tabs, ago, ErrorNotice } from "../components/ui";
import { BadgeCheck, LayoutGrid, List, Pin } from "lucide-react";
import { KnowledgeKindIcon } from "../components/KnowledgeKindIcon";
import { Markdown } from "../components/Markdown";
import { KnowledgeUpload } from "../components/KnowledgeUpload";
import { Modal } from "../components/Modal";

interface SearchResult {
  kind: string;
  id: string;
  title: string;
  snippet: string;
  provenance: string;
  pinned?: boolean;
}

export function KnowledgeView({ query, projects }: { query: URLSearchParams; projects: Project[] }) {
  // Global only by default; a link to a project item opens that project.
  const [projectId, setProjectId] = useState(query.get("projectId") ?? "");
  const [q, setQ] = useState(query.get("q") ?? "");
  const [semantic, setSemantic] = useState(false);
  const [results, setResults] = useState<{ results: SearchResult[]; semantic: Array<{ id: string; title: string; similarity: number }> }>();
  const [searching, setSearching] = useState(false);
  // "Global only" (no project) lists Global items only, not every project's items.
  const items = useResource<KnowledgeItem[]>(`/knowledge?${projectId ? `projectId=${projectId}` : "scope=global"}`, [projectId]);
  const research = useResource<ResearchJob[]>(projectId ? `/research/jobs?projectId=${projectId}` : null, [projectId], 4000);
  const [focus, setFocus] = useState<string | null>(query.get("focus"));
  const linkFocus = query.get("focus");
  const linkProject = query.get("projectId");
  useEffect(() => {
    if (!linkFocus) return;
    // The item may live in another project or in Global (empty projectId): show that shelf so it can open.
    if (linkProject !== null) setProjectId(linkProject);
    setFocus(linkFocus);
  }, [linkFocus, linkProject]);
  /** When set, the Knowledge cards list shows only what one research job saved. */
  const [onlyResearch, setOnlyResearch] = useState<{ question: string; ids: string[] } | null>(null);

  // Default to the first project only until a choice is made: "Global only" is a real choice (an empty id), so it
  // must not be switched back to a project the moment it's picked.
  const chosen = useRef(query.has("projectId"));

  const search = async (text = q) => {
    if (!text.trim()) return setResults(undefined);
    setSearching(true);
    try {
      setResults(await get(`/knowledge/search?q=${encodeURIComponent(text)}${projectId ? `&projectId=${projectId}` : ""}${semantic ? "&semantic=1" : ""}`));
    } finally {
      setSearching(false);
    }
  };
  useEffect(() => {
    if (query.get("q")) void search(query.get("q")!);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const focused = items.data?.find((k) => k.id === focus);
  const [tab, setTab] = useState<DeskTab>("catalogue");
  const [shelf, setShelf] = useState<string>("all");
  const [sort, setSort] = useState<SortKey>("newest");
  const [view, setView] = useState<"cards" | "list">("cards");
  const [filter, setFilter] = useState("");
  const [catPage, setCatPage] = useState(0);
  useEffect(() => setCatPage(0), [shelf, filter, sort, projectId]);

  const all = items.data ?? [];
  const jobs = research.data ?? [];
  const shelves = buildShelves(all, jobs);
  const current = shelves.find((s) => s.id === shelf) ?? shelves[0];
  const needle = filter.trim().toLowerCase();
  const shown = sortItems(
    all.filter((k) => current.match(k) && (!needle || `${k.title} ${k.content} ${k.tags.join(" ")}`.toLowerCase().includes(needle))),
    sort,
  );
  // Sections of one uploaded document share a card; the reader pages through them.
  const docParts = new Map<string, KnowledgeItem[]>();
  for (const k of all) {
    const key = docKey(k);
    if (key) docParts.set(key, [...(docParts.get(key) ?? []), k]);
  }
  for (const list of docParts.values()) list.sort((a, b) => partNo(a) - partNo(b));
  const cards: KnowledgeItem[] = [];
  const seen = new Set<string>();
  for (const k of shown) {
    const key = docKey(k);
    if (!key) cards.push(k);
    else if (!seen.has(key)) {
      seen.add(key);
      cards.push(docParts.get(key)?.[0] ?? k);
    }
  }
  // Research "Show them" opens that research's own shelf.
  useEffect(() => {
    if (onlyResearch) {
      const job = jobs.find((j) => j.question === onlyResearch.question);
      if (job) setShelf(`research:${job.id}`);
      setTab("catalogue");
      setOnlyResearch(null);
    }
  }, [onlyResearch]); // eslint-disable-line react-hooks/exhaustive-deps
  const callNo = new Map(all.map((k, i) => [k.id, `${KIND_CODE[k.kind] ?? "ITM"}·${String(all.length - i).padStart(4, "0")}`]));
  // Opening from search results: show the Catalog, make sure the item's shelf is in view, then bring the reading
  // pane on screen (it sits below the search results).
  const [scrollTo, setScrollTo] = useState<string | null>(null);
  const openItem = (id: string) => {
    setTab("catalogue");
    setFilter("");
    if (!all.some((k) => k.id === id)) items.reload();
    setFocus(id);
    setScrollTo(id);
  };
  useEffect(() => {
    if (!scrollTo || !focused || focused.id !== scrollTo) return;
    if (!current.match(focused)) setShelf(focused.excluded ? "excluded" : "all");
    requestAnimationFrame(() => document.querySelector(".lib-reader")?.scrollIntoView({ behavior: "smooth", block: "start" }));
    setScrollTo(null);
  }, [scrollTo, focused]); // eslint-disable-line react-hooks/exhaustive-deps
  const shelfOf = (k: KnowledgeItem) => shelves.find((s) => s.id !== "all" && s.id !== "pinned" && !s.id.startsWith("research:") && s.match(k));

  return (
    <div className="page lib">
      <header className="page__head">
        <div>
          <span className="label">Intelligence</span>
          <h1 className="page__title lib__title">Knowledge Hub</h1>
          <p className="lib__lede">
            {(shelves[0]?.count ?? 0)} item{shelves[0]?.count === 1 ? "" : "s"} on {shelves.filter((s) => s.count && s.id !== "all" && !s.id.startsWith("research:")).length} shelves. {projectId ? "Everything here is what agents on this project can look up." : "Global items: every project's agents can look these up."}
          </p>
        </div>
        <div className="kh-actions" style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", justifyContent: "flex-end" }}>
        <KnowledgeUpload projectId={projectId} onDone={() => items.reload()} />
        <select className="select" data-cp="knowledge-project" style={{ width: 240 }} aria-label="Project" value={projectId} onChange={(e) => ((chosen.current = true), setProjectId(e.target.value))}>
          <option value="">Global only</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        </div>
      </header>

      <form
        role="search"
        className="section"
        data-guide="knowledge.search"
        onSubmit={(e) => {
          e.preventDefault();
          void search();
        }}
      >
        <div className="section__body" style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <label htmlFor="kq" className="sr-only">
            Search
          </label>
          <input id="kq" className="input" style={{ flex: 1, minWidth: 240 }} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search files, decisions, sources, prompts, skills and run history" />
          <label className="check">
            <input type="checkbox" checked={semantic} onChange={(e) => setSemantic(e.target.checked)} /> Semantic (local embeddings)
          </label>
          <button className="btn btn--primary" type="submit" disabled={searching}>
            <Icon name="search" size={14} /> Search
          </button>
        </div>
      </form>
      {results ? (
        <SearchResultsModal
          query={q}
          results={results}
          items={all}
          onClose={() => setResults(undefined)}
          onChange={items.reload}
          shelfOf={(k) => shelfOf(k)?.label}
          callNo={(id) => callNo.get(id)}
        />
      ) : null}

      <div className="lib__tabs">
        <Tabs
          label="library"
          value={tab}
          onChange={setTab}
          tabs={[
            { id: "catalogue", label: "Catalogue", count: shelves[0]?.count },
            { id: "playbook", label: "Design playbook" },
            { id: "research", label: "Research desk", count: jobs.filter((j) => j.status === "awaiting_approval").length || undefined },
            { id: "note", label: "Write a note" },
          ]}
        />
      </div>

      {tab === "catalogue" ? (
        <div role="tabpanel" id="panel-library-catalogue" aria-labelledby="tab-library-catalogue" className="lib__room">
          <nav className="lib-shelves" aria-label="Shelves">
            {shelves
              .filter((s) => s.count || s.id === "all")
              .map((s) =>
                s.heading ? (
                  <p key={s.id} className="lib-shelves__heading">
                    {s.label}
                  </p>
                ) : (
                  <button key={s.id} type="button" className={`lib-shelf${s.child ? " lib-shelf--child" : ""}`} aria-current={s.id === current.id} onClick={() => setShelf(s.id)} title={s.label}>
                    <i className="lib-shelf__spine" style={{ background: s.color }} aria-hidden="true" />
                    <span className="lib-shelf__label">{s.label}</span>
                    <span className="lib-shelf__count">{s.count}</span>
                  </button>
                ),
              )}
          </nav>

          <section className="lib-catalogue" aria-labelledby="lib-shelf-title">
            <div className="lib-catalogue__head">
              <div>
                <h2 id="lib-shelf-title" className="lib-catalogue__title">
                  {current.label}
                </h2>
                <p className="lib-catalogue__desc">{current.description}</p>
              </div>
              <div className="lib-tools">
                <label className="sr-only" htmlFor="lib-filter">
                  Filter this shelf
                </label>
                <input id="lib-filter" className="input" placeholder="Filter this shelf…" value={filter} onChange={(e) => setFilter(e.target.value)} />
                <label className="sr-only" htmlFor="lib-sort">
                  Sort
                </label>
                <select id="lib-sort" className="select" value={sort} onChange={(e) => setSort(e.target.value as SortKey)}>
                  <option value="newest">Newest first</option>
                  <option value="oldest">Oldest first</option>
                  <option value="title">Title A–Z</option>
                  <option value="confidence">Most trusted first</option>
                </select>
                <div className="lib-view" role="radiogroup" aria-label="Layout">
                  <button type="button" role="radio" aria-checked={view === "cards"} aria-label="Cards" title="Cards" onClick={() => setView("cards")}>
                    <LayoutGrid size={15} aria-hidden="true" />
                  </button>
                  <button type="button" role="radio" aria-checked={view === "list"} aria-label="List" title="List" onClick={() => setView("list")}>
                    <List size={15} aria-hidden="true" />
                  </button>
                </div>
              </div>
            </div>

            {shown.length ? (
              <>
              <p className="lib-range">
                Showing {catPage * CAT_PAGE + 1}–{Math.min(cards.length, (catPage + 1) * CAT_PAGE)} of {cards.length}
              </p>
              <ul className={`lib-grid lib-grid--${view}`} aria-label={`${current.label}: ${shown.length} items`}>
                {cards.slice(catPage * CAT_PAGE, (catPage + 1) * CAT_PAGE).map((k, i) => {
                  const home = shelfOf(k);
                  const site = siteOf(k);
                  return (
                    <li key={k.id} style={{ ["--i" as string]: Math.min(i, 12) }}>
                      <button type="button" className="lib-card" aria-current={focus === k.id} onClick={() => setFocus(focus === k.id ? null : k.id)} style={{ ["--spine" as string]: home?.color ?? "var(--line-strong)" }}>
                        <span className="lib-card__top">
                          <i className="lib-card__dot" aria-hidden="true" />
                          <KnowledgeKindIcon kind={k.kind} size={13} />
                          <span className="lib-card__kind">{KIND_LABEL[k.kind] ?? k.kind}</span>
                          <span className="lib-card__call">{callNo.get(k.id)}</span>
                        </span>
                        <span className="lib-card__title">{docKey(k) ?? cardTitle(k)}</span>
                        {view === "cards" ? <span className="lib-card__excerpt">{excerpt(k.content)}</span> : null}
                        <span className="lib-card__meta">
                          {site ? <span className="lib-card__site">{site}</span> : null}
                          {(docParts.get(docKey(k) ?? "")?.length ?? 0) > 1 ? <span className="lib-card__parts">{docParts.get(docKey(k)!)!.length} parts</span> : null}
                          <span>{ago(k.updatedAt)}</span>
                          <Trust level={k.confidence} />
                          {k.pinned ? <Pin size={12} aria-label="Pinned" /> : null}
                          {k.confirmedByUser ? <BadgeCheck size={12} aria-label="Confirmed by you" className="lib-card__ok" /> : null}
                          {k.excluded ? <span className="lib-card__aside">set aside</span> : null}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
              <LibPager
                page={catPage}
                pages={Math.ceil(cards.length / CAT_PAGE)}
                label="Catalog pages"
                onChange={(p) => {
                  setCatPage(p);
                  document.querySelector(".lib-catalogue")?.scrollIntoView({ behavior: "smooth", block: "start" });
                }}
              />
              </>
            ) : (
              <div className="lib-empty">
                <Empty title={all.length ? (needle ? "Nothing on this shelf matches" : "This shelf is empty") : "The Knowledge Hub is empty"}>
                  {all.length ? "Try another shelf or clear the filter." : "Upload documents, write a note, or run research from the Research desk."}
                </Empty>
              </div>
            )}
          </section>

          {focused ? (
            <Modal onClose={() => setFocus(null)} labelledBy={`k-${focused.id}`} className="reader-modal">
              <ReadingPane item={focused} shelf={shelfOf(focused)?.label} callNo={callNo.get(focused.id)} onClose={() => setFocus(null)} onChange={items.reload} parts={docParts.get(docKey(focused) ?? "")} onPart={setFocus} projects={projects} />
            </Modal>
          ) : null}
        </div>
      ) : null}

      {tab === "research" ? (
        <div role="tabpanel" id="panel-library-research" aria-labelledby="tab-library-research" className="lib__desk">
          {projectId ? (
            <ResearchPanel projectId={projectId} jobs={jobs} onChange={() => (research.reload(), items.reload())} onShow={(question, ids) => setOnlyResearch({ question, ids })} />
          ) : (
            <Empty title="Pick a project">Research is saved to a project&apos;s shelves.</Empty>
          )}
        </div>
      ) : null}
      {tab === "note" ? (
        <div role="tabpanel" id="panel-library-note" aria-labelledby="tab-library-note" className="lib__desk">
          <NewNote
            projectId={projectId}
            onSaved={() => {
              items.reload();
              setShelf("notes");
              setTab("catalogue");
            }}
          />
        </div>
      ) : null}
      {tab === "playbook" ? (
        <div role="tabpanel" id="panel-library-playbook" aria-labelledby="tab-library-playbook" className="lib__desk">
          <DesignPlaybook />
        </div>
      ) : null}
    </div>
  );
}

type DeskTab = "catalogue" | "playbook" | "research" | "note";
type SortKey = "newest" | "oldest" | "title" | "confidence";

interface Shelf {
  id: string;
  label: string;
  description?: string;
  color?: string;
  count: number;
  match: (k: KnowledgeItem) => boolean;
  heading?: boolean;
  child?: boolean;
}

const KIND_LABEL: Record<string, string> = { source: "Source", claim: "Claim", decision: "Decision", note: "Note", architecture: "Architecture", skill: "Skill", prompt: "Prompt", snippet: "Snippet", glossary: "Glossary", entity: "Entity" };
const KIND_CODE: Record<string, string> = { source: "SRC", claim: "CLM", decision: "DEC", note: "NTE", architecture: "ARC", skill: "SKL", prompt: "PRM", snippet: "SNP", glossary: "GLS", entity: "ENT" };
const TRUST: Record<string, number> = { high: 3, medium: 2, low: 1 };

const isUpload = (k: KnowledgeItem) => k.tags.includes("upload");
const isResearch = (k: KnowledgeItem) => k.tags.includes("research");
const isFix = (k: KnowledgeItem) => k.tags.includes("fix-memory");

/** Shelves are computed from what is stored: kinds, tags and research jobs. Each item has one home shelf. */
function buildShelves(items: KnowledgeItem[], jobs: ResearchJob[]): Shelf[] {
  const base: Array<Omit<Shelf, "count">> = [
    { id: "all", label: "All items", description: "Everything this project has in the Knowledge Hub, newest first.", color: "var(--text-2)", match: (k) => !k.excluded },
    { id: "pinned", label: "Pinned", description: "Always given to agents when they look something up.", color: "#f2b33d", match: (k) => k.pinned && !k.excluded },
    { id: "fixes", label: "Fixes that worked", description: "How FlowCode fixed a step that failed: what went wrong and the change that made it pass. Retries in later builds get the closest ones.", color: "#7fb069", match: (k) => !k.excluded && isFix(k) },
    { id: "notes", label: "Decisions & notes", description: "What you decided and why, plus notes, snippets and glossary terms.", color: "#2fc4b2", match: (k) => !k.excluded && ["decision", "note", "snippet", "glossary"].includes(k.kind) && !isResearch(k) && !isFix(k) },
    { id: "documents", label: "Documents", description: "Files you uploaded. Agents read them like reference books.", color: "#84a0db", match: (k) => !k.excluded && isUpload(k) },
    { id: "research", label: "Research", description: "Sources found by research, the claims taken from them, and topic analyses.", color: "#a78bfa", match: (k) => !k.excluded && isResearch(k) && !isUpload(k) },
    { id: "project", label: "Project & code", description: "Repository maps, attached specs, skills and prompts.", color: "#f59e8b", match: (k) => !k.excluded && !isResearch(k) && !isUpload(k) && !["decision", "note", "snippet", "glossary"].includes(k.kind) },
    { id: "excluded", label: "Set aside", description: "Kept, but never given to agents.", color: "var(--line-strong)", match: (k) => k.excluded },
  ];
  const shelves: Shelf[] = base.map((s) => ({ ...s, count: new Set(items.filter(s.match).map((k) => docKey(k) ?? k.id)).size }));
  // Research collections: one per research question, nested under Research.
  const collections: Shelf[] = jobs
    .filter((j) => j.resultKnowledgeIds.length)
    .map((j) => {
      const ids = new Set(j.resultKnowledgeIds);
      return { id: `research:${j.id}`, label: j.question, description: `What research found for "${j.question}": ${j.queryPlan.queries.length} searches, sources with their links, and the claims taken from them.`, color: "#a78bfa", child: true, match: (k: KnowledgeItem) => ids.has(k.id), count: items.filter((k) => ids.has(k.id)).length };
    })
    .filter((s) => s.count);
  const at = shelves.findIndex((s) => s.id === "research");
  shelves.splice(at + 1, 0, ...collections);
  return [shelves[0], shelves[1], { id: "h-shelves", label: "Shelves", heading: true, count: 1, match: () => false }, ...shelves.slice(2)];
}

function sortItems(list: KnowledgeItem[], sort: SortKey) {
  const s = [...list];
  if (sort === "newest") s.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  if (sort === "oldest") s.sort((a, b) => a.updatedAt.localeCompare(b.updatedAt));
  if (sort === "title") s.sort((a, b) => a.title.localeCompare(b.title));
  if (sort === "confidence") s.sort((a, b) => (TRUST[b.confidence ?? ""] ?? 0) - (TRUST[a.confidence ?? ""] ?? 0) || b.updatedAt.localeCompare(a.updatedAt));
  return s;
}

/** Research claims are stored as "Topic: first sentence"; the card shows the topic and lets the excerpt carry the sentence. */
const cardTitle = (k: KnowledgeItem) => (k.kind === "claim" && k.title.includes(": ") ? k.title.split(": ")[0] : k.title);

const excerpt = (md: string) =>
  md
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/[#>*_`|-]+/g, " ")
    .replace(/\[flagged:[^\]]*\]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 220);

function siteOf(k: KnowledgeItem): string | undefined {
  const url = k.provenance.find((p) => p.kind === "url")?.ref;
  if (url) {
    try {
      return new URL(url).hostname.replace(/^www\./, "");
    } catch {
      return undefined;
    }
  }
  const file = k.provenance.find((p) => p.kind === "file" || p.kind === "user")?.title ?? k.provenance.find((p) => p.kind === "file")?.ref;
  return file && file !== "knowledge-hub" ? file.split("/").pop() : undefined;
}

/** Confidence as three small bars, read like a signal meter. */
function Trust({ level }: { level?: string }) {
  const n = TRUST[level ?? ""] ?? 0;
  if (!n) return null;
  return (
    <span className="lib-trust" role="img" aria-label={`${level} confidence`} title={`${level} confidence`}>
      {[1, 2, 3].map((i) => (
        <i key={i} className={i <= n ? "is-on" : ""} />
      ))}
    </span>
  );
}

/** The reading pane: one item with its catalog record, full text and citations. */
function ReadingPane({ item, shelf, callNo, onClose, onChange, inline = false, parts, onPart, projects }: { item: KnowledgeItem; shelf?: string; callNo?: string; onClose?: () => void; onChange: () => void; inline?: boolean; projects?: Project[]; parts?: KnowledgeItem[]; onPart?: (id: string) => void }) {
  const at = parts ? parts.findIndex((p) => p.id === item.id) : -1;
  const update = (patch: Partial<KnowledgeItem>) => post(`/knowledge/${item.id}`, patch).then(onChange);
  const [moveNote, setMoveNote] = useState<string>();
  // An uploaded document moves with all its parts.
  const move = async (target: string) => {
    const ids = parts && parts.length > 1 ? parts.map((p) => p.id) : [item.id];
    const r = await post<{ moved: number }>("/knowledge/move", { ids, projectId: target === "global" ? null : target });
    const where = target === "global" ? "Global" : (projects?.find((p) => p.id === target)?.name ?? "that project");
    setMoveNote(`Moved ${r.moved === 1 ? "it" : `all ${r.moved} parts`} to ${where}.`);
    onChange();
  };
  return (
    <aside className={`lib-reader${inline ? " lib-reader--inline" : ""}`} aria-labelledby={`k-${item.id}`}>
      <div className="lib-reader__bar">
        <span className="lib-reader__call">{callNo}</span>
        {onClose ? (
          <button type="button" className="icon-btn" aria-label="Close" onClick={onClose}>
            <Icon name="x" size={14} />
          </button>
        ) : null}
      </div>
      <div className="lib-reader__kind">
        <KnowledgeKindIcon kind={item.kind} size={14} /> {KIND_LABEL[item.kind] ?? item.kind}
        {shelf ? <span className="muted"> · {shelf}</span> : null}
      </div>
      <h2 className="lib-reader__title" id={`k-${item.id}`}>
        {item.title}
      </h2>
      <dl className="lib-record">
        <dt>Trust</dt>
        <dd>
          <Trust level={item.confidence} /> {item.confidence ?? "not rated"}
        </dd>
        <dt>Kept</dt>
        <dd>{item.durability === "durable" ? "For good" : "Temporary until confirmed"}</dd>
        <dt>Added</dt>
        <dd>{new Date(item.createdAt).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })}</dd>
        {item.tags.length ? (
          <>
            <dt>Tags</dt>
            <dd className="lib-record__tags">
              {item.tags.map((t) => (
                <span key={t} className="chip">
                  {t}
                </span>
              ))}
            </dd>
          </>
        ) : null}
      </dl>
      <div className="lib-reader__actions">
        <button className="btn btn--sm" onClick={() => update({ pinned: !item.pinned })}>
          <Pin size={13} aria-hidden="true" /> {item.pinned ? "Unpin" : "Pin"}
        </button>
        {!item.confirmedByUser ? (
          <button className="btn btn--sm" onClick={() => update({ confirmedByUser: true, durability: "durable" })}>
            <BadgeCheck size={13} aria-hidden="true" /> Confirm it&apos;s right
          </button>
        ) : (
          <span className="lib-reader__ok">
            <BadgeCheck size={13} aria-hidden="true" /> Confirmed by you
          </span>
        )}
        {item.tags.includes("fix-memory") ? <PromoteFix id={item.id} /> : null}
        <button className="btn btn--sm btn--ghost" onClick={() => update({ excluded: !item.excluded })}>
          {item.excluded ? "Put back on the shelf" : "Set aside"}
        </button>
        {projects ? (
          <label className="lib-reader__move">
            <span className="sr-only">Move to</span>
            <select
              className="select"
              value=""
              onChange={(e) => e.target.value && void move(e.target.value)}
              title={parts && parts.length > 1 ? `Moves all ${parts.length} parts of this document` : "Move this item"}
            >
              <option value="">Move to…</option>
              {item.scope !== "global" ? <option value="global">Global (every project)</option> : null}
              {projects.filter((p) => p.id !== item.projectId).map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
        ) : null}
      </div>
      {moveNote ? (
        <p className="notice notice--ok" role="status" style={{ margin: "8px 0 0" }}>
          {moveNote}
        </p>
      ) : null}
      {parts && parts.length > 1 && at >= 0 && onPart ? (
        <nav className="lib-reader__parts" aria-label="Document parts">
          <button type="button" className="btn btn--sm" disabled={at === 0} onClick={() => onPart(parts[at - 1].id)}>
            Previous part
          </button>
          <span>
            Part <strong>{at + 1}</strong> of {parts.length}
          </span>
          <button type="button" className="btn btn--sm" disabled={at === parts.length - 1} onClick={() => onPart(parts[at + 1].id)}>
            Next part
          </button>
        </nav>
      ) : null}
      <div className="lib-reader__text">
        <Markdown source={readable(item)} />
      </div>
      <div className="lib-reader__cites">
        <h3>Citations</h3>
        {item.provenance.length ? (
          <ol>
            {item.provenance.map((p, i) => (
              <li key={i}>
                {p.kind === "url" ? (
                  <a href={p.ref} target="_blank" rel="noreferrer">
                    {p.title ?? p.ref}
                  </a>
                ) : (
                  <span>{p.title ?? p.ref}</span>
                )}
                <span className="muted">
                  {" "}
                  · {p.kind}
                  {p.retrievedAt ? ` · ${new Date(p.retrievedAt).toLocaleDateString()}` : ""}
                </span>
                {p.quote ? <blockquote>{p.quote}</blockquote> : null}
              </li>
            ))}
          </ol>
        ) : (
          <p className="muted">No citation recorded.</p>
        )}
      </div>
    </aside>
  );
}

function NewNote({ projectId, onSaved }: { projectId: string; onSaved: () => void }) {
  const [kind, setKind] = useState<"decision" | "note" | "snippet" | "glossary">("decision");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const save = async () => {
    await post("/knowledge", { scope: projectId ? "project" : "global", projectId: projectId || undefined, kind, title, content, tags: [], provenance: [{ kind: "user", ref: "knowledge-hub" }], durability: "durable", confirmedByUser: true, linkedEntityIds: [] });
    setTitle("");
    setContent("");
    onSaved();
  };
  return (
    <form
      className="section"
      onSubmit={(e) => {
        e.preventDefault();
        void save();
      }}
    >
      <div className="section__head">
        <h2 className="section__title">Record a decision or note</h2>
      </div>
      <div className="section__body" style={{ display: "grid", gap: 10 }}>
        <div style={{ display: "grid", gridTemplateColumns: "140px 1fr", gap: 8 }}>
          <select className="select" data-cp="note-kind" aria-label="Kind" value={kind} onChange={(e) => setKind(e.target.value as typeof kind)}>
            <option value="decision">Decision</option>
            <option value="note">Note</option>
            <option value="snippet">Snippet</option>
            <option value="glossary">Glossary term</option>
          </select>
          <input className="input" data-cp="note-title" aria-label="Title" placeholder="Title" value={title} onChange={(e) => setTitle(e.target.value)} required />
        </div>
        <textarea className="textarea" data-cp="note-content" aria-label="Content" placeholder="What was decided, and why?" value={content} onChange={(e) => setContent(e.target.value)} required />
        <button className="btn" type="submit" data-cp="note-save" style={{ justifySelf: "start" }} disabled={!title || !content}>
          Save (confirmed by you)
        </button>
      </div>
    </form>
  );
}

function ResearchPanel({ projectId, jobs, onChange, onShow }: { projectId: string; jobs: ResearchJob[]; onChange: () => void; onShow: (question: string, ids: string[]) => void }) {
  const [question, setQuestion] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const start = async () => {
    setBusy(true);
    setError(undefined);
    try {
      await post("/research/jobs", { projectId, question });
      setQuestion("");
      onChange();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="section" data-guide="knowledge.research">
      <div className="section__head">
        <h2 className="section__title">Research</h2>
        <span className="label" style={{ marginLeft: "auto" }}>external · consent required</span>
      </div>
      <div className="section__body" style={{ display: "grid", gap: 10 }}>
        <form
          style={{ display: "flex", gap: 8 }}
          onSubmit={(e) => {
            e.preventDefault();
            void start();
          }}
        >
          <input className="input" data-cp="research-question" aria-label="Research question" placeholder="Ask a research question…" value={question} onChange={(e) => setQuestion(e.target.value)} />
          <button className="btn" type="submit" data-cp="research-plan" disabled={busy || question.length < 3}>
            Plan
          </button>
        </form>
        <p className="muted" style={{ margin: 0, fontSize: 12 }}>
          Only the planned search queries leave this machine, and only after you approve. Sources are stored as untrusted data with citations.
        </p>
        {error ? <ErrorNotice error={error} doing="do that" /> : null}
        <ResearchJobs jobs={jobs} onChange={onChange} onShow={onShow} onError={setError} />
      </div>
    </section>
  );
}

function readable(item: KnowledgeItem) {
  const text = item.content.replace(/\n?\[flagged:[^\]]*\]/g, "");
  if (!item.tags.includes("pdf")) return text;
  const lines = text.split("\n");
  const out: string[] = [];
  for (const raw of lines) {
    const line = raw.trim();
    const prev = out[out.length - 1];
    const startsBlock = !line || /^(#{1,6}\s|[-*•▪●◦]\s?|\d+[.)]\s)/.test(line);
    const prevEnds = prev === undefined || prev === "" || /^#{1,6}\s/.test(prev) || /[.:!?;)"”]$/.test(prev) || prev.length < 40;
    if (startsBlock || prevEnds) out.push(line.replace(/^[•▪●◦]\s?/, "- "));
    else out[out.length - 1] = `${prev.replace(/-$/, "")}${prev.endsWith("-") ? "" : " "}${line}`;
  }
  // Blank line between paragraphs so Markdown renders them as separate blocks.
  return out.join("\n\n").replace(/\n{3,}/g, "\n\n");
}

/** Uploaded documents are stored as "Name (part 3 of 14)"; the document name groups them. */
const PART_RE = /\s*\(part (\d+) of \d+\)$/;
const docKey = (k: KnowledgeItem) => (k.tags.includes("upload") && PART_RE.test(k.title) ? k.title.replace(PART_RE, "") : undefined);
const partNo = (k: KnowledgeItem) => Number(PART_RE.exec(k.title)?.[1] ?? 0);

const RESULTS_PAGE = 20;
const CAT_PAGE = 24;

/** Search snippets mark matches as [term]; show them highlighted instead. */
function Highlighted({ text }: { text: string }) {
  const parts = text.split(/\[([^\]]{1,60})\]/g);
  return (
    <>
      {parts.map((p, i) => (i % 2 ? <mark key={i}>{p}</mark> : <span key={i}>{p}</span>))}
    </>
  );
}

/** "user:Ebook.pdf" → "Ebook.pdf"; a long list of refs → "6 sources". */
function sourceLabel(provenance: string) {
  const refs = provenance.split(/,\s*/).filter(Boolean);
  if (refs.length > 2) return `${refs.length} sources`;
  return refs
    .map((r) => r.replace(/^(user|file|url|topic):/, "").replace(/^https?:\/\/(www\.)?/, "").split(/[/?#]/)[0] || r)
    .join(" · ");
}

/** Numbered pages with previous/next; keeps long lists short. */
export function LibPager({ page, pages, onChange, label }: { page: number; pages: number; onChange: (p: number) => void; label: string }) {
  if (pages <= 1) return null;
  const nums = Array.from({ length: pages }, (_, i) => i).filter((i) => i === 0 || i === pages - 1 || Math.abs(i - page) <= 2);
  return (
    <nav className="lib-pager" aria-label={label}>
      <button type="button" className="btn btn--sm" disabled={page === 0} onClick={() => onChange(page - 1)}>
        Previous
      </button>
      {nums.map((n, i) => (
        <span key={n} style={{ display: "contents" }}>
          {i > 0 && n - nums[i - 1] > 1 ? <span className="lib-pager__gap">…</span> : null}
          <button type="button" className="lib-pager__num" aria-current={n === page ? "page" : undefined} onClick={() => onChange(n)}>
            {n + 1}
          </button>
        </span>
      ))}
      <button type="button" className="btn btn--sm" disabled={page === pages - 1} onClick={() => onChange(page + 1)}>
        Next
      </button>
    </nav>
  );
}

/** Full-screen search results: a paginated list on the left, the picked item in full on the right. */
function SearchResultsModal({
  query,
  results,
  items,
  onClose,
  onChange,
  shelfOf,
  callNo,
}: {
  query: string;
  results: { results: SearchResult[]; semantic: Array<{ id: string; title: string; similarity: number }> };
  items: KnowledgeItem[];
  onClose: () => void;
  onChange: () => void;
  shelfOf: (k: KnowledgeItem) => string | undefined;
  callNo: (id: string) => string | undefined;
}) {
  const rows = [
    ...results.results.map((r) => ({ key: `${r.kind}-${r.id}`, id: r.kind === "knowledge" ? r.id : undefined, kind: r.kind, title: r.title, snippet: r.snippet, source: sourceLabel(r.provenance) })),
    ...results.semantic.map((s) => ({ key: `sem-${s.id}`, id: s.id, kind: "similar", title: s.title, snippet: `Similar in meaning (${Math.round(s.similarity * 100)}% match)`, source: "" })),
  ];
  const [page, setPage] = useState(0);
  const [pick, setPick] = useState<string | undefined>(rows.find((r) => r.id)?.id);
  const pages = Math.ceil(rows.length / RESULTS_PAGE);
  const visible = rows.slice(page * RESULTS_PAGE, (page + 1) * RESULTS_PAGE);
  const picked = items.find((k) => k.id === pick);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);
  return (
    <div className="lib-search" role="dialog" aria-modal="true" aria-labelledby="lib-search-title">
      <header className="lib-search__head">
        <div>
          <span className="label">Search results</span>
          <h2 id="lib-search-title" className="lib-search__title">
            &ldquo;{query}&rdquo; <span className="lib-search__count">{rows.length} result{rows.length === 1 ? "" : "s"}</span>
          </h2>
        </div>
        <button type="button" className="btn" onClick={onClose}>
          <Icon name="x" size={14} /> Close
        </button>
      </header>
      <div className="lib-search__body">
        <section className="lib-search__list" aria-label="Results">
          {rows.length ? (
            <>
              <ol start={page * RESULTS_PAGE + 1}>
                {visible.map((r) => (
                  <li key={r.key}>
                    <button type="button" className="lib-hit" aria-current={r.id && r.id === pick ? "true" : undefined} disabled={!r.id} onClick={() => setPick(r.id)}>
                      <span className="lib-hit__top">
                        <span className="lib-hit__kind">{r.kind === "knowledge" ? "Library" : r.kind}</span>
                        {r.source ? <span className="lib-hit__source">{r.source}</span> : null}
                      </span>
                      <span className="lib-hit__title">{r.title}</span>
                      <span className="lib-hit__snippet">
                        <Highlighted text={r.snippet} />
                      </span>
                    </button>
                  </li>
                ))}
              </ol>
              <LibPager page={page} pages={pages} onChange={(p) => (setPage(p), document.querySelector(".lib-search__list")?.scrollTo({ top: 0 }))} label="Result pages" />
            </>
          ) : (
            <Empty title="No matches" illustration="no-results">Try fewer or different words, or turn on Semantic search (it finds things with a similar meaning).</Empty>
          )}
        </section>
        <section className="lib-search__preview" aria-label="Preview">
          {picked ? (
            <ReadingPane item={picked} shelf={shelfOf(picked)} callNo={callNo(picked.id)} onChange={onChange} inline />
          ) : (
            <p className="muted">{rows.length ? "Pick a result to read it here." : ""}</p>
          )}
        </section>
      </div>
    </div>
  );
}

const JOBS_PAGE = { cards: 9, list: 12 } as const;

/** Research questions as cards or a compact list, paginated. Approvals stay inline in both views. */
function ResearchJobs({ jobs, onChange, onShow, onError }: { jobs: ResearchJob[]; onChange: () => void; onShow: (question: string, ids: string[]) => void; onError: (m: string) => void }) {
  const [view, setView] = useState<"cards" | "list">(() => {
    try {
      return localStorage.getItem("fc.research.view") === "list" ? "list" : "cards";
    } catch {
      return "cards";
    }
  });
  const [page, setPage] = useState(0);
  const choose = (v: "cards" | "list") => {
    setView(v);
    setPage(0);
    try {
      localStorage.setItem("fc.research.view", v);
    } catch {
      /* storage unavailable */
    }
  };
  if (!jobs.length) return <p className="muted" style={{ margin: 0 }}>No research yet. Ask a question above to start.</p>;
  const size = JOBS_PAGE[view];
  const pages = Math.ceil(jobs.length / size);
  const shown = jobs.slice(page * size, (page + 1) * size);
  const decide = async (j: ResearchJob, decision: "once" | "deny") => {
    await post(`/approvals/${j.approvalId}/decision`, { decision }).catch((e) => onError((e as Error).message));
    onChange();
  };
  const approval = (j: ResearchJob) =>
    j.status === "awaiting_approval" && j.approvalId ? (
      <div className="research-ask">
        <span>These searches go to your SearXNG, which asks web search engines (Wikipedia if SearXNG isn&apos;t running). Blocked sites and the dark-web filter apply. Nothing else leaves this machine.</span>
        <button type="button" className="btn btn--sm" onClick={() => void decide(j, "deny")}>
          Don&apos;t search
        </button>
        <button type="button" className="btn btn--sm btn--primary" onClick={() => void decide(j, "once")}>
          Approve and search
        </button>
      </div>
    ) : null;
  const saved = (j: ResearchJob) => (j.status === "completed" ? j.resultKnowledgeIds.length : 0);
  return (
    <div className="rjobs">
      <div className="rjobs__bar">
        <span className="muted">
          {jobs.length} research question{jobs.length === 1 ? "" : "s"}
        </span>
        <div className="lib-view" role="radiogroup" aria-label="Layout">
          <button type="button" role="radio" aria-checked={view === "cards"} aria-label="Cards" title="Cards" onClick={() => choose("cards")}>
            <LayoutGrid size={15} aria-hidden="true" />
          </button>
          <button type="button" role="radio" aria-checked={view === "list"} aria-label="List" title="List" onClick={() => choose("list")}>
            <List size={15} aria-hidden="true" />
          </button>
        </div>
      </div>
      {view === "cards" ? (
        <ul className="rjobs__cards">
          {shown.map((j) => (
            <li key={j.id} className="rjob-card">
              <div className="rjob-card__top">
                <StatusChip status={j.status} />
                <span className="muted">{ago(j.createdAt)}</span>
              </div>
              <h3 className="rjob-card__q">{j.question}</h3>
              <div className="rjob-card__queries" aria-label="Searches">
                {j.queryPlan.queries.map((q) => (
                  <span key={q} className="chip">
                    {q}
                  </span>
                ))}
              </div>
              {approval(j)}
              {saved(j) ? (
                <div className="rjob-card__foot">
                  <span>
                    <Icon name="knowledge" size={13} /> {saved(j)} items saved
                  </span>
                  <button type="button" className="btn btn--sm" onClick={() => onShow(j.question, j.resultKnowledgeIds)}>
                    Show them
                  </button>
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <ul className="rjobs__list">
          {shown.map((j) => (
            <li key={j.id} className="rjob-row">
              <div className="rjob-row__main">
                <StatusChip status={j.status} />
                <span className="rjob-row__q" title={j.queryPlan.queries.join(" · ")}>
                  {j.question}
                </span>
                <span className="muted rjob-row__meta">{saved(j) ? `${saved(j)} items · ` : ""}{ago(j.createdAt)}</span>
                {saved(j) ? (
                  <button type="button" className="btn btn--sm" onClick={() => onShow(j.question, j.resultKnowledgeIds)}>
                    Show them
                  </button>
                ) : null}
              </div>
              {approval(j)}
            </li>
          ))}
        </ul>
      )}
      <LibPager page={page} pages={pages} onChange={setPage} label="Research pages" />
      <p className="muted" style={{ margin: 0, fontSize: 12 }}>
        Saved items are sources (with links) and claims taken from search snippets, so check claims before relying on them.
      </p>
    </div>
  );
}

/** A fix that worked, made into a skill every coder and debugger follows (it appears in Prompts & Skills). */
function PromoteFix({ id }: { id: string }) {
  const [state, setState] = useState<"idle" | "busy" | "done" | string>("idle");
  if (state === "done") return <span className="lib-reader__ok">Now a skill (Prompts &amp; Skills)</span>;
  return (
    <button
      className="btn btn--sm"
      disabled={state === "busy"}
      title="Make this fix a skill that coders and debuggers follow in every build"
      onClick={async () => {
        setState("busy");
        try {
          await post(`/fix-memory/${encodeURIComponent(id)}/promote`, {});
          setState("done");
        } catch (e) {
          setState((e as Error).message);
        }
      }}
    >
      {state === "busy" ? "Making a skill…" : state === "idle" ? "Make it a skill" : `Couldn't: ${state}`}
    </button>
  );
}
