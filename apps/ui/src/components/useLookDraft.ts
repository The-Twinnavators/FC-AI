/**
 * A project's look as a draft, saved as you go: the same record and endpoints as the Look editor and the Design
 * direction page (workspace/designState.ts). Draft, selected and applied stay apart; locked groups don't change, here
 * or on the server; a description in words is read with interpretDirection (what it understood, what it couldn't).
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { BASE_APPEARANCE, interpretDirection, type Appearance, type DirectionReading, type LookGroup } from "@flowcode/contracts";
import { post, useResource } from "../api";

type Sources = Partial<Record<keyof Appearance, string>>;
export interface LookState {
  label: string;
  draft?: { appearance: Appearance; sources: Sources; updatedAt: string; notes?: string[] };
  selected?: { appearance: Appearance; sources: Sources; version: number; notes?: string[] };
  applied?: { appearance: Appearance; version: number };
  hasApp: boolean;
  locks: string[];
  versions: Array<{ version: number; appearance: Appearance; selectedAt: string }>;
  prd?: { colors: Array<{ hex: string; name: string }>; direction?: string };
}
export type SaveState = "idle" | "saving" | "saved" | "error";

export function useLookDraft(projectId: string) {
  const res = useResource<LookState>(`/projects/${projectId}/design/state`, [projectId]);
  const s = res.data;
  const [a, setA] = useState<Appearance>();
  const [sources, setSources] = useState<Sources>({});
  const [saving, setSaving] = useState<SaveState>("idle");
  const [error, setError] = useState<string>();
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const notes = useRef<string[]>([]);
  // Undo: the looks before each edit, this session.
  const [history, setHistory] = useState<Appearance[]>([]);

  // Start once from the draft, else the selected or applied direction, else the PRD's colour on FlowCode's base.
  const inited = useRef(false);
  useEffect(() => {
    if (!s || inited.current) return;
    inited.current = true;
    setA(s.draft?.appearance ?? s.selected?.appearance ?? s.applied?.appearance ?? (s.prd?.colors[0] ? { ...BASE_APPEARANCE, primary: s.prd.colors[0].hex } : BASE_APPEARANCE));
    setSources(s.draft?.sources ?? s.selected?.sources ?? {});
    notes.current = s.draft?.notes ?? s.selected?.notes ?? [];
  }, [s]);

  const save = useCallback(
    (next: Appearance, nextSources: Sources) => {
      setSaving("saving");
      setError(undefined);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        timer.current = undefined;
        post(`/projects/${projectId}/design/draft`, { appearance: next, sources: nextSources, notes: notes.current })
          .then(() => setSaving("saved"))
          .catch((e: Error) => (setSaving("error"), setError(e.message)));
      }, 350);
    },
    [projectId],
  );

  const locks = (s?.locks ?? []) as LookGroup[];
  const edit = (patch: Partial<Appearance>, source = "you") => {
    const cur = a ?? BASE_APPEARANCE;
    const next = { ...cur, ...patch };
    const nextSources = { ...sources, ...Object.fromEntries(Object.keys(patch).map((k) => [k, source])) };
    setHistory((h) => [...h.slice(-29), cur]);
    setA(next);
    setSources(nextSources);
    save(next, nextSources);
  };
  const undo = () => {
    const prev = history[history.length - 1];
    if (!prev) return;
    setHistory((h) => h.slice(0, -1));
    setA(prev);
    save(prev, sources);
  };
  /** Words → changes. Returns the reading so the page can show what was understood and what wasn't. */
  const read = (text: string): DirectionReading => {
    const r = interpretDirection(text, a ?? BASE_APPEARANCE, locks);
    // Phrases only a build can make (layout, imagery) are kept with the draft for the build.
    notes.current = [...new Set([...notes.current, ...r.understood.filter((u) => u.group === "build").map((u) => u.words)])];
    if (r.understood.some((u) => u.group !== "build" && !u.locked)) edit(r.appearance, "direction");
    else if (a) save(a, sources);
    return r;
  };
  const toggleLock = async (g: LookGroup) => {
    await post(`/projects/${projectId}/design/locks`, { locks: locks.includes(g) ? locks.filter((x) => x !== g) : [...locks, g] });
    res.reload();
  };
  /** Saves now and makes the draft the selected direction (what the build applies). */
  const select = async () => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = undefined;
      await post(`/projects/${projectId}/design/draft`, { appearance: a, sources, notes: notes.current });
    }
    await post(`/projects/${projectId}/design/select`, {});
  };
  return { state: s, error: error ?? res.error, appearance: a, sources, saving, locks, edit, undo, canUndo: history.length > 0, read, toggleLock, select };
}
