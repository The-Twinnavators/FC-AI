/** Typed client for the local daemon (§15). Connection details come from the Electron preload or the URL. */
import { useEffect, useRef, useState } from "react";
import type { FlowEvent } from "@flowcode/contracts";

interface Bridge {
  port: number;
  token: string;
  selectFolder?: () => Promise<string | null>;
  platform?: string;
}

declare global {
  interface Window {
    flowcode?: Bridge;
  }
}

function connection(): { base: string; token: string } {
  if (window.flowcode) return { base: `http://127.0.0.1:${window.flowcode.port}`, token: window.flowcode.token };
  const q = new URLSearchParams(location.search);
  const port = q.get("port") ?? localStorage.getItem("fc.port") ?? "";
  const token = q.get("token") ?? localStorage.getItem("fc.token") ?? "";
  if (q.get("port")) {
    try {
      localStorage.setItem("fc.port", port);
      localStorage.setItem("fc.token", token);
    } catch {
      /* storage unavailable */
    }
  }
  return { base: `http://127.0.0.1:${port}`, token };
}

export const conn = connection();

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

export async function api<T = unknown>(method: "GET" | "POST", path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${conn.base}${path}`, {
    method,
    headers: { authorization: `Bearer ${conn.token}`, ...(body !== undefined ? { "content-type": "application/json" } : {}) },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) throw new ApiError(res.status, (data as { error?: string } | null)?.error ?? `HTTP ${res.status}`);
  return data as T;
}

export const get = <T,>(p: string) => api<T>("GET", p);
export const post = <T,>(p: string, b: unknown = {}) => api<T>("POST", p, b);

export function artifactUrl(id: string): string {
  return `${conn.base}/artifacts/${id}?token=${encodeURIComponent(conn.token)}`;
}

/** Polls a GET endpoint; `deps` re-trigger; `refreshOn` re-fetches when a matching event arrives. */
export function useResource<T>(path: string | null, deps: unknown[] = [], intervalMs = 0): { data: T | undefined; error: string | undefined; reload: () => void; loading: boolean } {
  const [data, setData] = useState<T>();
  const [error, setError] = useState<string>();
  const [loading, setLoading] = useState(false);
  const [tick, setTick] = useState(0);
  // What's being asked for: a refresh of the same thing must not throw away an answer still on its way (a slow
  // endpoint polled faster than it answers would otherwise never show anything). Only a change of path or deps does.
  const key = JSON.stringify([path, ...deps]);
  const keyRef = useRef(key);
  keyRef.current = key;
  const inFlight = useRef<string | null>(null);
  useEffect(() => {
    if (!path) return;
    if (inFlight.current === key) return; // still waiting for the last answer to this same request
    inFlight.current = key;
    setLoading(true);
    get<T>(path)
      .then((d) => {
        if (keyRef.current === key) {
          setData(d);
          setError(undefined);
        }
      })
      .catch((e: Error) => keyRef.current === key && setError(e.message))
      .finally(() => {
        if (inFlight.current === key) inFlight.current = null;
        if (keyRef.current === key) setLoading(false);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, tick, ...deps]);
  useEffect(() => {
    if (!intervalMs || !path) return;
    const t = setInterval(() => setTick((x) => x + 1), intervalMs);
    return () => clearInterval(t);
  }, [intervalMs, path]);
  return { data, error, loading, reload: () => setTick((x) => x + 1) };
}

/** Server-sent event stream with automatic resume via Last-Event-ID (the browser handles reconnects). */
export function useEventStream(path: string | null, onEvent?: (e: FlowEvent) => void, max = 4000): FlowEvent[] {
  const [events, setEvents] = useState<FlowEvent[]>([]);
  const cb = useRef(onEvent);
  cb.current = onEvent;
  useEffect(() => {
    setEvents([]);
    if (!path) return;
    const sep = path.includes("?") ? "&" : "?";
    const es = new EventSource(`${conn.base}${path}${sep}token=${encodeURIComponent(conn.token)}`);
    let buffer: FlowEvent[] = [];
    let raf = 0;
    const flush = () => {
      raf = 0;
      const batch = buffer;
      buffer = [];
      setEvents((prev) => {
        const next = prev.concat(batch);
        return next.length > max ? next.slice(next.length - max) : next;
      });
    };
    es.addEventListener("flow", (m) => {
      const e = JSON.parse((m as MessageEvent).data) as FlowEvent;
      buffer.push(e);
      cb.current?.(e);
      if (!raf) raf = requestAnimationFrame(flush);
    });
    return () => {
      es.close();
      if (raf) cancelAnimationFrame(raf);
    };
  }, [path, max]);
  return events;
}
