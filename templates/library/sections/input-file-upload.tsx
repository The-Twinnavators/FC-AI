/** @flowcode-library input-file-upload · File upload (classic) (Forms)
 * Catalog ID: p.file-upload@classic (pattern version)
 * Version of: p.file-upload
 * Function: Drag-and-drop zone with a browse button, a file list with type icons, sizes, simulated upload progress and remove, refusing files that aren't images or PDFs or are over 10 MB.
 * Use it as: import { FileUpload } from "./file-upload-states"; <FileUpload version="classic" limitMb?={10} hint?="JPG, PNG, WebP or PDF" accept?="image/*,.pdf" multiple? dropLabel?="Drag files here" browseLabel?="Browse files" initialFiles? onChange? />
 * Look: A roomy dashed drop zone with an upload icon, "Drag files here", then "or" with a Browse files button beside it; each file below has a picture or page icon, its size, a progress bar and a remove button, and refused files are named in an alert instead of joining the list.
 * Tokens: --color-accent --color-border-strong --color-surface --color-surface-sunken --color-text-muted --color-danger --color-success --radius-lg --space-3 --space-5
 * Use cases: file upload; photo upload; document upload; receipt upload; attachments; id verification upload; resume upload; image upload
 * Jobs to be done: attach photos to my request; upload receipts or documents; remove a file i added by mistake; see my upload finish
 * Keywords: upload, file, drag and drop, dropzone, attachment, progress, validation
 */
/**
 * Input: file upload. This is p.file-upload@classic with this piece's sample content; the implementation lives in the
 * pattern, in ./file-upload-states. A drop zone with a browse button, then a list of the chosen files with a type icon,
 * size, a progress bar and a remove button. Files that are the wrong type or too big are refused with a clear reason.
 * The upload is simulated; nothing leaves the browser. Make it the app's own: replace SAMPLE with the real accepted
 * types and size limit, and swap the timer for the real upload.
 */
import { FileUpload } from "./file-upload-states";

// flowcode:sample
const SAMPLE = {
  title: "Attach your floor plan",
  lede: "Add photos of the room or a PDF plan so we can quote the job before the visit.",
  drop: "Drag files here",
  browse: "Browse files",
  hint: "JPG, PNG, WebP or PDF",
  accept: "image/jpeg,image/png,image/webp,image/gif,application/pdf",
  limitMb: 10,
};

export default function InputFileUpload() {
  const d = SAMPLE;
  return (
    <section className="fl-section">
      <div className="fl-wrap fl-wrap--narrow">
        <div className="fl-head">
          <h2 className="fl-title fl-title--md">{d.title}</h2>
          <p className="fl-text">{d.lede}</p>
        </div>
        <div className="fl-card fl-in-panel">
          <FileUpload version="classic" dropLabel={d.drop} browseLabel={d.browse} hint={d.hint} accept={d.accept} limitMb={d.limitMb} />
        </div>
      </div>
    </section>
  );
}
