/**
 * The owner's list of external component sources (contracts externalSources.ts): kept in the store, started from the
 * checked defaults. Only sources the owner has marked "allowed" reach an agent, as places to adapt from (rewritten in
 * FlowCode's code, notice kept), never to copy; "inspiration" ones only as references for the look.
 */
import { DEFAULT_EXTERNAL_SOURCES, type ExternalLicense, type ExternalSource } from "@flowcode/contracts";
import type { Store } from "../db/store.js";

const KEY = "externalSources";

export function externalSources(store: Store): ExternalSource[] {
  const saved = store.getSetting<ExternalSource[] | null>(KEY, null);
  return saved ?? DEFAULT_EXTERNAL_SOURCES;
}

const save = (store: Store, list: ExternalSource[]) => store.setSetting(KEY, list);

/** A link the owner adds: its license is unknown until they set it. */
export function addExternalSource(store: Store, input: { name: string; url: string; terms?: string; use?: string }): ExternalSource[] {
  const url = input.url.trim();
  if (!/^https?:\/\/[^\s]+\.[^\s]+/i.test(url)) throw new Error("Use a web address that starts with https://");
  const list = externalSources(store);
  const host = new URL(url).host.replace(/^www\./, "");
  if (list.some((s) => new URL(s.url).host.replace(/^www\./, "") === host && s.url.replace(/\/$/, "") === url.replace(/\/$/, ""))) throw new Error("That link is already on the list.");
  const id = `${host.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}-${Date.now().toString(36)}`;
  const source: ExternalSource = { id, name: input.name.trim() || host, url, license: "check", terms: input.terms?.trim() || "Not checked yet", use: input.use?.trim() || "", addedBy: "you", addedAt: new Date().toISOString().slice(0, 10) };
  save(store, [source, ...list]);
  return externalSources(store);
}

export function updateExternalSource(store: Store, id: string, patch: { license?: ExternalLicense; terms?: string; use?: string; name?: string }): ExternalSource[] {
  const list = externalSources(store);
  if (!list.some((s) => s.id === id)) throw new Error("That source isn't on the list.");
  save(store, list.map((s) => (s.id === id ? { ...s, ...Object.fromEntries(Object.entries(patch).filter(([, v]) => v !== undefined)) } : s)));
  return externalSources(store);
}

export function removeExternalSource(store: Store, id: string): ExternalSource[] {
  save(store, externalSources(store).filter((s) => s.id !== id));
  return externalSources(store);
}

/** What an agent is told: the allowed sources to adapt from, and the look-only references. Empty when there are none. */
export function externalSourcesNote(store: Store): string {
  const list = externalSources(store);
  const allowed = list.filter((s) => s.license === "allowed");
  const look = list.filter((s) => s.license === "inspiration");
  if (!allowed.length && !look.length) return "";
  return [
    allowed.length ? `Outside component sources the owner allows (adapt their structure and ideas, rewritten in FlowCode's own components and tokens; never copy code or markup): ${allowed.map((s) => `${s.name} (${s.terms}): ${s.use}`).join("; ")}.` : "",
    look.length ? `For the look only (nothing copied or rewritten): ${look.map((s) => s.name).join(", ")}.` : "",
    "Any other component site is off limits.",
  ]
    .filter(Boolean)
    .join(" ");
}
