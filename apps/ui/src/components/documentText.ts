/**
 * Turns an uploaded file into plain text, entirely on this machine: PDFs with Mozilla's pdf.js, Word (.docx) with
 * mammoth, everything else read as text. Libraries load only when a file of that kind is added.
 */
export const TEXT_ACCEPT = ".md,.markdown,.txt,.json,.csv,.tsv,.html,.htm,.xml,.yaml,.yml,.css,.js,.ts,.tsx,.jsx,.py,.rst,.log";
export const DOC_ACCEPT = `${TEXT_ACCEPT},.pdf,.docx`;
/** Raw file size limits: PDFs and Word files are mostly not text, so they can be much bigger than the text they hold. */
export const MAX_TEXT_FILE = 4_000_000;
export const MAX_BINARY_FILE = 60_000_000;

const ext = (name: string) => name.toLowerCase().split(".").pop() ?? "";

export class DocumentError extends Error {
  constructor(
    message: string,
    public reason: string,
  ) {
    super(message);
  }
}

export async function documentText(file: File, onProgress?: (note: string) => void): Promise<string> {
  const e = ext(file.name);
  if (e === "pdf") {
    if (file.size > MAX_BINARY_FILE) throw new DocumentError("larger than 60 MB", "Too large (over 60 MB)");
    const pdfjs = await import("pdfjs-dist");
    const worker = await import("pdfjs-dist/build/pdf.worker.min.mjs?url");
    pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
    const task = pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) });
    let doc;
    try {
      doc = await task.promise;
    } catch (err) {
      const m = (err as Error).message ?? "";
      throw new DocumentError(m, /password/i.test(m) ? "Password-protected PDF" : "Couldn't open the PDF");
    }
    const pages: string[] = [];
    for (let i = 1; i <= doc.numPages; i++) {
      if (i % 10 === 1) onProgress?.(`page ${i} of ${doc.numPages}`);
      const page = await doc.getPage(i);
      const content = await page.getTextContent();
      // Rebuild lines from the text items: a new line whenever pdf.js marks an end of line.
      let line = "";
      const lines: string[] = [];
      for (const item of content.items as Array<{ str?: string; hasEOL?: boolean }>) {
        if (typeof item.str !== "string") continue;
        line += item.str;
        if (item.hasEOL) {
          lines.push(line.trimEnd());
          line = "";
        }
      }
      if (line.trim()) lines.push(line.trimEnd());
      const text = lines.join("\n").replace(/\n{3,}/g, "\n\n").trim();
      if (text) pages.push(`## Page ${i}\n\n${text}`);
      page.cleanup();
    }
    await task.destroy();
    const out = pages.join("\n\n");
    if (!out.trim()) throw new DocumentError("no text", "Scanned PDF with no text (images only)");
    return out;
  }
  if (e === "docx") {
    if (file.size > MAX_BINARY_FILE) throw new DocumentError("larger than 60 MB", "Too large (over 60 MB)");
    const mammoth = await import("mammoth");
    const r = await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() });
    if (!r.value.trim()) throw new DocumentError("no text", "Empty Word document");
    return r.value;
  }
  if (e === "doc") throw new DocumentError("old Word format", "Old .doc format: save it as .docx");
  if (!TEXT_ACCEPT.split(",").includes(`.${e}`)) throw new DocumentError("unsupported type", `Unsupported file type (.${e})`);
  if (file.size > MAX_TEXT_FILE) throw new DocumentError("larger than 4 MB", "Too large (text files over 4 MB)");
  return file.text();
}
