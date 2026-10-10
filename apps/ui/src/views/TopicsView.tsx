/**
 * Topics: searches you follow. The list shows each topic as a card; a topic page shows its live results by kind,
 * the items you saved, and an analysis (local model) you can add to the Knowledge Hub as research history.
 */
import { useEffect, useMemo, useState } from "react";
import { BookMarked, Check, Database, Pencil, X, LayoutGrid, List, Plus, RefreshCw, Sparkles, Trash2 } from "lucide-react";
import { get, post, useResource } from "../api";
import { navigate } from "../router";
import { Empty, ago } from "../components/ui";
import { SkeletonBlock } from "../components/motion";
import { Markdown } from "../components/Markdown";
import { BackLink } from "../components/BackLink";
import { ConfirmButton } from "../components/ConfirmButton";
import { PAGE_SIZE, Pager, ResultCard, ResultTabs, thumbUrl, type ResultTab, type Topic, type WebResult } from "../components/WebResults";

type TopicSummary = Omit<Topic, "results"> & { resultCount: number; thumbnail?: string };
type Sort = "newest" | "az" | "za" | "items";
const SORTS: Array<[Sort, string]> = [
  ["newest", "Newest"],
  ["az", "A → Z"],
  ["za", "Z → A"],
  ["items", "Most items"],
];

export function TopicsView({ topicId }: { topicId?: string }) {
  return topicId ? <TopicPage key={topicId} id={topicId} /> : <TopicList />;
}

function TopicList() {
  const { data, error, reload } = useResource<TopicSummary[]>("/topics", []);
  const [sort, setSort] = useState<Sort>("newest");
  const [layout, setLayout] = useState<"grid" | "list">("grid");
  const [adding, setAdding] = useState(false);
  const [page, setPage] = useState(1);
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string>();
  const sorted = useMemo(() => {
    const list = [...(data ?? [])];
    if (sort === "az") list.sort((a, b) => a.title.localeCompare(b.title));
    else if (sort === "za") list.sort((a, b) => b.title.localeCompare(a.title));
    else if (sort === "items") list.sort((a, b) => b.resultCount + b.saved.length - (a.resultCount + a.saved.length));
    else list.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return list;
  }, [data, sort]);
  const create = async () => {
    if (!query.trim()) return;
    setBusy(true);
    setErr(undefined);
    try {
      const t = await post<Topic>("/topics", { query: query.trim() });
      reload();
      navigate(`/topics/${t.id}`);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="page">
      <header className="page__head">
        <div>
          <span className="label">Intelligence</span>
          <h1 className="page__title">Topic Search</h1>
          <p className="lrc__meta">{data ? `${data.length} topic${data.length === 1 ? "" : "s"} · ${data.reduce((n, t) => n + t.saved.length, 0)} saved items` : "Searches you follow, with results kept up to date."}</p>
        </div>
        <div className="topic-tools">
          <div className="seg" role="radiogroup" aria-label="Sort topics">
            {SORTS.map(([id, label]) => (
              <button key={id} role="radio" aria-checked={sort === id} className={`seg__btn${sort === id ? " is-on" : ""}`} onClick={() => (setSort(id), setPage(1))}>
                {label}
              </button>
            ))}
          </div>
          <div className="seg" role="radiogroup" aria-label="Layout">
            <button role="radio" aria-checked={layout === "grid"} aria-label="Grid" className={`seg__btn${layout === "grid" ? " is-on" : ""}`} onClick={() => setLayout("grid")}>
              <LayoutGrid size={14} />
            </button>
            <button role="radio" aria-checked={layout === "list"} aria-label="List" className={`seg__btn${layout === "list" ? " is-on" : ""}`} onClick={() => setLayout("list")}>
              <List size={14} />
            </button>
          </div>
          <button className="btn btn--primary" data-cp="topic-new" data-cp-safe onClick={() => setAdding((a) => !a)} aria-expanded={adding}>
            <Plus size={14} aria-hidden="true" /> Search new topic
          </button>
        </div>
      </header>
      {adding ? (
        <form className="topic-new" onSubmit={(e) => (e.preventDefault(), void create())}>
          <label className="label" htmlFor="topic-q">
            What do you want to follow?
          </label>
          <div style={{ display: "flex", gap: 8 }}>
            <input id="topic-q" data-cp="topic-q" className="input" autoFocus value={query} onChange={(e) => setQuery(e.target.value)} placeholder="e.g. local AI coding agents" />
            <button className="btn btn--primary" data-cp="topic-create" disabled={busy || !query.trim()}>
              {busy ? "Creating…" : "Create topic"}
            </button>
          </div>
          {err ? <p className="notice notice--bad" role="alert">{err}</p> : null}
        </form>
      ) : null}
      {error && !data ? <p className="notice notice--bad" role="alert">{error}</p> : null}
      {!data && !error ? <SkeletonBlock rows={3} label="Loading topics" /> : null}
      {data && !data.length ? (
        <Empty title="No topics yet" action={<button className="btn btn--primary" onClick={() => setAdding(true)}>New topic</button>}>
          Search the web from the top bar and choose “Save as topic”, or create one here.
        </Empty>
      ) : null}
      <div className={layout === "grid" ? "topic-grid" : "topic-list"} role="list">
        {sorted.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE).map((t) => (
          <button key={t.id} role="listitem" className="topic-card" onClick={() => navigate(`/topics/${t.id}`)}>
            <span className="topic-card__media" aria-hidden="true">
              {t.thumbnail ? <img src={thumbUrl(t.thumbnail)} alt="" loading="lazy" onError={(e) => (e.currentTarget.style.display = "none")} /> : <BookMarked size={28} strokeWidth={1.5} />}
            </span>
            <span className="topic-card__body">
              <span className="topic-card__meta">
                <span className="topic-card__kind">Topic</span>
                {t.saved.length ? <span className="chip">{t.saved.length} saved</span> : null}
                {t.knowledgeId ? <span className="chip chip--ok">in knowledge</span> : null}
              </span>
              <strong className="topic-card__title">{t.title}</strong>
              <span className="topic-card__desc">{t.description}</span>
              <span className="topic-card__foot muted">
                {t.resultCount} results · {t.fetchedAt ? `fetched ${ago(t.fetchedAt)}` : "fetched on visit"}
              </span>
            </span>
          </button>
        ))}
      </div>
      <Pager page={page} total={sorted.length} onChange={(p) => (setPage(p), scrollTo({ top: 0, behavior: "smooth" }))} label="Topic pages" />
    </div>
  );
}

function TopicPage({ id }: { id: string }) {
  const [t, setT] = useState<Topic>();
  const [error, setError] = useState<string>();
  const [tab, setTabState] = useState<"all" | ResultTab | "saved">("all");
  const [page, setPage] = useState(1);
  const setTab = (v: "all" | ResultTab | "saved") => (setTabState(v), setPage(1));
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState({ title: "", description: "" });
  const [busy, setBusy] = useState<"refresh" | "analyze" | "knowledge" | "remove">();
  const [note, setNote] = useState<string>();

  useEffect(() => {
    get<Topic>(`/topics/${id}`)
      .then(setT)
      .catch((e) => setError((e as Error).message));
  }, [id]);

  const act = async (kind: NonNullable<typeof busy>, fn: () => Promise<void>) => {
    setBusy(kind);
    setError(undefined);
    setNote(undefined);
    try {
      await fn();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(undefined);
    }
  };
  if (!t) return <div className="page">{error ? <p className="notice notice--bad" role="alert">{error}</p> : <SkeletonBlock rows={4} label="Loading topic" />}</div>;

  const savedUrls = new Set(t.saved.map((s) => s.url));
  // Hidden posts are kept, so showing them again is instant; they are filtered here and nowhere else.
  const hiddenUrls = new Set(t.hidden ?? []);
  const all = t.results.filter((r) => !hiddenUrls.has(r.url));
  const savedShown = t.saved.filter((r) => !hiddenUrls.has(r.url));
  const order: Array<"all" | ResultTab | "saved"> = ["all", "videos", "general", "pdfs", "news", "reference", "community", "saved"];
  const counts = order.map((k) => [k, k === "all" ? all.length : k === "saved" ? savedShown.length : all.filter((r) => r.tab === k).length] as ["all" | ResultTab | "saved", number]);
  const shown = tab === "all" ? all : tab === "saved" ? savedShown : all.filter((r) => r.tab === tab);
  const sources = new Map<string, number>();
  for (const r of all) sources.set(r.source, (sources.get(r.source) ?? 0) + 1);
  const top = [...sources.entries()].sort((a, b) => b[1] - a[1])[0];
  const toggle = async (r: WebResult, saved: boolean) => setT(await post<Topic>(`/topics/${t.id}/save`, { item: r, saved }));
  const hiddenCount = t.hidden?.length ?? 0;
  // Hiding is this topic's business and is undone from the line under the tabs; blocking changes
  // the blocklist for the whole app, so it asks first and says what it took away.
  const hide = async (r: WebResult) => {
    setT(await post<Topic>(`/topics/${t.id}/hide`, { url: r.url, hidden: true }));
    setNote(`Hidden: ${r.title}`);
  };
  const unhideAll = async () => {
    let next = t;
    for (const url of t.hidden ?? []) next = await post<Topic>(`/topics/${t.id}/hide`, { url, hidden: false });
    setT(next);
    setNote("Everything hidden here is back.");
  };
  const block = async (r: WebResult) => {
    const host = (() => {
      try {
        return new URL(r.url).hostname.replace(/^www\./, "");
      } catch {
        return r.source;
      }
    })();
    if (!confirm(`Block ${host} everywhere? It goes on your blocklist, and anything already saved from it is removed from every topic. You can take it off again in Settings.`)) return;
    const res = await post<{ removed: number }>("/web/block", { host });
    setT(await get<Topic>(`/topics/${t.id}`));
    setNote(`${host} is blocked. ${res.removed} result${res.removed === 1 ? "" : "s"} removed across your topics.`);
  };

  return (
    <div className="page">
      <BackLink fallback="/topics" fallbackLabel="Topic Search" />
      <header className="topic-head">
        <div style={{ minWidth: 0 }}>
          <span className="topic-card__meta">
            <span className="topic-card__kind">Topic</span>
            {t.knowledgeId ? <span className="chip chip--ok">in Knowledge Hub</span> : null}
          </span>
          {editing ? (
            <form
              className="topic-edit"
              onSubmit={(e) => {
                e.preventDefault();
                void act("refresh", async () => {
                  const next = await post<Topic>(`/topics/${t.id}`, { title: draft.title, description: draft.description });
                  setT((cur) => ({ ...next, results: cur?.results ?? next.results }));
                  setEditing(false);
                });
              }}
            >
              <label className="sr-only" htmlFor="topic-title">
                Topic title
              </label>
              <input id="topic-title" className="input topic-edit__title" autoFocus maxLength={140} value={draft.title} onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))} />
              <label className="sr-only" htmlFor="topic-desc">
                Description
              </label>
              <input id="topic-desc" className="input" maxLength={1000} value={draft.description} onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))} placeholder="Description" />
              <div style={{ display: "flex", gap: 8 }}>
                <button className="btn btn--primary btn--sm" disabled={!draft.title.trim()}>
                  <Check size={14} aria-hidden="true" /> Save
                </button>
                <button type="button" className="btn btn--sm" onClick={() => setEditing(false)}>
                  <X size={14} aria-hidden="true" /> Cancel
                </button>
              </div>
            </form>
          ) : (
            <>
              <div className="topic-head__title">
                <h1 className="page__title">{t.title}</h1>
                <button className="icon-btn" aria-label="Edit topic title" title="Edit title and description" onClick={() => (setDraft({ title: t.title, description: t.description }), setEditing(true))}>
                  <Pencil size={15} />
                </button>
              </div>
              <p className="lrc__meta">{t.description}</p>
            </>
          )}
          <p className="topic-head__q">
            <span className="muted">Live query</span> <code>{t.query}</code>
            <span className="muted"> · {t.fetchedAt ? `fetched ${ago(t.fetchedAt)}` : "not fetched yet"}</span>
          </p>
        </div>
        <div className="topic-head__actions">
          <button className="btn" disabled={!!busy} onClick={() => act("refresh", async () => setT(await get<Topic>(`/topics/${t.id}?refresh=1`)))}>
            <RefreshCw size={14} className={busy === "refresh" ? "spin" : undefined} aria-hidden="true" /> {busy === "refresh" ? "Refreshing…" : "Refresh"}
          </button>
          <ConfirmButton className="btn btn--danger-ghost" disabled={!!busy} question="Remove this topic? Its saved items go too; anything already in the Knowledge Hub stays." confirmLabel="Remove topic" onConfirm={() => act("remove", async () => (await post(`/topics/${t.id}/delete`), navigate("/topics")))}>
            <Trash2 size={14} aria-hidden="true" /> Remove topic
          </ConfirmButton>
        </div>
      </header>
      {t.refreshError ? <p className="notice" role="status">Showing saved results; live search failed: {t.refreshError}</p> : null}
      {error ? <p className="notice notice--bad" role="alert">{error}</p> : null}
      {note ? <p className="notice" role="status">{note}</p> : null}

      <div className="topic-layout">
        <aside className="topic-summary" aria-label="Summary">
          <div className="topic-summary__stats">
            <span className="label">Summary</span>
            <strong>
              {all.length} results · {t.saved.length} saved
            </strong>
            {top ? <span className="muted">Top source: {top[0]}</span> : null}
          </div>
          {t.analysis ? (
            <div className="topic-analysis">
              <span className="label">
                Analysis · {ago(t.analysis.generatedAt)}
                {t.analysis.model ? ` · ${t.analysis.model}` : ""}
              </span>
              <div className="topic-analysis__body">
                <Markdown source={t.analysis.markdown} />
              </div>
            </div>
          ) : (
            <p className="muted" style={{ margin: 0 }}>Generate an analysis of what these results say, then add it to the Knowledge Hub so agents can use it.</p>
          )}
          <button className="btn" disabled={!!busy} onClick={() => act("analyze", async () => setT(await post<Topic>(`/topics/${t.id}/analyze`)))}>
            <Sparkles size={14} className={busy === "analyze" ? "spin" : undefined} aria-hidden="true" /> {busy === "analyze" ? "Analyzing… (local model)" : t.analysis ? "Regenerate analysis" : "Generate analysis"}
          </button>
          <button
            className="btn btn--primary"
            disabled={!!busy || !t.analysis}
            onClick={() =>
              act("knowledge", async () => {
                const r = await post<{ topic: Topic }>(`/topics/${t.id}/knowledge`, {});
                setT((cur) => ({ ...r.topic, results: cur?.results ?? r.topic.results }));
                setNote("Saved to the Knowledge Hub as research history. Agents can now retrieve it.");
              })
            }
          >
            <Database size={14} aria-hidden="true" /> {t.knowledgeId ? "Update in Knowledge Hub" : "Add to Knowledge Hub"}
          </button>
          {t.knowledgeId ? (
            <button className="btn btn--ghost btn--sm" onClick={() => navigate("/knowledge")}>
              Open Knowledge Hub
            </button>
          ) : null}
        </aside>
        <section style={{ minWidth: 0 }}>
          <ResultTabs label="Result type" value={tab} onChange={setTab} counts={counts} />
          {hiddenCount ? (
            <p className="muted" style={{ marginTop: 0 }}>
              {hiddenCount} post{hiddenCount === 1 ? "" : "s"} hidden here, and a refresh will not bring {hiddenCount === 1 ? "it" : "them"} back.{" "}
              <button className="btn btn--sm" onClick={() => void unhideAll()}>
                Show them again
              </button>
            </p>
          ) : null}
          {shown.length ? (
            <div className="web-grid web-grid--topic">
              {shown.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE).map((r) => (
                <ResultCard key={r.url} r={r} saved={savedUrls.has(r.url)} onToggleSave={toggle} onHide={hide} onBlock={block} />
              ))}
            </div>
          ) : (
            <p className="muted">{tab === "saved" ? "Nothing saved yet. Use the bookmark on a result to keep it." : "No results of this kind."}</p>
          )}
          <Pager page={page} total={shown.length} onChange={setPage} label="Topic result pages" />
        </section>
      </div>
    </div>
  );
}
