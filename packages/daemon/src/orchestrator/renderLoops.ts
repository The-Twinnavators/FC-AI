/**
 * Endless re-render loops in React components: an effect that sets, without a condition, state its own dependency list
 * includes, or that depends on a value rebuilt on every render. The screen then renders forever, the browser tab
 * freezes and every test run hangs until FlowCode's time limit (No BIO & GMO build: a sort effect depended on
 * filteredBrands and set filteredBrands, and each test run sat for five minutes with no clue why).
 */

export interface RenderLoop {
  line: number;
  message: string;
  /** "blocking": the effect sets, every time it runs and with no condition, state it depends on (shown by the source
   * alone). "suspicious": it may, under a condition that doesn't read that state or from a function inside it. */
  severity: "blocking" | "suspicious";
}

/** The index of the bracket that closes the one at `open` (skips strings, template literals and comments roughly). */
function closing(src: string, open: number): number {
  const pairs: Record<string, string> = { "(": ")", "[": "]", "{": "}" };
  const stack: string[] = [];
  for (let i = open; i < src.length; i++) {
    const ch = src[i];
    if (ch === '"' || ch === "'" || ch === "`") {
      const q = ch;
      for (i++; i < src.length && src[i] !== q; i++) if (src[i] === "\\") i++;
      continue;
    }
    if (ch === "/" && src[i + 1] === "/") {
      i = src.indexOf("\n", i);
      if (i < 0) return -1;
      continue;
    }
    if (ch === "/" && src[i + 1] === "*") {
      i = src.indexOf("*/", i + 2) + 1;
      if (i <= 0) return -1;
      continue;
    }
    if (pairs[ch]) stack.push(pairs[ch]);
    else if (ch === ")" || ch === "]" || ch === "}") {
      if (stack.pop() !== ch) return -1;
      if (!stack.length) return i;
    }
  }
  return -1;
}

/** A bracket enclosing a point in the effect's body: for "(", the callee before it (setTimeout, forEach…). */
interface Frame {
  open: string;
  callee: string;
  at: number;
}

/** The brackets enclosing `pos` in `body`, all three kinds (skips strings and comments roughly). */
function framesAt(body: string, pos: number): Frame[] {
  const stack: Frame[] = [];
  for (let i = 0; i < pos; i++) {
    const ch = body[i];
    if (ch === '"' || ch === "'" || ch === "`") {
      const q = ch;
      for (i++; i < pos && body[i] !== q; i++) if (body[i] === "\\") i++;
      continue;
    }
    if (ch === "/" && body[i + 1] === "/") {
      const nl = body.indexOf("\n", i);
      i = nl < 0 || nl > pos ? pos : nl;
      continue;
    }
    if (ch === "(" || ch === "{" || ch === "[") stack.push({ open: ch, callee: ch === "(" ? (/([\w$.]+)\s*$/.exec(body.slice(Math.max(0, i - 60), i))?.[1] ?? "") : "", at: i });
    else if (ch === ")" || ch === "}" || ch === "]") stack.pop();
  }
  return stack;
}

/** Calls whose callback runs later, not while the effect runs: a timer, an event, a promise, an observer. */
const DEFERS = /(^|\.)(setTimeout|setInterval|requestAnimationFrame|requestIdleCallback|queueMicrotask|addEventListener|then|catch|finally|subscribe|observe)$|Observer$/;
/** Keywords whose brackets hold a condition or a block that runs right away. */
const CONTROL = /\b(if|else|while|for|switch)\b/;
const lineBefore = (text: string, at: number) => text.slice(0, at).split("\n").pop() ?? "";

const lineOf = (src: string, i: number) => src.slice(0, i).split("\n").length;

/** Names declared in the component as values rebuilt on every render (`const x = [...]`, `{...}`, `.filter(`, `.map(`…). */
function perRenderValues(src: string): Set<string> {
  const out = new Set<string>();
  for (const m of src.matchAll(/\bconst\s+(\w+)\s*=\s*([^;\n]+)/g)) {
    const [, name, rhs] = m;
    if (/^\s*(use[A-Z]\w*|React\.use\w*)\s*\(/.test(rhs)) continue;
    if (/^\s*[[{]/.test(rhs) || /\.(filter|map|slice|concat|sort|reduce|flatMap)\s*\(/.test(rhs) || /^\s*(Array\.from|Object\.(keys|values|entries)|new\s+\w+)\s*\(/.test(rhs)) out.add(name);
  }
  return out;
}

export function renderLoops(src: string): RenderLoop[] {
  if (!/\buseEffect\s*\(/.test(src)) return [];
  const setters = new Map<string, string>();
  for (const m of src.matchAll(/const\s*\[\s*(\w+)\s*,\s*(set\w+)\s*\]\s*=\s*(?:React\.)?useState/g)) setters.set(m[2], m[1]);
  const rebuilt = perRenderValues(src);
  const out: RenderLoop[] = [];
  for (const m of src.matchAll(/\buseEffect\s*\(/g)) {
    const open = m.index! + m[0].length - 1;
    const close = closing(src, open);
    if (close < 0) continue;
    const call = src.slice(open + 1, close);
    const depsMatch = /,\s*\[([^\]]*)\]\s*$/.exec(call);
    if (!depsMatch) continue;
    const deps = depsMatch[1].split(",").map((d) => d.trim()).filter(Boolean);
    const body = call.slice(0, depsMatch.index);
    const bodyStart = body.indexOf("{");
    if (bodyStart < 0) continue;
    const inner = body.slice(bodyStart + 1);
    const line = lineOf(src, m.index!);
    // Early returns at the effect's own top level ("if (!undo) return;"), with their conditions.
    const guards: Array<{ at: number; cond: string }> = [];
    for (const g of inner.matchAll(/\bif\s*\(/g)) {
      if (framesAt(inner, g.index!).length) continue;
      const cOpen = g.index! + g[0].length - 1;
      const cClose = closing(inner, cOpen);
      if (cClose > 0 && /^\s*(\{\s*)?return\b/.test(inner.slice(cClose + 1))) guards.push({ at: g.index!, cond: inner.slice(cOpen + 1, cClose) });
    }
    let direct = false;
    for (const s of inner.matchAll(/\b(set\w+)\s*\(/g)) {
      const state = setters.get(s[1]);
      if (!state) continue;
      const frames = framesAt(inner, s.index!);
      // Run later by a timer, an event or a promise, not while the effect runs (Clean Cart slice eval 1: three timed
      // effects such as "if (!undo) return; const t = setTimeout(() => setUndo(null), 10000)" were reported as loops
      // because the brace-less callback looked like the effect's top level, and the tests were refused).
      if (frames.some((f) => f.open === "(" && DEFERS.test(f.callee))) continue;
      // The conditions it runs under: early returns before it, an if on its own line, enclosing if/loop blocks.
      const own = lineBefore(inner, s.index!);
      const conds = [
        ...guards.filter((g) => g.at < s.index!).map((g) => g.cond),
        ...(/\b(if|else)\b|&&|\|\||\?/.test(own) ? [own] : []),
        ...frames.filter((f) => f.open === "{").map((f) => lineBefore(inner, f.at)).filter((t) => CONTROL.test(t)),
      ];
      // Inside a function it defines or a callback it passes (forEach, a helper): it may or may not run.
      const nested = frames.some((f) => (f.open === "{" ? !CONTROL.test(lineBefore(inner, f.at)) : f.open === "(" && f.callee !== "" && !CONTROL.test(f.callee)));
      if (!conds.length && !nested) direct = true;
      if (!deps.includes(state)) continue;
      // A condition that reads the state being set can stop the loop (the value settles): not reported.
      if (conds.some((c) => new RegExp(`\\b${state}\\b`).test(c))) continue;
      if (!conds.length && !nested)
        out.push({ line, severity: "blocking", message: `line ${line}: this useEffect sets ${state} (${s[1]}) and lists ${state} in its dependencies, so every update runs it again: an endless re-render. Derive the value during render instead, e.g. const sorted = useMemo(() => sortBrands(filtered, sort), [filtered, sort]), and drop the extra state.` });
      else if (!out.some((o) => o.line === line))
        out.push({ line, severity: "suspicious", message: `line ${line}: this useEffect may set ${state} (${s[1]}) ${conds.length ? `under a condition that doesn't read ${state}` : "from a function or callback inside it"}, and lists ${state} in its dependencies; whenever that call runs, the effect runs again. Check it: derive the value with useMemo, or make the condition read ${state}.` });
    }
    const unstable = deps.filter((d) => rebuilt.has(d));
    if (direct && unstable.length && !out.some((o) => o.line === line))
      out.push({ line, severity: "blocking", message: `line ${line}: this useEffect depends on ${unstable.join(", ")}, which is rebuilt on every render, and it sets state, so it runs after every render: an endless re-render. Wrap ${unstable.join(", ")} in useMemo, or compute the result with useMemo instead of an effect.` });
  }
  return out;
}

/** The loops in the given files, as one note for the agent (empty when there are none). */
export function renderLoopNote(files: Array<{ path: string; text: string }>, only?: RenderLoop["severity"]): string {
  const found = files.flatMap((f) => renderLoops(f.text).filter((l) => !only || l.severity === only).map((l) => ({ ...l, text: `- ${f.path} ${l.message}` })));
  const blocking = found.filter((l) => l.severity === "blocking").map((l) => l.text);
  const suspicious = found.filter((l) => l.severity === "suspicious").map((l) => l.text);
  return [
    blocking.length ? `Endless re-render found (the screen would freeze and tests would hang until the time limit):\n${blocking.slice(0, 4).join("\n")}` : "",
    suspicious.length ? `Possible re-render loop (from the source alone; worth checking, not certain):\n${suspicious.slice(0, 4).join("\n")}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}
