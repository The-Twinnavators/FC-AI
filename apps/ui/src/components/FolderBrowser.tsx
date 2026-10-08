/**
 * Choosing a folder by browsing it (after FlowAgent's Repo Report). A typed path is easy to get wrong, and a report about
 * the wrong folder reads exactly like one about the right one; browsing means the path is never typed, and the daemon
 * checks it before anything is read. The daemon lists folder names only (GET /system/folders): it never opens a file.
 * Folders with a manifest or .git are marked as likely repositories, as a hint, not a rule.
 *
 * `routes` points it at another listing with the same shapes (Repo Report uses its own /flow-reports/browse and /roots,
 * so the folders offered are the ones its daemon routes accept).
 *
 * Rendered into the body, so a transformed ancestor (page transitions) can't pull the fixed overlay off-centre.
 */
import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronRight, CornerLeftUp, Folder, FolderGit2, HardDrive, Loader2, X } from "lucide-react";
import { get } from "../api";
import "../styles/folder-browser.css";

interface BrowseEntry {
  name: string;
  path: string;
  looksLikeRepository: boolean;
}
interface Listing {
  path: string;
  parent: string | null;
  entries: BrowseEntry[];
}

const SYSTEM_ROUTES = { browse: "/system/folders", roots: "/system/folders/roots" };

export function FolderBrowser({ title = "Choose a repository", note, action = "Use this folder", verb = "Analyse", busy = false, routes = SYSTEM_ROUTES, onCancel, onChoose }: { title?: string; note?: string; action?: string; verb?: string; busy?: boolean; routes?: { browse: string; roots: string }; onCancel: () => void; onChoose: (path: string, name: string) => void }) {
  const [roots, setRoots] = useState<Array<{ name: string; path: string }>>([]);
  const [listing, setListing] = useState<Listing>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();

  const go = useCallback(async (target?: string) => {
    setLoading(true);
    setError(undefined);
    try {
      setListing(await get<Listing>(`${routes.browse}${target ? `?path=${encodeURIComponent(target)}` : ""}`));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [routes.browse]);

  useEffect(() => {
    void (async () => {
      try {
        setRoots((await get<{ roots: Array<{ name: string; path: string }> }>(routes.roots)).roots);
      } catch {
        /* the shortcuts are a convenience */
      }
      await go();
    })();
  }, [go, routes.roots]);

  // Escape closes: a dialog that traps someone who opened it by accident is one they learn not to open.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busy) onCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCancel, busy]);

  const path = listing?.path;
  const leaf = path ? (path.split(/[\\/]/).filter(Boolean).pop() ?? path) : "";

  return createPortal(
    <div className="fbrowse" onClick={(e) => e.target === e.currentTarget && !busy && onCancel()}>
      <div className="fbrowse__dialog" role="dialog" aria-modal="true" aria-labelledby="fbrowse-title">
        <div className="fbrowse__head">
          <div style={{ minWidth: 0 }}>
            <h2 id="fbrowse-title" className="fbrowse__title">
              {title}
            </h2>
            <p className="fbrowse__note">{note ?? "FlowCode reads the files in this folder. It never writes to it, never runs anything in it, and never uploads it."}</p>
          </div>
          <button type="button" className="fbrowse__icon" onClick={onCancel} disabled={busy} aria-label="Close">
            <X size={16} />
          </button>
        </div>

        {roots.length > 1 ? (
          <div className="fbrowse__roots">
            {roots.map((r) => (
              <button key={r.path} type="button" className="fbrowse__root" onClick={() => void go(r.path)}>
                <HardDrive size={11} aria-hidden="true" />
                {r.name}
              </button>
            ))}
          </div>
        ) : null}

        {/* The full location, so you can confirm it's the folder you mean. */}
        <div className="fbrowse__where">
          <button type="button" className="fbrowse__icon" onClick={() => listing?.parent && void go(listing.parent)} disabled={!listing?.parent || loading} title="Up one level" aria-label="Up one level">
            <CornerLeftUp size={14} />
          </button>
          <code className="fbrowse__path" title={path ?? ""}>
            {path ?? "…"}
          </code>
        </div>

        <div className="fbrowse__list">
          {loading ? (
            <p className="fbrowse__msg">
              <Loader2 size={14} className="spin" aria-hidden="true" /> Reading the folder…
            </p>
          ) : error ? (
            <p className="fbrowse__msg fbrowse__msg--bad">{error}</p>
          ) : !listing?.entries.length ? (
            <p className="fbrowse__msg">No sub-folders here. This folder can still be chosen with the button below.</p>
          ) : (
            listing.entries.map((e) => (
              <button key={e.path} type="button" className="fbrowse__entry" onClick={() => void go(e.path)}>
                {e.looksLikeRepository ? <FolderGit2 size={14} className="fbrowse__repo" aria-hidden="true" /> : <Folder size={14} className="fbrowse__folder" aria-hidden="true" />}
                <span className="fbrowse__name">{e.name}</span>
                {e.looksLikeRepository ? <span className="fbrowse__hint">has a manifest</span> : null}
                <ChevronRight size={13} className="fbrowse__chev" aria-hidden="true" />
              </button>
            ))
          )}
        </div>

        <div className="fbrowse__foot">
          <p className="fbrowse__target">
            {leaf ? (
              <>
                {verb} <strong>{leaf}</strong>
              </>
            ) : (
              " "
            )}
          </p>
          <div className="fbrowse__actions">
            <button type="button" className="btn btn--ghost btn--sm" onClick={onCancel} disabled={busy}>
              Cancel
            </button>
            <button type="button" className="btn btn--primary btn--sm" onClick={() => path && onChoose(path, leaf)} disabled={!path || loading || busy}>
              {busy ? <Loader2 size={13} className="spin" aria-hidden="true" /> : null}
              {busy ? "Checking…" : action}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
