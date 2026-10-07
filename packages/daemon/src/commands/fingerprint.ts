/**
 * Error fingerprints (FR-C4). Normalizes failure output so the "same" failure produces the same
 * fingerprint across attempts regardless of paths, line numbers, timings, hashes or ports.
 */
import { sha256 } from "../util/ids.js";

const ERROR_LINE = /(error|err!|failed|failure|exception|cannot|could not|not found|unexpected|expected|TS\d{4}|✗|×|fatal|denied|undefined is not|is not a function|missing)/i;

export function normalizeErrorText(output: string): string[] {
  return output
    .split(/\r?\n/)
    .filter((l) => ERROR_LINE.test(l))
    .map((l) =>
      l
        .replace(/\x1b\[[0-9;]*m/g, "")
        .replace(/[a-zA-Z]:\\[^\s:'"]+|\/[^\s:'"]+\/[^\s:'"]+/g, "<path>")
        .replace(/\b0x[0-9a-f]+\b/gi, "<hex>")
        .replace(/\b[0-9a-f]{7,64}\b/gi, "<hash>")
        .replace(/\d{4}-\d{2}-\d{2}[T ][\d:.]+Z?/g, "<time>")
        .replace(/\(\d+,\d+\)|:\d+:\d+|:\d+\b/g, ":<loc>")
        .replace(/\b\d+(\.\d+)?\s?(ms|s|kb|mb|b)\b/gi, "<n><unit>")
        .replace(/\b\d+\b/g, "<n>")
        .replace(/\s+/g, " ")
        .trim(),
    )
    .filter(Boolean)
    .slice(0, 12);
}

export function errorFingerprint(argv: string[], exitCode: number | undefined, output: string, status: string): string {
  const lines = normalizeErrorText(output);
  const basis = [argv.join(" "), status, String(exitCode ?? ""), ...lines].join("\n");
  return `fp_${sha256(basis).slice(0, 16)}`;
}
