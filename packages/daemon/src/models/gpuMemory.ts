/**
 * How big a context a coding step can be given, from the graphics memory the machine actually has.
 *
 * The window is held in graphics memory, not system RAM, but the rule that granted it used to ask for 24 GB of system
 * RAM. On a machine with 31 GB of RAM and an 8 GB card that gave qwen3:14b a 32k window: 15.0 GB in all, of which only
 * 6.0 GB fitted on the card, so Ollama ran the other 9 GB on the CPU and the model wrote 7.5 tokens a second instead
 * of the 53 it manages when it fits.
 *
 * Shrinking the window is not a free fix, so it has a floor. Ollama keeps room for the reply inside the window and
 * silently drops the rest of the prompt: measured here, an 18,037-token prompt sent with an 8k window was cut to 4,098
 * tokens and the model never saw the start of its instructions. A step whose prompt is cut is worse than a step that
 * runs partly on the CPU, so a model that cannot hold the floor keeps it anyway and takes the slower split.
 */
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const run = promisify(execFile);

/**
 * Bytes of key/value cache per token of context, measured on an 8 GB card: qwen3:8b grew 1.6 GB between an 8k and a
 * 16k window (195 KB/token) and qwen3:14b grew 2.0 GB between 24k and 32k (244 KB/token). Bigger models cost more per
 * token, so the higher figure is used.
 */
const KV_BYTES_PER_TOKEN = 250_000;

/** Windows a coding step may be given, largest first. */
const SIZES = [32_768, 24_576] as const;

/** The smallest window that still holds the prompts coding steps send (the largest seen is about 23,000 tokens). */
export const CONTEXT_FLOOR = 24_576;

let cached: number | undefined | null = null;

/** Total graphics memory in bytes, or undefined when it cannot be read (no NVIDIA tools, or another kind of card). */
export async function totalVramBytes(): Promise<number | undefined> {
  if (cached !== null) return cached ?? undefined;
  try {
    const { stdout } = await run("nvidia-smi", ["--query-gpu=memory.total", "--format=csv,noheader,nounits"], { timeout: 5000 });
    const mib = stdout
      .split("\n")
      .map((l) => Number(l.trim()))
      .filter((n) => Number.isFinite(n) && n > 0);
    cached = mib.length ? Math.max(...mib) * 1024 * 1024 : undefined;
  } catch {
    cached = undefined;
  }
  return cached ?? undefined;
}

/**
 * The context a coding step should ask for: the largest window the card can hold the model with, never below the floor
 * that keeps its prompt whole. Returns undefined when the model's size is unknown, so the caller leaves the context
 * alone rather than guessing.
 */
export async function contextForCoding(modelSizeBytes: number | undefined): Promise<number | undefined> {
  if (!modelSizeBytes) return undefined;
  const vram = await totalVramBytes();
  if (!vram) return CONTEXT_FLOOR;
  return SIZES.find((tokens) => modelSizeBytes + tokens * KV_BYTES_PER_TOKEN <= vram) ?? CONTEXT_FLOOR;
}

/** Test seam: forget the reading taken from the machine. */
export function forgetVram(): void {
  cached = null;
}
