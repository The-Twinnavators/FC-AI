/**
 * One local inference request at a time, across the whole app (the 8GB GPU profile). Two builds, or a build and a
 * support role, asking an 8 GB card for different models at once made each swap the other out (Clean Cart and its
 * controlled build ran side by side for an hour). Every Ollama chat and embedding waits its turn here; the ones that
 * wait are announced, with what they wait behind. Nothing is cancelled. Work that doesn't use the model runs freely.
 */
export interface GateWaiter {
  label: string;
  resolve: () => void;
}

let enabled: () => boolean = () => false;
export type GateMeta = { runId?: string; projectId?: string; taskId?: string };
let onQueued: (label: string, behind: string, position: number, meta: GateMeta) => void = () => {};
let holder: string | undefined;
const queue: GateWaiter[] = [];

/** Whether the gate applies (read on every request, so a settings change takes effect on the next one). */
export function setGpuGatePolicy(policy: () => boolean, announce?: (label: string, behind: string, position: number, meta: GateMeta) => void) {
  enabled = policy;
  if (announce) onQueued = announce;
}

/** The request now on the GPU, and how many wait (for the activity view and tests). */
export function gpuGateState(): { holder?: string; waiting: string[] } {
  return { ...(holder ? { holder } : {}), waiting: queue.map((w) => w.label) };
}

/** Waits for the GPU, then returns the release. A request cancelled while it waits leaves the queue. */
export async function acquireGpu(label: string, signal?: AbortSignal, meta: GateMeta = {}): Promise<() => void> {
  if (!enabled()) return () => {};
  if (holder === undefined) {
    holder = label;
    return release(label);
  }
  await new Promise<void>((resolve, reject) => {
    const w: GateWaiter = { label, resolve };
    queue.push(w);
    onQueued(label, holder ?? "another request", queue.length, meta);
    signal?.addEventListener(
      "abort",
      () => {
        const i = queue.indexOf(w);
        if (i >= 0) queue.splice(i, 1);
        reject(signal.reason ?? new Error("cancelled"));
      },
      { once: true },
    );
  });
  holder = label;
  return release(label);
}

function release(label: string): () => void {
  let done = false;
  return () => {
    if (done) return;
    done = true;
    const next = queue.shift();
    if (next) {
      holder = next.label;
      next.resolve();
    } else if (holder === label) holder = undefined;
  };
}
