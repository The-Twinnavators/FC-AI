/**
 * Web search results (SearXNG): tabs by kind, result cards, "save as topic", and bookmarks that save a result into
 * this search's topic (creating the topic on first save). Blocked and dark-web results never reach this page.
 */
import { useEffect, useMemo, useState } from "react";
import { Plus, ShieldCheck } from "lucide-react";
import { get, post, useResource } from "../api";
import { navigate } from "../router";
import { Empty } from "../components/ui";
import { SkeletonBlock } from "../components/motion";
import { PAGE_SIZE, Pager, ResultCard, ResultTabs, type ResultTab, type Topic, type WebResult } from "../components/WebResults";

interface SearchResponse {
  query: string;
  results: WebResult[];
  blocked: number;
  unresponsive: string[];
  counts: Record<ResultTab, number>;
}
type TopicSummary = Omit<Topic, "results"> & { resultCount: number };
const ORDER: Array<"all" | ResultTab> = ["all", "general", "videos", "pdfs", "news", "reference", "community"];

export function SearchView({ query }: { query: URLSearchParams }) {
  const q = (query.get("q") ?? "").trim();
  const [data, setData] = useState<SearchResponse>();
  const [error, setError] = useState<string>();
  const [tab, setTabState] = useState<"all" | ResultTab>("all");
  const [page, setPage] = useState(1);
  const setTab = (t: "all" | ResultTab) => (setTabState(t), setPage(1));
  const topics = useResource<TopicSummary[]>("/topics", [q]);
  const [topic, setTopic] = useState<Topic>();
  const existing = topics.data?.find((t) => t.query.toLowerCase() === q.toLowerCase());

  useEffect(() => {
    if (!q) return;
    let alive = true;
    setData(undefined);
    setError(undefined);
    setTab("all");
    get<SearchResponse>(`/web/search?q=${encodeURIComponent(q)}`)
      .then((d) => alive && setData(d))
      .catch((e) => alive && setError((e as Error).message));
    return () => {
      alive = false;
    };
  }, [q]);

  useEffect(() => {
    if (existing && topic?.id !== existing.id) void get<Topic>(`/topics/${existing.id}`).then(setTopic).catch(() => undefined);
  }, [existing, topic?.id]);

  const shown = useMemo(() => (data ? (tab === "all" ? data.results : data.results.filter((r) => r.tab === tab)) : []), [data, tab]);
  const savedUrls = new Set((topic?.saved ?? []).map((s) => s.url));

  const ensureTopic = async () => topic ?? (await post<Topic>("/topics", { query: q, results: data?.results.slice(0, 60) }));
  const saveTopic = async () => {
    const t = await ensureTopic();
    setTopic(t);
    topics.reload();
    navigate(`/topics/${t.id}`);
  };
  const toggleSave = async (r: WebResult, saved: boolean) => {
    const t = await ensureTopic();
    setTopic(await post<Topic>(`/topics/${t.id}/save`, { item: r, saved }));
    topics.reload();
  };

  return (
    <div className="page">
      <header className="page__head">
        <div>
          <span className="label">web search</span>
          <h1 className="page__title">Search</h1>
          <p className="lrc__meta">{q ? <>Results for “{q}”</> : "Type in the search bar and choose Web to search the internet."}</p>
        </div>
      </header>
      {!q ? <Empty title="What are you looking for?" illustration="no-results">Type in the search bar at the top to search your projects, notes and skills. Switch it to Web to search the internet.</Empty> : null}
      {q ? (
        <div className="web-banner">
          {existing ? (
            <>
              <span>
                You follow this search as the topic <strong>{existing.title}</strong>.
              </span>
              <button className="btn btn--primary btn--sm" onClick={() => navigate(`/topics/${existing.id}`)}>
                Open topic
              </button>
            </>
          ) : (
            <>
              <span>Track this search? Save it as a topic to follow it in Research Topics.</span>
              <button className="btn btn--primary btn--sm" onClick={saveTopic} disabled={!data}>
                <Plus size={14} aria-hidden="true" /> Save “{q.length > 40 ? `${q.slice(0, 40)}…` : q}” as topic
              </button>
            </>
          )}
        </div>
      ) : null}
      {error ? (
        <p className="notice notice--bad" role="alert">
          {error} <button className="btn btn--sm btn--ghost" onClick={() => navigate("/settings")}>Search settings</button>
        </p>
      ) : null}
      {q && !data && !error ? <SkeletonBlock rows={4} label="Searching the web" /> : null}
      {data ? (
        <>
          <ResultTabs label="Result type" value={tab} onChange={setTab} counts={ORDER.map((t) => [t, t === "all" ? data.results.length : data.counts[t as ResultTab] ?? 0])} />
          <p className="web-safety">
            <ShieldCheck size={14} aria-hidden="true" /> Dark-web sites are always blocked{data.blocked ? `; ${data.blocked} result${data.blocked === 1 ? "" : "s"} hidden by your blocklist or that rule` : ""}.
            {data.unresponsive.length ? <span className="muted"> Some engines didn't answer: {data.unresponsive.slice(0, 5).join(", ")}{data.unresponsive.length > 5 ? "…" : ""}.</span> : null}
          </p>
          {shown.length ? (
            <div className="web-grid">
              {shown.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE).map((r) => (
                <ResultCard key={r.url} r={r} saved={savedUrls.has(r.url)} onToggleSave={toggleSave} />
              ))}
            </div>
          ) : (
            <p className="muted">No {tab === "all" ? "" : tab} results.</p>
          )}
          <Pager page={page} total={shown.length} onChange={setPage} label="Search result pages" />
        </>
      ) : null}
    </div>
  );
}
