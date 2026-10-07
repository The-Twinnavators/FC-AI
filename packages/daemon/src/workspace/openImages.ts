/**
 * Real, openly licensed photos for prototypes (find_image): searches Openverse (openverse.org, the open-licence media
 * catalogue), prefers CC0 and public domain, then CC BY, and saves the picture into the app (public/images/) so nothing
 * is hotlinked and the prototype works offline. Every image's credit goes in src/content/image-credits.json; CC BY
 * images must show it (the app's about or footer).
 * The user wants production-level design with open-source images, icons and SVGs (icons: lucide-react in the kit;
 * illustrations: inline SVG the coder draws).
 */
import fs from "node:fs";
import path from "node:path";
import type { PathJail } from "../security/pathJail.js";

const API = "https://api.openverse.org/v1/images/";
const UA = "FlowCode/0.1 (prototype image search; https://openverse.org)";
const MAX_BYTES = 4_000_000;
const CREDITS = "src/content/image-credits.json";

export interface ImageCredit {
  file: string;
  title: string;
  creator: string;
  license: string;
  licenseUrl: string;
  source: string;
}

interface Result {
  id: string;
  title?: string;
  url: string;
  thumbnail?: string;
  creator?: string;
  license: string;
  license_version?: string;
  license_url?: string;
  foreign_landing_url?: string;
  width?: number;
  height?: number;
}

const slugOf = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "image";
const EXT: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif" };

/** Most open first (CC0, public domain, then CC BY), then the largest. */
const rank = (r: Result) => (r.license === "cc0" || r.license === "pdm" ? 0 : 1) * 1e9 - (r.width ?? 0) * (r.height ?? 0) / 1e3;

async function download(url: string, signal?: AbortSignal): Promise<{ bytes: Buffer; type: string } | undefined> {
  const res = await fetch(url, { headers: { "user-agent": UA }, redirect: "follow", signal });
  const type = (res.headers.get("content-type") ?? "").split(";")[0].trim();
  if (!res.ok || !EXT[type]) return undefined;
  const len = Number(res.headers.get("content-length") ?? 0);
  if (len > MAX_BYTES) return undefined;
  const bytes = Buffer.from(await res.arrayBuffer());
  return bytes.length > MAX_BYTES || bytes.length < 2000 ? undefined : { bytes, type };
}

export async function findOpenImage(
  jail: PathJail,
  input: { query: string; name?: string; orientation?: "landscape" | "portrait" | "square" },
  signal?: AbortSignal,
  /**
   * Looks at a candidate (Openverse's small preview) and says whether it clearly shows what was asked for. Search by
   * words alone gave a dairy brand a pizza and a yerba mate brand cat figurines (No BIO & GMO build).
   */
  check?: (image: Buffer, query: string) => Promise<{ ok: boolean; reason: string }>,
): Promise<{ ok: boolean; message: string; paths: string[] }> {
  const q = new URLSearchParams({ q: input.query, license: "cc0,pdm,by", page_size: "12", mature: "false" });
  if (input.orientation) q.set("aspect_ratio", input.orientation === "landscape" ? "wide" : input.orientation === "portrait" ? "tall" : "square");
  const res = await fetch(`${API}?${q}`, { headers: { "user-agent": UA, accept: "application/json" }, signal });
  if (!res.ok) return { ok: false, message: `The open image search didn't answer (HTTP ${res.status}). Try again, or use an inline SVG illustration instead.`, paths: [] };
  const results = (((await res.json()) as { results?: Result[] }).results ?? []).filter((r) => r.url && (r.width ?? 0) >= 500).sort((a, b) => rank(a) - rank(b));
  if (!results.length) return { ok: false, message: `No openly licensed photo found for "${input.query}". Try simpler words (e.g. "fresh vegetables market"), or draw an inline SVG illustration.`, paths: [] };

  const rejected: string[] = [];
  for (const r of results.slice(0, check ? 8 : 5)) {
    if (check) {
      const preview = (r.thumbnail ? await download(r.thumbnail, signal).catch(() => undefined) : undefined) ?? (await download(r.url, signal).catch(() => undefined));
      if (!preview) continue;
      const verdict = preview.bytes.length > 3_500_000 ? { ok: true, reason: "" } : await check(preview.bytes, input.query).catch(() => ({ ok: true, reason: "" }));
      if (!verdict.ok) {
        rejected.push(`"${r.title ?? "untitled"}" (${verdict.reason.slice(0, 80)})`);
        continue;
      }
    }
    // The full picture when it's a reasonable size, else Openverse's own smaller copy.
    const got = (await download(r.url, signal).catch(() => undefined)) ?? (r.thumbnail ? await download(r.thumbnail, signal).catch(() => undefined) : undefined);
    if (!got) continue;
    const dir = jail.resolve("public/images").abs;
    fs.mkdirSync(dir, { recursive: true });
    const base = slugOf(input.name || input.query);
    let file = `${base}.${EXT[got.type]}`;
    for (let n = 2; fs.existsSync(path.join(dir, file)); n++) file = `${base}-${n}.${EXT[got.type]}`;
    fs.writeFileSync(path.join(dir, file), got.bytes);
    const rel = `public/images/${file}`;

    const license = r.license === "cc0" ? "CC0" : r.license === "pdm" ? "Public domain" : `CC ${r.license.toUpperCase()}${r.license_version ? ` ${r.license_version}` : ""}`;
    const credit: ImageCredit = { file: `/images/${file}`, title: r.title ?? input.query, creator: r.creator ?? "Unknown", license, licenseUrl: r.license_url ?? "", source: r.foreign_landing_url ?? r.url };
    const creditsAbs = jail.resolve(CREDITS).abs;
    let credits: ImageCredit[] = [];
    try {
      credits = JSON.parse(fs.readFileSync(creditsAbs, "utf8")) as ImageCredit[];
    } catch {
      /* first image */
    }
    fs.mkdirSync(path.dirname(creditsAbs), { recursive: true });
    fs.writeFileSync(creditsAbs, `${JSON.stringify([...credits.filter((c) => c.file !== credit.file), credit], null, 2)}\n`);

    const mustCredit = r.license !== "cc0" && r.license !== "pdm";
    return {
      ok: true,
      paths: [rel, CREDITS],
      message: `Saved ${rel} (${r.width}×${r.height}, ${license}: "${credit.title}" by ${credit.creator}). Use it as "/images/${file}" (e.g. <img src="/images/${file}" alt="…" loading="lazy">, or a CSS background), with real alt text and object-fit: cover. The credit is in ${CREDITS}${mustCredit ? "; this licence requires showing it, so list the credits in the app's about screen or footer" : ""}.`,
    };
  }
  if (rejected.length) return { ok: false, message: `None of the photos found for "${input.query}" actually showed it (${rejected.slice(0, 3).join("; ")}). Search for the thing itself in plain words ("bowl of oat cereal", "glass of milk", "loaf of bread"), not a brand name, or draw an inline SVG illustration.`, paths: [] };
  return { ok: false, message: `Found photos for "${input.query}" but couldn't download one. Try different words, or use an inline SVG illustration.`, paths: [] };
}
