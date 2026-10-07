/**
 * Endless re-render loops in React components: an effect that sets, without a condition, state its own dependency list
 * includes, or that depends on a value rebuilt on every render. The screen then renders forever, the browser tab
 * freezes and every test run hangs until FlowCode's time limit (No BIO & GMO build: a sort effect depended on
 * filteredBrands and set filteredBrands, and each test run sat for five minutes with no clue why).
 */

export interface RenderLoop {
  line: number;
  message: string;
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

/** Brace depth of `pos` inside `body` (0 = the effect's own top level). */
function depthAt(body: string, pos: number): number {
  let d = 0;
  for (let i = 0; i < pos; i++) {
    if (body[i] === "{") d++;
    else if (body[i] === "}") d--;
  }
  return d;
}

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
    // Setter calls at the effect's top level (not inside an if, a callback or a timer).
    const topSets = [...inner.matchAll(/\b(set\w+)\s*\(/g)].filter((s) => setters.has(s[1]) && depthAt(inner, s.index!) === 0 && !/\b(if|else)\b|&&|\|\||\?/.test(inner.slice(0, s.index!).split("\n").pop() ?? ""));
    if (!topSets.length) continue;
    const line = lineOf(src, m.index!);
    for (const s of topSets) {
      const state = setters.get(s[1])!;
      if (deps.includes(state))
        out.push({ line, message: `line ${line}: this useEffect sets ${state} (${s[1]}) and lists ${state} in its dependencies, so every update runs it again: an endless re-render. Derive the value during render instead, e.g. const sorted = useMemo(() => sortBrands(filtered, sort), [filtered, sort]), and drop the extra state.` });
    }
    const unstable = deps.filter((d) => rebuilt.has(d));
    if (unstable.length && !out.some((o) => o.line === line))
      out.push({ line, message: `line ${line}: this useEffect depends on ${unstable.join(", ")}, which is rebuilt on every render, and it sets state, so it runs after every render: an endless re-render. Wrap ${unstable.join(", ")} in useMemo, or compute the result with useMemo instead of an effect.` });
  }
  return out;
}

/** The loops in the given files, as one note for the agent (empty when there are none). */
export function renderLoopNote(files: Array<{ path: string; text: string }>): string {
  const found = files.flatMap((f) => renderLoops(f.text).map((l) => `- ${f.path} ${l.message}`));
  return found.length ? `Endless re-render found (the screen would freeze and tests would hang until the time limit):\n${found.slice(0, 4).join("\n")}` : "";
}
