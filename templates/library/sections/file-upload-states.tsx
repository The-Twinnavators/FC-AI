/** @flowcode-library file-upload-states - File upload: dropzone and the files after it (Forms)
 * Use cases: attach a PRD; upload photos; import a spreadsheet; profile picture; supporting documents
 * Jobs to be done: add a file; see it is going up; know when it failed and try again
 * Keywords: upload, dropzone, drag and drop, progress, attachment, error
 */
/**
 * A dropzone in each state it passes through, and the list of files underneath it, because an upload is never only
 * the moment of dropping: a file goes up, finishes, or fails and has to be retried.
 *
 * Make it the app's own: set which file kinds you take and say so in the dropzone. Keep the retry on a failed row.
 */
import { Icon } from "./icons";

// flowcode:sample
const SAMPLE = {
  zones: [
    { id: "idle", label: "Waiting", what: "Nothing happening yet", cls: "" },
    { id: "over", label: "File over it", what: "A file is being dragged across", cls: " is-over" },
    { id: "busy", label: "Uploading", what: "On its way up", cls: " is-busy" },
    { id: "error", label: "Refused", what: "Wrong kind, or too big", cls: " is-error" },
  ],
  files: [
    { id: "f1", name: "brief-v3.pdf", size: "240 KB", state: "done", note: "Added" },
    { id: "f2", name: "moodboard.png", size: "3.1 MB", state: "busy", note: "62%" },
    { id: "f3", name: "shot-list.xlsx", size: "18 MB", state: "error", note: "Too big: 10 MB is the most" },
  ],
};

export default function FileUploadStates() {
  const d = SAMPLE;
  return (
    <section className="fl-section fl-section--specimen">
      <ul className="fl-ctl-zone-grid">
        {d.zones.map((z) => (
          <li key={z.id}>
            <p className="fl-ctl-matrix-kind">{z.label}</p>
            <p className="fl-ctl-matrix-what">{z.what}</p>
            <div className={`fl-ctl-zone${z.cls}`}>
              <Icon name={z.id === "error" ? "close" : "download"} />
              {z.id === "idle" ? (
                <>
                  <strong>Drop files here</strong>
                  <span className="fl-ctl-matrix-what">PDF, PNG or JPG, up to 10 MB</span>
                </>
              ) : null}
              {z.id === "over" ? <strong>Let go to add them</strong> : null}
              {z.id === "busy" ? (
                <>
                  <strong>Adding 2 files</strong>
                  <span className="fl-ctl-bar" role="progressbar" aria-valuenow={62} aria-valuemin={0} aria-valuemax={100} aria-label="Upload progress">
                    <span style={{ width: "62%" }} />
                  </span>
                </>
              ) : null}
              {z.id === "error" ? (
                <>
                  <strong>That file was not added</strong>
                  <span className="fl-ctl-matrix-what">shot-list.xlsx is 18 MB. The most is 10 MB.</span>
                </>
              ) : null}
            </div>
          </li>
        ))}
      </ul>

      <div className="fl-ctl-sizes">
        <h3>The files underneath</h3>
        <p className="fl-ctl-btn-what">One row per file: what it is, how it is going, and what you can do about it.</p>
        <ul className="fl-ctl-file-list">
          {d.files.map((f) => (
            <li key={f.id} className={`is-${f.state}`}>
              <span className="fl-ctl-file-main">
                <strong>{f.name}</strong>
                <span className="fl-ctl-matrix-what">
                  {f.size} · {f.note}
                </span>
                {f.state === "busy" ? (
                  <span className="fl-ctl-bar" role="progressbar" aria-valuenow={62} aria-valuemin={0} aria-valuemax={100} aria-label={`Uploading ${f.name}`}>
                    <span style={{ width: "62%" }} />
                  </span>
                ) : null}
              </span>
              {f.state === "error" ? (
                <button type="button" className="fl-btn fl-btn--secondary fl-ctl-btn--32">
                  Try again
                </button>
              ) : (
                <button type="button" className="fl-btn fl-ctl-btn--tertiary fl-ctl-btn--icon fl-ctl-btn--32" aria-label={`Remove ${f.name}`} title="Remove">
                  <Icon name="close" />
                </button>
              )}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
