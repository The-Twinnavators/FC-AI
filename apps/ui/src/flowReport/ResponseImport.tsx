/**
 * Importing a document that answers the report, and seeing what it would do before it does it.
 *  - The file is read here (File.text()) and sent as text: no path ever reaches the daemon.
 *  - Nothing is written until the preview has been read. Every proposal shows the words its status was read from,
 *    every status can be changed, and any row can be dropped.
 *  - A wrong file looks like a successful import (titles are generic), so the panel leads with the document's own
 *    heading and three counts, and a low match is said plainly.
 */
import { useRef, useState } from "react";
import { AlertTriangle, FileUp, X } from "lucide-react";
import { applyResponses, CATEGORY_LABEL, previewResponses, STATUS_LABEL, type FindingStatus, type FlowReportRun, type ImportPreview, type ProposedResponse } from "./api";

/** The statuses an imported response can carry. `open` is absent: a row that changes nothing is a row to untick. */
const CHOICES: FindingStatus[] = ["resolved", "not_applicable", "accepted_risk", "noted"];
const MAX_BYTES = 2 * 1024 * 1024;

export function ResponseImport({ run, onClose, onApplied }: { run: FlowReportRun; onClose: () => void; onApplied: (run: FlowReportRun, applied: number) => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [filename, setFilename] = useState<string | null>(null);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [rows, setRows] = useState<Array<ProposedResponse & { take: boolean }>>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pick = async (file: File) => {
    setError(null);
    if (file.size > MAX_BYTES) {
      setError(`That file is ${Math.round(file.size / 1024)}KB. The limit is 2MB.`);
      return;
    }
    setBusy(true);
    try {
      const got = await previewResponses(run.id, await file.text());
      setFilename(file.name);
      setPreview(got);
      // A row the parser is unsure of, or whose section disagrees with where the title was found, starts unticked.
      setRows(got.proposals.map((p) => ({ ...p, take: !p.categoryMismatch && p.verdictRule !== "no verdict read" })));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const apply = async () => {
    const taking = rows.filter((r) => r.take);
    if (taking.length === 0 || !preview) return;
    setBusy(true);
    setError(null);
    try {
      const res = await applyResponses(run.id, filename ?? "an uploaded document", taking);
      onApplied(res.run, res.applied);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const taking = rows.filter((r) => r.take).length;
  const closing = rows.filter((r) => r.take && (r.status === "resolved" || r.status === "not_applicable")).length;
  const setRow = (i: number, patch: Partial<ProposedResponse & { take: boolean }>) => setRows(rows.map((x, j) => (j === i ? { ...x, ...patch } : x)));

  return (
    <section className="fr-band" aria-labelledby="fr-import-title">
      <div className="fr-band__head">
        <div>
          <h3 id="fr-import-title" className="fr-band__title">
            Import responses
          </h3>
          <p className="fr-band__note">A Markdown document that answers this report. Each heading carrying a finding's title becomes a response on that finding. Nothing is written until you've read what it would do.</p>
        </div>
        <button type="button" className="fr-iconbtn" onClick={onClose} aria-label="Close the importer">
          <X size={14} />
        </button>
      </div>

      {!preview ? (
        <div>
          <input
            ref={fileRef}
            type="file"
            accept=".md,.markdown,.txt,text/markdown,text/plain"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void pick(f);
            }}
          />
          <button type="button" className="btn btn--sm" onClick={() => fileRef.current?.click()} disabled={busy}>
            <FileUp size={13} aria-hidden="true" /> {busy ? "Reading…" : "Choose a .md file"}
          </button>
          <p className="fr-fine">Markdown or plain text, up to 2MB. The file is read here and never leaves this computer.</p>
        </div>
      ) : null}

      {error ? (
        <p className="fr-alert fr-alert--bad" role="alert">
          <AlertTriangle size={13} aria-hidden="true" /> {error}
        </p>
      ) : null}

      {preview ? (
        <>
          <div className="fr-import__doc">
            <p>
              <span className="fr-quiet">Document. </span>
              {preview.documentTitle ?? "It has no heading of its own."}
              {filename ? ` · ${filename}` : ""}
            </p>
            <p className="fr-quiet">
              <b>{preview.proposals.length}</b> matched a finding in this run · <b>{preview.unmatched.length}</b> headings matched nothing · <b>{preview.unanswered}</b> findings in this report go unanswered.
            </p>
            {preview.proposals.length === 0 ? <p className="fr-warn-text">Nothing in this document names a finding in this report. The likeliest reason is that it answers a different project.</p> : null}
          </div>

          {rows.length > 0 ? (
            <ul className="fr-import__rows">
              {rows.map((r, i) => (
                <li key={`${r.category}/${r.findingId}`} className="fr-import__row">
                  <input type="checkbox" checked={r.take} onChange={(e) => setRow(i, { take: e.target.checked })} aria-label={`Import the response to ${r.findingTitle}`} />
                  <div className="fr-import__what">
                    <p className="fr-import__title">{r.findingTitle}</p>
                    <p className="fr-import__from">
                      {CATEGORY_LABEL[r.category] ?? r.category} · read from <span>“{r.verdictText.slice(0, 64)}”</span>
                    </p>
                    {r.categoryMismatch ? (
                      <p className="fr-warn-text">
                        The document files this under {CATEGORY_LABEL[r.categoryMismatch.documentSection] ?? r.categoryMismatch.documentSection}, but the finding is in {CATEGORY_LABEL[r.categoryMismatch.actual] ?? r.categoryMismatch.actual}.
                      </p>
                    ) : null}
                    {r.verdictRule === "no verdict read" ? <p className="fr-warn-text">No verdict could be read from this. Choose a status if you want it.</p> : null}
                  </div>
                  <select className="select fr-import__status" value={r.status} onChange={(e) => setRow(i, { status: e.target.value as FindingStatus })} aria-label={`Status for ${r.findingTitle}`}>
                    {CHOICES.map((s) => (
                      <option key={s} value={s}>
                        {STATUS_LABEL[s] ?? s}
                      </option>
                    ))}
                  </select>
                </li>
              ))}
            </ul>
          ) : null}

          <div className="fr-band__foot">
            <button type="button" className="btn btn--sm btn--primary" onClick={() => void apply()} disabled={busy || taking === 0}>
              {busy ? "Writing…" : `Import ${taking} response${taking === 1 ? "" : "s"}`}
            </button>
            {/* Said before it happens: closing a finding moves the section and overall scores. */}
            {closing > 0 ? <p className="fr-quiet">{closing} of these close a finding, which will move the score.</p> : null}
            <button type="button" className="fr-link" onClick={onClose}>
              Cancel
            </button>
          </div>
        </>
      ) : null}
    </section>
  );
}
