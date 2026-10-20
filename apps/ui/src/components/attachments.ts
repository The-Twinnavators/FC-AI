/**
 * The files a person attaches to a build (Home's composer, New build): which role each plays, what FlowCode reads from
 * it, and the limits the daemon enforces. One place, so every way into a build accepts and describes files the same.
 */
import type { ReferenceFile } from "@flowcode/contracts";
import { readCaptureFile } from "./StyleCapture";

export type Attachment = ReferenceFile & { size: number; summary: string };

export const ACCEPT = ".md,.markdown,.html,.htm,.css,.json,.txt,.png,.jpg,.jpeg,.webp,.gif";
export const MAX_FILE = 1_500_000;
/** Limits the backend enforces: description length and the total size of all attached files. */
export const MAX_DESC = 20_000;
export const MAX_TOTAL = 6_000_000;
/** What the accepted types are for, in the person's words. */
export const ACCEPT_LABELS = [".md PRD", ".json content", ".html", ".css", "images"];

export function roleFor(name: string, hasPrd: boolean): ReferenceFile["role"] | undefined {
  const ext = name.toLowerCase().split(".").pop() ?? "";
  if (ext === "md" || ext === "markdown") return hasPrd ? "text" : "prd";
  if (ext === "html" || ext === "htm") return "html";
  if (ext === "css") return "css";
  if (ext === "json") return "json";
  if (ext === "txt") return "text";
  if (/^(png|jpe?g|webp|gif)$/.test(ext)) return "image";
  return undefined;
}

/** Client-side preview of what a file gives the build (the daemon re-checks after the build). */
export function summarize(role: ReferenceFile["role"], content: string): string {
  // Style capture is off, so an image is a reference kept with the project, not a source of colours and fonts.
  if (role === "image") return "Kept with the project as a reference image";
  try {
    if (role === "html") {
      const doc = new DOMParser().parseFromString(content, "text/html");
      doc.querySelectorAll("script,style,noscript,template").forEach((n) => n.remove());
      const words = (doc.body?.textContent ?? "").split(/\s+/).filter(Boolean).length;
      const links = doc.querySelectorAll("a[href]").length;
      const fields = Array.from(doc.querySelectorAll("input,select,textarea")).filter((f) => (f as HTMLInputElement).type !== "hidden").length;
      return `Keeps ${words} words, ${links} links and ${fields} form fields — checked after the build`;
    }
    if (role === "css") {
      const vars = (content.match(/--[\w-]+\s*:/g) ?? []).length;
      return `${(content.match(/\{/g) ?? []).length} rules, ${vars} custom properties`;
    }
    if (role === "json") {
      const v = JSON.parse(content) as unknown;
      return Array.isArray(v) ? `Array of ${v.length} items` : `Object with ${Object.keys(v as object).length} keys`;
    }
    const reqs = content.split("\n").filter((l) => /^\s*(?:[-*+]|\d+[.)])\s+\S/.test(l) || /\b(must|should|shall)\b/i.test(l)).length;
    return role === "prd" ? `PRD · ${reqs} requirement lines` : `${content.length.toLocaleString()} characters`;
  } catch (e) {
    return `Could not read: ${(e as Error).message}`;
  }
}

/** Reads dropped or chosen files onto the current list; each refused file says why, and the others are kept. */
export async function readAttachments(files: FileList | File[], current: Attachment[]): Promise<{ next: Attachment[]; errors: string[] }> {
  const next = [...current];
  const errors: string[] = [];
  for (const f of Array.from(files)) {
    const role = roleFor(f.name, next.some((r) => r.role === "prd"));
    if (!role) {
      errors.push(`${f.name}: only .md, .html, .css, .json, .txt and image files are supported`);
      continue;
    }
    if (next.reduce((n, r) => n + r.size, 0) + f.size > MAX_TOTAL) {
      errors.push(`${f.name} would take the attached files over 6 MB in total`);
      continue;
    }
    if (f.size > MAX_FILE) {
      errors.push(`${f.name} is larger than 1.5 MB`);
      continue;
    }
    const read = role === "image" ? await readCaptureFile(f) : undefined;
    if (typeof read === "string") {
      errors.push(read);
      continue;
    }
    const content = read ? read.content : await f.text();
    next.push({ name: f.name, role, content, size: f.size, summary: summarize(role, content) });
  }
  return { next, errors };
}
