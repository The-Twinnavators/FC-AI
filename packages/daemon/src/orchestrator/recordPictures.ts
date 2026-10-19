/**
 * The records' pictures, completed by FlowCode: a record of a list with pictures whose picture is missing (empty, or
 * naming a file that isn't in public/) gets one. First an open photo found by the record's own words, through the same
 * search as find_image with its filters for unsuitable results. When none fits, a picture FlowCode draws: a local SVG
 * showing the record's title, in the record's orientation. Frameproof main build: the pictures step was verified with
 * 4 of 12 photos missing (Quiet Smile, Autumn Path, Linen Backdrop, Candid Laugh): the model's searches found nothing,
 * and it never drew the SVG its brief allowed.
 */
import fs from "node:fs";
import path from "node:path";
import type { AppModel, ModelEntity } from "./appModel.js";
import { builtViews } from "./appFiles.js";
import { altFieldOf, imageFieldOf } from "./selectionComposer.js";
import { readGeneratedData } from "../quality/appData.js";

export const PICTURES_STEP = "Give the records their pictures";

export interface PictureGap {
  id: string;
  title: string;
  /** Words that describe the record (its title, then its alt text's). */
  words: string[];
  category?: string;
  orientation?: "portrait" | "landscape" | "square";
}

const STOP = new Set("a an the of with during using as main source photo photos photograph image picture shot taken by in on at for and to from his her their its two one this that is are under over".split(" "));
export const contentWords = (s: string) => [...new Set(s.toLowerCase().replace(/[^a-z\s-]/g, " ").split(/\s+/).filter((w) => w.length > 2 && !STOP.has(w)))];

/** The list entity with pictures, its picture field and its records without a local picture. */
/**
 * unsuitable: records whose picture a check turned away, replaced like missing ones. `present`: the records that have a
 * local picture, with its file (for that check).
 */
export function pictureGaps(root: string, m: AppModel, unsuitable: string[] = []): { entity: ModelEntity; field: string; gaps: PictureGap[]; present: Array<PictureGap & { file: string }>; kind?: string } | undefined {
  const listView = builtViews(m).find((v) => {
    const e = m.entities.find((x) => x.key === v.entity);
    return v.kind === "list" && !!e && !!imageFieldOf(e);
  });
  const entity = listView ? m.entities.find((x) => x.key === listView.entity) : undefined;
  const field = entity ? imageFieldOf(entity)?.key : undefined;
  const data = readGeneratedData(root);
  if (!entity || !field || !data) return undefined;
  const rows = data.seed[entity.key] ?? [];
  const alt = altFieldOf(entity)?.key;
  const category = (entity.filters ?? [])[0];
  const orientationField = entity.fields.find((f) => /orientation/i.test(f.key))?.key;
  const missing = (v: string) => !v.trim() || /^(https?:)?\/\//i.test(v) || /^data:/i.test(v) || !fs.existsSync(path.join(root, "public", v.replace(/^\/+/, "")));
  const gapOf = (r: Record<string, unknown>): PictureGap => {
    const title = String(r[entity.titleField] ?? r.id);
    const o = orientationField ? String(r[orientationField] ?? "").toLowerCase() : "";
    return {
      id: String(r.id),
      title,
      words: contentWords(`${title} ${alt ? String(r[alt] ?? "") : ""}`),
      category: category ? String(r[category] ?? "") || undefined : undefined,
      orientation: o === "portrait" || o === "landscape" || o === "square" ? (o as PictureGap["orientation"]) : undefined,
    };
  };
  const gaps = rows.filter((r) => missing(String(r[field] ?? "")) || unsuitable.includes(String(r.id))).map(gapOf);
  const present = rows.filter((r) => !missing(String(r[field] ?? ""))).map((r) => ({ ...gapOf(r), file: String(r[field]) }));
  // What kind of pictures the collection holds: the word its records' descriptions share most ("portrait").
  const counts = new Map<string, number>();
  if (alt) for (const r of rows) for (const w of contentWords(String(r[alt] ?? ""))) counts.set(w, (counts.get(w) ?? 0) + 1);
  const kind = [...counts.entries()].filter(([, n]) => n >= Math.max(2, rows.length / 3)).sort((a, b) => b[1] - a[1])[0]?.[0];
  return { entity, field, gaps, present, kind };
}

/** The searches for a record's photo, most specific first, each with the words one of which the photo must be about. */
export function pictureQueries(g: PictureGap, kind?: string): Array<{ query: string; mustMatch: string[] }> {
  const own = contentWords(g.title);
  const out = [
    { query: [...own, ...(kind && !own.includes(kind) ? [kind] : [])].join(" "), mustMatch: own },
    { query: g.words.slice(0, 3).join(" "), mustMatch: g.words.slice(0, 3) },
    ...(kind && g.category ? [{ query: `${g.category.toLowerCase()} ${kind}`, mustMatch: [kind] }] : []),
  ];
  return out.filter((q, i) => q.query.trim() && q.mustMatch.length && out.findIndex((x) => x.query === q.query) === i);
}

/** src/app/schema.ts with one record's field set (the record found by its id); undefined when it isn't there. */
export function withRecordValue(schemaText: string, id: string, field: string, value: string): string | undefined {
  const at = schemaText.indexOf(`"id": ${JSON.stringify(id)}`);
  if (at < 0) return undefined;
  const end = schemaText.indexOf("}", at);
  const re = new RegExp(`("${field}":\\s*)"(?:[^"\\\\]|\\\\.)*"`);
  const block = schemaText.slice(at, end);
  if (!re.test(block)) return undefined;
  return schemaText.slice(0, at) + block.replace(re, `$1${JSON.stringify(value)}`) + schemaText.slice(end);
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/**
 * A picture FlowCode draws for a record no open photo fits: a quiet tonal panel with the record's title, in its
 * orientation. It is plainly a stand-in, distinct per record (n shifts the hue a little).
 */
export function pictureSvg(title: string, orientation: PictureGap["orientation"], n: number): string {
  const [w, h] = orientation === "landscape" ? [1200, 800] : orientation === "square" ? [1000, 1000] : [800, 1000];
  const hue = (28 + n * 37) % 360;
  const lines = title.length > 18 ? title.split(/\s+/).reduce<string[]>((acc, word) => {
    const last = acc[acc.length - 1];
    if (last && `${last} ${word}`.length <= 18) acc[acc.length - 1] = `${last} ${word}`;
    else acc.push(word);
    return acc;
  }, []) : [title];
  const size = Math.round(w / 14);
  const top = h / 2 - ((lines.length - 1) * size * 1.2) / 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" role="img" aria-label="${esc(title)}">
  <defs>
    <linearGradient id="tone" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="hsl(${hue} 16% 80%)"/>
      <stop offset="1" stop-color="hsl(${hue} 14% 64%)"/>
    </linearGradient>
  </defs>
  <rect width="${w}" height="${h}" fill="url(#tone)"/>
  <rect x="${w * 0.06}" y="${h * 0.06}" width="${w * 0.88}" height="${h * 0.88}" fill="none" stroke="hsl(${hue} 18% 30%)" stroke-opacity="0.35" stroke-width="2"/>
${lines.map((l, i) => `  <text x="50%" y="${Math.round(top + i * size * 1.2)}" text-anchor="middle" dominant-baseline="middle" font-family="Georgia, 'Times New Roman', serif" font-size="${size}" fill="hsl(${hue} 22% 18%)">${esc(l)}</text>`).join("\n")}
</svg>
`;
}
