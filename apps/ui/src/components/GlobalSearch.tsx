/**
 * Top-bar search: files across every project, requests and tasks, knowledge, skills and prompts.
 * Results appear as you type (debounced), grouped by kind; arrow keys move, Enter opens, Esc closes.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { Globe } from "lucide-react";
import { get } from "../api";
import { navigate } from "../router";
import { Icon } from "./ui";

type Kind = "project" | "file" | "request" | "task" | "knowledge" | "skill" | "prompt";
interface Hit {
  kind: Kind;
  title: string;
  snippet?: string;
  route: string;
  projectId?: string;
  path?: string;
}
const GROUPS: Array<{ kind: Kind; label: string; icon: string }> = [
  { kind: "project", label: "Projects", icon: "home" },
  { kind: "file", label: "Files", icon: "file" },
  { kind: "request", label: "Requests", icon: "workspace" },
  { kind: "task", label: "Tasks", icon: "checklist" },
  { kind: "knowledge", label: "Knowledge", icon: "knowledge" },
  { kind: "skill", label: "Skills", icon: "library" },
  { kind: "prompt", label: "Prompts", icon: "library" },
];

type Scope = "flowcode" | "web";
const SCOPE_KEY = "fc.search.scope";

export function GlobalSearch() {
  const [q, setQ] = useState("");
  /** FlowCode searches your projects and library as you type; Web searches the internet (SearXNG) on Enter. */
  const [scope, setScopeState] = useState<Scope>(() => {
    try {
      return localStorage.getItem(SCOPE_KEY) === "web" ? "web" : "flowcode";
    } catch {
      return "flowcode";
    }
  });
  const setScope = (v: Scope) => {
    setScopeState(v);
    try {
      localStorage.setItem(SCOPE_KEY, v);
    } catch {
      /* storage unavailable */
    }
    document.getElementById("global-search")?.focus();
  };
  const searchWeb = (term = q.trim()) => {
    if (!term) return;
    setOpen(false);
    navigate(`/search?q=${encodeURIComponent(term)}`);
  };
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [groups, setGroups] = useState<Record<Kind, Hit[]>>();
  const [active, setActive] = useState(0);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const term = q.trim();
    if (term.length < 2 || scope === "web") {
      setGroups(undefined);
      return;
    }
    setLoading(true);
    const t = setTimeout(() => {
      get<{ groups: Record<Kind, Hit[]> }>(`/search?q=${encodeURIComponent(term)}`)
        .then((r) => {
          setGroups(r.groups);
          setActive(0);
        })
        .catch(() => setGroups(undefined))
        .finally(() => setLoading(false));
    }, 220);
    return () => clearTimeout(t);
  }, [q, scope]);

  useEffect(() => {
    const close = (e: MouseEvent) => !box.current?.contains(e.target as Node) && setOpen(false);
    addEventListener("mousedown", close);
    return () => removeEventListener("mousedown", close);
  }, []);

  const flat = useMemo(() => GROUPS.flatMap((g) => groups?.[g.kind] ?? []), [groups]);
  const go = (h: Hit) => {
    setOpen(false);
    navigate(h.route);
    // Files open in the workspace's file viewer once it has mounted.
    if (h.kind === "file" && h.path) setTimeout(() => window.dispatchEvent(new CustomEvent("fc:open-file", { detail: h.path })), 450);
  };
  const onKey = (e: React.KeyboardEvent) => {
    if (scope === "web") {
      if (e.key === "Enter") (e.preventDefault(), searchWeb());
      else if (e.key === "Escape") setOpen(false);
      return;
    }
    if (e.key === "Enter" && !flat[active] && q.trim()) return void (e.preventDefault(), searchWeb());
    if (e.key === "ArrowDown") setActive((a) => Math.min(flat.length - 1, a + 1));
    else if (e.key === "ArrowUp") setActive((a) => Math.max(0, a - 1));
    else if (e.key === "Enter" && flat[active]) go(flat[active]);
    else if (e.key === "Escape") setOpen(false);
    else return;
    e.preventDefault();
  };

  let idx = -1;
  const showPanel = open && q.trim().length >= 2 && scope === "flowcode";
  return (
    <div className="gsearch" ref={box} data-guide="topbar.search" role="search">
      <label htmlFor="gsearch-scope" className="sr-only">Search in</label>
      <select id="gsearch-scope" className="select gsearch__scope" value={scope} onChange={(e) => setScope(e.target.value as Scope)}>
        <option value="flowcode">FlowCode</option>
        <option value="web">Web</option>
      </select>
      <div className="topbar__search">
        <Icon name="search" size={14} />
        <label htmlFor="global-search" className="sr-only">
          Search files, knowledge, prompts, skills and history
        </label>
        <input
          id="global-search"
          autoComplete="off"
          placeholder={scope === "web" ? "Search the web… (Enter)" : "Search files, requests, knowledge, skills…"}
          value={q}
          onChange={(e) => (setQ(e.target.value), setOpen(true))}
          onFocus={() => setOpen(true)}
          onKeyDown={onKey}
          role="combobox"
          aria-expanded={showPanel}
          aria-controls="gsearch-results"
          aria-activedescendant={showPanel && flat[active] ? `gs-${active}` : undefined}
        />
      </div>
      {showPanel ? (
        <div id="gsearch-results" className="gsearch__panel" role="listbox" aria-label="Search results">
          {loading && !groups ? <p className="gsearch__empty">Searching…</p> : null}
          {groups && !flat.length ? <p className="gsearch__empty">No matches for "{q.trim()}" in files, requests, knowledge, skills or prompts.</p> : null}
          <button className="gsearch__web" onClick={() => searchWeb()}>
            <Globe size={15} aria-hidden="true" /> Search the web for “{q.trim()}”
          </button>
          {GROUPS.map((g) => {
            const hits = groups?.[g.kind] ?? [];
            if (!hits.length) return null;
            return (
              <div key={g.kind} className="gsearch__group" role="group" aria-label={g.label}>
                <div className="gsearch__label">
                  {g.label} <span>{hits.length}</span>
                </div>
                {hits.map((h) => {
                  idx++;
                  const i = idx;
                  return (
                    <button key={`${h.kind}${h.route}${h.path ?? ""}${h.title}`} id={`gs-${i}`} role="option" aria-selected={i === active} className="gsearch__hit" onMouseEnter={() => setActive(i)} onClick={() => go(h)}>
                      <Icon name={g.icon} size={15} />
                      <span className="gsearch__text">
                        <span className="gsearch__title">{h.title}</span>
                        {h.snippet ? <span className="gsearch__snip">{h.snippet}</span> : null}
                      </span>
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
