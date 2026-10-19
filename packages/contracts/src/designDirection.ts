/**
 * Turning a person's words about the look into the Look's own settings, and keeping the parts they locked.
 *
 * The reading is a fixed, inspectable vocabulary (no model): each phrase it recognises says which setting it changed
 * and why, a phrase about layout or composition is marked as work for the design build step (tokens can't do it), and
 * whatever it doesn't recognise is listed back unread. Locked groups are never changed by it.
 */
import { BUNDLED_FONTS } from "./fonts.js";
import { BASE_APPEARANCE, TYPE_PAIRS, type Appearance } from "./appearance.js";
import { normalizeHex } from "./palette.js";

/** What a person can lock: groups of the Look's settings that change together. */
export const LOOK_GROUPS = [
  { id: "colors", label: "Colours", fields: ["primary", "neutral", "secondary", "tertiary", "status", "gradient", "mode", "theme"] },
  { id: "type", label: "Typography", fields: ["fonts", "typeScale"] },
  { id: "shape", label: "Shape and density", fields: ["shape"] },
  { id: "surface", label: "Surface", fields: ["surface"] },
  { id: "motion", label: "Motion", fields: ["motion"] },
] as const satisfies ReadonlyArray<{ id: string; label: string; fields: ReadonlyArray<keyof Appearance> }>;
export type LookGroup = (typeof LOOK_GROUPS)[number]["id"];
export const LOOK_GROUP_IDS = LOOK_GROUPS.map((g) => g.id) as LookGroup[];

/** `next` with every locked group's settings taken from `keep` (the approved direction), so a lock always holds. */
export function withLocks(next: Appearance, keep: Appearance | undefined, locks: readonly string[]): Appearance {
  if (!keep || !locks.length) return next;
  const out: Record<string, unknown> = { ...next };
  for (const g of LOOK_GROUPS) {
    if (!locks.includes(g.id)) continue;
    for (const f of g.fields) {
      const v = (keep as unknown as Record<string, unknown>)[f];
      if (v === undefined) delete out[f];
      else out[f] = v;
    }
  }
  return out as unknown as Appearance;
}

/** The locked groups whose settings differ between two directions (what a change would break). */
export function lockedChanges(next: Appearance, keep: Appearance | undefined, locks: readonly string[]): LookGroup[] {
  if (!keep) return [];
  return LOOK_GROUPS.filter((g) => locks.includes(g.id) && g.fields.some((f) => JSON.stringify((next as unknown as Record<string, unknown>)[f] ?? null) !== JSON.stringify((keep as unknown as Record<string, unknown>)[f] ?? null))).map((g) => g.id);
}

export interface Understood {
  /** The words in the person's direction. */
  words: string;
  /** What changed, in plain words. */
  change: string;
  group: LookGroup | "build";
  /** True when a lock kept it from changing. */
  locked?: boolean;
  /** False for a phrase that is read but changes nothing (it matches what the Look already does). */
  changed?: boolean;
}
export interface DirectionReading {
  appearance: Appearance;
  understood: Understood[];
  /** Parts of the direction FlowCode's vocabulary doesn't cover: shown back, never silently dropped. */
  unread: string[];
}

// Named colours a person might ask for, with a muted variant where the plain one is loud.
const COLOURS: Array<{ re: RegExp; name: string; hex: string; muted: string }> = [
  { re: /\bcobalt\b/, name: "cobalt", hex: "#0047ab", muted: "#3d5a99" },
  { re: /\bnavy\b/, name: "navy", hex: "#1f3a68", muted: "#33476b" },
  { re: /\bteal\b/, name: "teal", hex: "#127a74", muted: "#3f7d78" },
  { re: /\b(forest|green)\b/, name: "green", hex: "#2f6b45", muted: "#4d6f58" },
  { re: /\bsage\b/, name: "sage", hex: "#6f8f6a", muted: "#6f8a6b" },
  { re: /\bterracotta\b/, name: "terracotta", hex: "#b5583a", muted: "#a2644d" },
  { re: /\brust\b/, name: "rust", hex: "#a4472a", muted: "#955640" },
  { re: /\bcoral\b/, name: "coral", hex: "#e2614a", muted: "#c97a6a" },
  { re: /\bplum\b/, name: "plum", hex: "#6b3a6b", muted: "#6e5070" },
  { re: /\b(purple|violet)\b/, name: "violet", hex: "#6b4bc4", muted: "#6e62a8" },
  { re: /\b(burgundy|wine)\b/, name: "burgundy", hex: "#7a2338", muted: "#74404c" },
  { re: /\b(ochre|mustard|gold)\b/, name: "ochre", hex: "#b8860b", muted: "#a38945" },
  { re: /\borange\b/, name: "orange", hex: "#d9661f", muted: "#c27a4a" },
  { re: /\bred\b/, name: "red", hex: "#c0392b", muted: "#a85048" },
  { re: /\bpink\b/, name: "pink", hex: "#c2457a", muted: "#b06a88" },
  { re: /\bblue\b/, name: "blue", hex: "#2f5bd3", muted: "#4a65a8" },
];
const pair = (id: string) => TYPE_PAIRS.find((p) => p.id === id)!;
const TYPE_WORDS: Array<{ re: RegExp; pair: string }> = [
  { re: /\b(editorial|magazine|high[- ]contrast serif)\b/, pair: "playfair-source" },
  { re: /\b(bookish|literary|for reading)\b/, pair: "literata" },
  { re: /\bhumanist\b|\bwarm serif\b/, pair: "fraunces-work" },
  { re: /\b(serif|classic|elegant)\b/, pair: "source-serif-inter" },
  { re: /\bcondensed\b|\bpunchy\b/, pair: "oswald-dm" },
  { re: /\bgeometric\b/, pair: "montserrat-source" },
  { re: /\b(rounded type|soft type|playful type)\b/, pair: "quicksand" },
  { re: /\bfriendly\b/, pair: "dm-sans" },
  { re: /\b(clean|neutral|minimal) (sans|type)\b/, pair: "inter" },
];
const BUILD_WORDS = /\b(photo(graph)?y?[- ]led|photo[- ]first|image[- ]led|grid|layout|composition|hero|contact sheet|columns?|masonry|cards?|imagery|illustrations?|icons?|chrome|photography|(phone|mobile|tablet|desktop) width|responsive)\b/;

/** Reads a direction into the Look, starting from `from` and leaving every locked group as it is. */
export function interpretDirection(text: string, from: Appearance = BASE_APPEARANCE, locks: readonly string[] = []): DirectionReading {
  const understood: Understood[] = [];
  const unread: string[] = [];
  let a: Appearance = { ...from };
  const locked = (g: LookGroup) => locks.includes(g);
  const note = (words: string, group: LookGroup | "build", change: string, apply?: () => void) => {
    const isLocked = group !== "build" && locked(group);
    understood.push({ words, group, change: isLocked ? `kept as it is (${LOOK_GROUPS.find((x) => x.id === group)!.label.toLowerCase()} are locked)` : change, ...(isLocked ? { locked: true } : {}), ...(!apply && group !== "build" && !isLocked ? { changed: false } : {}) });
    if (!isLocked) apply?.();
  };
  // Whole lines first: a numbered item is the order of a screen's sections, and "Avoid …" lists what to leave out; both
  // are the design build step's to follow, read as one note each (not as separate words to match).
  const clauses: Array<{ raw: string; build?: string }> = [];
  for (const line of text.split(/\n+/).map((l) => l.trim()).filter(Boolean)) {
    const item = /^\d+[.)]\s+(.+)$/.exec(line);
    if (item) clauses.push({ raw: item[1]!.replace(/\.$/, ""), build: "a section of the screen, in this order: the design build step lays it out" });
    else if (/^(avoid|no|without|don't|do not|never)\b/i.test(line)) clauses.push({ raw: line.replace(/\.$/, ""), build: "left out of the screens: the design build step follows this" });
    else clauses.push(...line.split(/[;.]+|,(?![^(]*\))/).map((c) => ({ raw: c.trim() })).filter((c) => c.raw && !/^\d+$/.test(c.raw)));
  }
  for (const { raw, build } of clauses) {
    if (build) {
      note(raw, "build", build);
      continue;
    }
    const c = raw.toLowerCase();
    const before = understood.length;
    // Light or dark, and the neutral family.
    if (/\bdark (mode|background|theme|ui)\b|\bnight mode\b/.test(c)) note(raw, "colors", "dark mode", () => (a = { ...a, mode: "dark" }));
    else if (/\b(off[- ]white|cream|ivory|paper|light (mode|background)|white background)\b/.test(c)) note(raw, "colors", "light mode", () => (a = { ...a, mode: "light" }));
    if (/\b(warm|cream|ivory|paper|sand|linen|beige)\b/.test(c) && !/\bwarm serif\b/.test(c) && !COLOURS.some((k) => k.re.test(c))) note(raw, "colors", "warm neutral family (off-white backgrounds, warm greys)", () => (a = { ...a, neutral: "warm" }));
    else if (/\b(cool|slate|blue[- ]gr[ae]y)\b/.test(c) && !COLOURS.some((k) => k.re.test(c))) note(raw, "colors", "cool neutral family", () => (a = { ...a, neutral: "cool" }));
    else if (/\b(pure gr[ae]y|neutral gr[ae]y|monochrome)\b/.test(c)) note(raw, "colors", "pure grey neutral family", () => (a = { ...a, neutral: "pure" }));
    if (/\b(near[- ]black|charcoal|black) text\b/.test(c)) note(raw, "colors", "text stays near-black (the neutral family's darkest step)");
    // The accent: a hex, or a named colour (muted when asked).
    const hex = /#[0-9a-f]{6}\b/i.exec(raw)?.[0];
    const named = COLOURS.find((k) => k.re.test(c));
    if (hex && normalizeHex(hex)) note(raw, "colors", `primary colour ${hex.toLowerCase()}`, () => (a = { ...a, primary: normalizeHex(hex)! }));
    else if (named && !/\btext\b/.test(c)) {
      const muted = /\b(muted|dusty|soft|desaturated|subdued)\b/.test(c);
      const value = muted ? named.muted : named.hex;
      note(raw, "colors", `primary colour ${muted ? "muted " : ""}${named.name} (${value})`, () => (a = { ...a, primary: value }));
    }
    // Typography: a named bundled font, else a described style.
    const font = BUNDLED_FONTS.find((f) => f.kind !== "mono" && c.includes(f.family.toLowerCase()));
    if (font) note(raw, "type", `headings in ${font.family}`, () => (a = { ...a, fonts: { ...a.fonts, display: font.family } }));
    else {
      const t = TYPE_WORDS.find((w) => w.re.test(c));
      if (t) note(raw, "type", `${pair(t.pair).label} (${pair(t.pair).mood.toLowerCase()})`, () => (a = { ...a, fonts: { display: pair(t.pair).display, body: pair(t.pair).body } }));
    }
    const scale = a.typeScale ?? { base: 16, ratio: 1.2 };
    if (/\b(large|big) (text|type)\b/.test(c)) note(raw, "type", "larger body text (18px)", () => (a = { ...a, typeScale: { ...scale, base: 18 } }));
    if (/\b(small|compact) (text|type)\b/.test(c)) note(raw, "type", "smaller body text (15px)", () => (a = { ...a, typeScale: { ...scale, base: 15 } }));
    if (/\bdramatic headings?\b/.test(c)) note(raw, "type", "dramatic heading sizes", () => (a = { ...a, typeScale: { ...(a.typeScale ?? scale), ratio: 1.5 } }));
    else if (/\b(clear|strong) (typographic )?hierarchy\b/.test(c)) note(raw, "type", "clear heading steps (1.25)", () => (a = { ...a, typeScale: { ...(a.typeScale ?? scale), ratio: 1.25 } }));
    else if (/\b(calm|understated|quiet) headings?\b/.test(c)) note(raw, "type", "calm heading steps (1.125)", () => (a = { ...a, typeScale: { ...(a.typeScale ?? scale), ratio: 1.125 } }));
    // Shape: corners, density, borders.
    const shape = a.shape ?? { radius: 10, density: "comfortable" as const, borders: "fine" as const };
    if (/\b(square|sharp|no round(ing|ed)?)\b/.test(c)) note(raw, "shape", "square corners (0px)", () => (a = { ...a, shape: { ...(a.shape ?? shape), radius: 0 } }));
    else if (/\b(restrained|subtle|slight|small) (corner )?(round(ing|ed)?|corners?)\b|\brestrained corner/.test(c)) note(raw, "shape", "restrained corners (6px)", () => (a = { ...a, shape: { ...(a.shape ?? shape), radius: 6 } }));
    else if (/\b(very rounded|pill|bubbly)\b/.test(c)) note(raw, "shape", "very rounded corners (24px)", () => (a = { ...a, shape: { ...(a.shape ?? shape), radius: 24 } }));
    else if (/\b(rounded|soft) corners?\b/.test(c)) note(raw, "shape", "rounded corners (14px)", () => (a = { ...a, shape: { ...(a.shape ?? shape), radius: 14 } }));
    if (/\b(compact|dense|tight) (layout|spacing|density|ui|interface|design|rows|lists?)\b|^(compact|dense|tight)( and (compact|dense|tight))?$/.test(c)) note(raw, "shape", "compact density", () => (a = { ...a, shape: { ...(a.shape ?? shape), density: "compact" } }));
    else if (/\b(airy|spacious|roomy|generous (white ?space|spacing))\b/.test(c)) note(raw, "shape", "spacious density", () => (a = { ...a, shape: { ...(a.shape ?? shape), density: "spacious" } }));
    if (/\b(fine|thin|hairline|delicate) (borders?|lines?|rules?)\b/.test(c)) note(raw, "shape", "fine 1px borders", () => (a = { ...a, shape: { ...(a.shape ?? shape), borders: "fine" } }));
    else if (/\b(bold|thick|strong|heavy) (borders?|lines?|outlines?)\b/.test(c)) note(raw, "shape", "strong 2px borders", () => (a = { ...a, shape: { ...(a.shape ?? shape), borders: "strong" } }));
    // Surface and motion.
    if (/\bflat\b/.test(c)) note(raw, "surface", "flat surfaces", () => (a = { ...a, surface: "flat" }));
    else if (/\b(tactile|skeuomorph\w*|physical depth)\b/.test(c)) note(raw, "surface", "tactile surfaces", () => (a = { ...a, surface: "skeuomorphism" }));
    const effectsOff = /\b(expressive|fancy) effects? (off|none)\b|\bno expressive\b/.test(c);
    if (/\b(no (motion|animation)|still|static)\b/.test(c)) note(raw, "motion", "minimal motion", () => (a = { ...a, motion: { ...a.motion, level: "minimal" } }));
    else if (/\b(lively|playful|animated)\b|\bexpressive motion\b/.test(c) && !effectsOff) note(raw, "motion", "expressive motion (expressive effects still need their own opt-in)", () => (a = { ...a, motion: { ...a.motion, level: "expressive" } }));
    else if (/\b(balanced|functional|calm|subtle|restrained) motion\b/.test(c)) note(raw, "motion", "balanced motion", () => (a = { ...a, motion: { ...a.motion, level: "balanced" } }));
    if (effectsOff) note(raw, "motion", "expressive effects stay off");
    if (/\b(no font package|available fonts|bundled fonts)\b/.test(c)) note(raw, "type", "only FlowCode's bundled, licensed fonts (no font package added)");
    // Layout and composition: real, but made by the design build step, not by tokens.
    if (BUILD_WORDS.test(c)) note(raw, "build", "layout and composition: the design build step builds this (tokens can't)");
    if (understood.length === before) unread.push(raw);
  }
  return { appearance: a, understood, unread };
}
