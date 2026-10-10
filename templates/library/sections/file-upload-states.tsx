/** @flowcode-library file-upload-states · File upload: dropzone and the files after it (Forms)
 * Use cases: attach a PRD; upload photos; import a spreadsheet; profile picture; supporting documents
 * Jobs to be done: add a file; see it is going up; know when it failed and try again
 * Keywords: upload, dropzone, drag and drop, progress, attachment, error
 */
/**
 * A dropzone in each state it passes through, and the list of files underneath it, because an upload is never only
 * the moment of dropping: a file goes up, finishes, or fails and has to be retried.
 *
 * The first zone is live. Drop a file on it, or click to pick one, and it appears in the list below and climbs to
 * done; anything over the size limit lands as refused. Only a file that failed on the way up offers Try again, because
 * retrying one that is too big would fail the same way. The other three zones are the first one, frozen mid-state.
 *
 * Make it the app's own: set which file kinds you take and say so in the dropzone. Keep the retry on rows that can
 * succeed on a second try, and only on those.
 */
/**
 * How to try it
 * - Drop a file on the first zone, or press it to pick one: it appears in the list and climbs to done.
 * - Drop something over 10 MB: it lands refused, and offers no retry, because retrying it would fail the same way.
 * - Press "Try again" on the row that lost its connection: that one can succeed.
 * - Press the x on any row to remove it.
 *
 * Dependencies: React (useEffect, useRef, useState), and the library's own inline icon set ("./icons"), which is a table of
 * SVG paths rather than an icon package. Nothing else — no package to install and nothing fetched at run time. The styles
 * are the library's own fl- classes in templates/library/css, and the sample data is in the file, so the piece runs in a
 * built app exactly as it runs here.
 */
import { useEffect, useRef, useState } from "react";
import { Icon } from "./icons";

// flowcode:sample
const SAMPLE = {
  zones: [
    { id: "idle", label: "Waiting", what: "Nothing happening yet. This one works: drop a file, or click it.", cls: "" },
    { id: "over", label: "File over it", what: "A file is being dragged across", cls: " is-over" },
    { id: "busy", label: "Uploading", what: "On its way up", cls: " is-busy" },
    { id: "error", label: "Refused", what: "Wrong kind, or too big", cls: " is-error" },
  ],
  files: [
    { id: "f1", name: "brief-v3.pdf", size: "240 KB", state: "done", note: "Added", pct: 100, retry: false },
    { id: "f2", name: "moodboard.png", size: "3.1 MB", state: "busy", note: "62%", pct: 62, retry: false },
    { id: "f3", name: "venue-walkthrough.mov", size: "7.4 MB", state: "error", note: "Lost connection partway", pct: 0, retry: true },
    { id: "f4", name: "shot-list.xlsx", size: "18 MB", state: "error", note: "Too big: 10 MB is the most", pct: 0, retry: false },
  ] as Row[],
  limitMb: 10,
};

type Row = { id: string; name: string; size: string; state: "done" | "busy" | "error"; note: string; pct: number; retry: boolean };

function saySize(bytes: number) {
  if (bytes >= 1048576) return `${(bytes / 1048576).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

export default function FileUploadStates() {
  const d = SAMPLE;
  const [rows, setRows] = useState<Row[]>(d.files);
  const [over, setOver] = useState(false);
  const [said, setSaid] = useState("");
  const seq = useRef(0);
  const busy = rows.some((r) => r.state === "busy");

  // Anything mid-upload climbs on its own, then settles as done.
  useEffect(() => {
    if (!busy) return;
    const tick = window.setInterval(() => {
      setRows((rs) =>
        rs.map((r) => {
          if (r.state !== "busy") return r;
          const pct = Math.min(100, r.pct + 9);
          return pct >= 100 ? { ...r, pct: 100, state: "done", note: "Added" } : { ...r, pct, note: `${pct}%` };
        })
      );
    }, 260);
    return () => window.clearInterval(tick);
  }, [busy]);

  const take = (files: FileList | null) => {
    if (!files || !files.length) return;
    const limit = d.limitMb * 1048576;
    const added: Row[] = Array.from(files).map((f) => {
      seq.current += 1;
      const tooBig = f.size > limit;
      return {
        id: `up-${seq.current}`,
        name: f.name,
        size: saySize(f.size),
        state: tooBig ? "error" : "busy",
        note: tooBig ? `Too big: ${d.limitMb} MB is the most` : "0%",
        pct: 0,
        retry: false,
      };
    });
    setRows((rs) => [...rs, ...added]);
    const refused = added.filter((r) => r.state === "error").length;
    setSaid(refused ? `${added.length} added, ${refused} refused for size` : `Adding ${added.length} file${added.length === 1 ? "" : "s"}`);
  };

  const retry = (id: string) => {
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, state: "busy", pct: 0, note: "0%" } : r)));
    setSaid("Trying that one again");
  };

  const drop = (id: string, name: string) => {
    setRows((rs) => rs.filter((r) => r.id !== id));
    setSaid(`Removed ${name}`);
  };

  return (
    <section className="fl-section fl-section--specimen">
      <ul className="fl-ctl-zone-grid">
        {d.zones.map((z) => (
          <li key={z.id}>
            <p className="fl-ctl-matrix-kind">{z.label}</p>
            <p className="fl-ctl-matrix-what">{z.what}</p>

            {z.id === "idle" ? (
              <label
                className={`fl-ctl-zone fl-ctl-zone--live${over ? " is-over" : ""}`}
                onDragEnter={(e) => {
                  e.preventDefault();
                  setOver(true);
                }}
                onDragOver={(e) => e.preventDefault()}
                onDragLeave={() => setOver(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setOver(false);
                  take(e.dataTransfer.files);
                }}
              >
                <input
                  type="file"
                  multiple
                  className="fl-sr"
                  onChange={(e) => {
                    take(e.target.files);
                    e.target.value = "";
                  }}
                />
                <Icon name="download" />
                <strong>{over ? "Let go to add them" : "Drop files here"}</strong>
                <span className="fl-ctl-matrix-what">PDF, PNG or JPG, up to {d.limitMb} MB</span>
              </label>
            ) : (
              <div className={`fl-ctl-zone${z.cls}`}>
                <Icon name={z.id === "error" ? "close" : "download"} />
                {z.id === "over" ? <strong>Let go to add them</strong> : null}
                {z.id === "busy" ? (
                  <>
                    <strong>Adding 2 files</strong>
                    <span className="fl-ctl-bar">
                      <span style={{ width: "62%" }} />
                    </span>
                  </>
                ) : null}
                {z.id === "error" ? (
                  <>
                    <strong>That file was not added</strong>
                    <span className="fl-ctl-matrix-what">shot-list.xlsx is 18 MB. The most is {d.limitMb} MB.</span>
                  </>
                ) : null}
              </div>
            )}
          </li>
        ))}
      </ul>

      <p className="fl-ctl-status" role="status" aria-live="polite">
        {said || `${rows.length} file${rows.length === 1 ? "" : "s"} in the list.`}
      </p>

      <div className="fl-ctl-sizes">
        <h3>The files underneath</h3>
        <p className="fl-ctl-btn-what">One row per file: what it is, how it is going, and what you can do about it.</p>
        {rows.length ? (
          <ul className="fl-ctl-file-list">
            {rows.map((f) => (
              <li key={f.id} className={`is-${f.state}`}>
                <span className="fl-ctl-file-main">
                  <strong>{f.name}</strong>
                  <span className="fl-ctl-matrix-what">
                    {f.size} · {f.note}
                  </span>
                  {f.state === "busy" ? (
                    <span className="fl-ctl-bar" role="progressbar" aria-valuenow={f.pct} aria-valuemin={0} aria-valuemax={100} aria-label={`Uploading ${f.name}`}>
                      <span style={{ width: `${f.pct}%` }} />
                    </span>
                  ) : null}
                </span>
                {f.state === "error" && f.retry ? (
                  <button type="button" className="fl-btn fl-btn--secondary fl-ctl-btn--32" onClick={() => retry(f.id)}>
                    Try again
                  </button>
                ) : (
                  <button
                    type="button"
                    className="fl-btn fl-ctl-btn--tertiary fl-ctl-btn--icon fl-ctl-btn--32"
                    aria-label={`Remove ${f.name}`}
                    title="Remove"
                    onClick={() => drop(f.id, f.name)}
                  >
                    <Icon name="close" />
                  </button>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p className="fl-ctl-matrix-what">Nothing attached yet.</p>
        )}
      </div>
    </section>
  );
}
