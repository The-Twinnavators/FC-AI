/**
 * A calculator, composed by FlowCode from the PRD (a "basic calculator" with its functional requirements): the engine
 * (src/app/calculator.ts: standard order of operations, percent, sign toggle, backspace, clear, "Can't divide by
 * zero", long results in scientific notation), the screen (a display with the running expression and the result, a
 * 4-column keypad, the keyboard, a session-only history, copy), its stylesheet in the app's tokens, and acceptance tests
 * from the PRD's own examples. The model refines the look. The calculator build: the local model wrote the keypad twice
 * with no handlers, a placeholder "hero" drawing, and prose instead of tool calls, step after step.
 */
export const CALC_ENGINE = "src/app/calculator.ts";
export const CALC_SCREEN = "src/screens/CalculatorScreen.tsx";
export const CALC_SHEET = "src/styles/calculator.css";
export const COMPOSED_CALC = "Composed by FlowCode (calculatorComposer.ts)";

/** Whether the PRD describes a basic calculator FlowCode can compose. */
export function isCalculatorPrd(prd: string, objective = ""): boolean {
  const text = `${objective}\n${prd}`;
  return /\bcalculator\b/i.test(text) && /\b(addition|add)\b/i.test(text) && /\b(subtraction|subtract)\b/i.test(text) && /\b(division|divide)\b/i.test(text);
}

export const engineFile = (): string => `/**
 * The calculator's engine, ${COMPOSED_CALC}: what the keys do to the display, with standard order of operations
 * (2 + 3 × 4 = 14), percent, sign toggle, backspace, clear, division by zero, and long results in scientific notation.
 * Pure functions: the screen keeps the state.
 */
export type Op = "+" | "−" | "×" | "÷";

export interface CalcState {
  /** The numbers and operators entered so far (the running expression), not including \`entry\`. */
  tokens: Array<number | Op>;
  /** What is being typed now, as text ("12.5"), or the last result. */
  entry: string;
  /** The last result was just shown: typing a digit starts a new calculation. */
  done: boolean;
  /** A message in place of a result ("Can't divide by zero"). */
  error?: string;
}

export const DIVIDE_BY_ZERO = "Can't divide by zero";
export const start = (): CalcState => ({ tokens: [], entry: "0", done: false });

/** A number as the display shows it: up to 12 significant digits, scientific notation when it is very large or small. */
export function format(n: number): string {
  if (!Number.isFinite(n)) return DIVIDE_BY_ZERO;
  if (n === 0) return "0";
  const abs = Math.abs(n);
  // 12 significant digits, trailing zeros dropped (1.23456789012e+19), so a long result never clips.
  if (abs >= 1e15 || abs < 1e-9) return n.toExponential(11).replace(/\\.?0+e/, "e");
  return String(Number(n.toPrecision(12)));
}

const rank = (op: Op) => (op === "×" || op === "÷" ? 2 : 1);

/** Evaluates numbers and operators with standard precedence; Infinity when something is divided by zero. */
export function evaluate(tokens: Array<number | Op>): number {
  const out: number[] = [];
  const ops: Op[] = [];
  const apply = () => {
    const op = ops.pop()!;
    const b = out.pop()!;
    const a = out.pop()!;
    out.push(op === "+" ? a + b : op === "−" ? a - b : op === "×" ? a * b : b === 0 ? Infinity : a / b);
  };
  for (const t of tokens) {
    if (typeof t === "number") out.push(t);
    else {
      while (ops.length && rank(ops[ops.length - 1]!) >= rank(t)) apply();
      ops.push(t);
    }
  }
  while (ops.length) apply();
  return out[0] ?? 0;
}

export function digit(s: CalcState, d: string): CalcState {
  if (s.error || s.done) return { tokens: [], entry: d === "." ? "0." : d, done: false };
  if (d === "." && s.entry.includes(".")) return s;
  if (s.entry.replace(/[^0-9]/g, "").length >= 20) return s;
  const entry = s.entry === "0" && d !== "." ? d : s.entry === "-0" && d !== "." ? \`-\${d}\` : s.entry + d;
  return { ...s, entry };
}

export function operator(s: CalcState, op: Op): CalcState {
  if (s.error) return s;
  // Changing the operator just pressed replaces it.
  if (s.entry === "" && s.tokens.length) return { ...s, tokens: [...s.tokens.slice(0, -1), op] };
  return { tokens: [...s.tokens, Number(s.entry), op], entry: "", done: false };
}

export function equals(s: CalcState): CalcState {
  if (s.error || (!s.tokens.length && s.entry !== "")) return { ...s, done: true };
  const tokens = s.entry === "" ? s.tokens.slice(0, -1) : [...s.tokens, Number(s.entry)];
  const value = evaluate(tokens);
  if (!Number.isFinite(value)) return { tokens: [], entry: "0", done: true, error: DIVIDE_BY_ZERO };
  return { tokens: [], entry: format(value), done: true };
}

export const clear = (): CalcState => start();

export function backspace(s: CalcState): CalcState {
  if (s.error || s.done) return start();
  const entry = s.entry.length > 1 && s.entry !== "-0" ? s.entry.slice(0, -1) : "0";
  return { ...s, entry: entry === "-" ? "0" : entry };
}

export function percent(s: CalcState): CalcState {
  if (s.error || s.entry === "") return s;
  return { ...s, entry: format(Number(s.entry) / 100), done: false };
}

export function toggleSign(s: CalcState): CalcState {
  if (s.error || s.entry === "") return s;
  return { ...s, entry: s.entry.startsWith("-") ? s.entry.slice(1) : \`-\${s.entry}\` };
}

/** The running expression as the display shows it ("12 + 3 ×"). */
export const expressionOf = (s: CalcState) => s.tokens.map((t) => (typeof t === "number" ? format(t) : t)).join(" ");

/** What the main line shows. */
export const displayOf = (s: CalcState) => s.error ?? (s.entry === "" ? format(Number(s.tokens[s.tokens.length - 2] ?? 0)) : s.entry);
`;

export const screenFile = (product: string): string => `/**
 * ${product.replace(/\*\//g, "* /")}: the calculator screen, ${COMPOSED_CALC}. The display shows the running expression and the
 * current number (announced to screen readers); the keypad and the keyboard do the same things (digits, . + - * / Enter
 * or =, Backspace, Escape for clear, %). Results this session are listed under it, cleared when the app closes. Nothing
 * is stored or sent anywhere.
 */
import { useCallback, useEffect, useState } from "react";
import { backspace, clear, digit, displayOf, equals, expressionOf, operator, percent, start, toggleSign, type CalcState, type Op } from "../app/calculator";
import "../styles/calculator.css";

type Key = { label: string; name: string; kind: "digit" | "op" | "fn" | "equals"; press: (s: CalcState) => CalcState };
const op = (o: Op, name: string): Key => ({ label: o, name, kind: "op", press: (s) => operator(s, o) });
const num = (d: string): Key => ({ label: d, name: d === "." ? "Decimal point" : d, kind: "digit", press: (s) => digit(s, d) });
const KEYS: Key[] = [
  { label: "C", name: "Clear", kind: "fn", press: () => clear() },
  { label: "⌫", name: "Backspace", kind: "fn", press: backspace },
  { label: "%", name: "Percent", kind: "fn", press: percent },
  op("÷", "Divide"),
  num("7"), num("8"), num("9"), op("×", "Multiply"),
  num("4"), num("5"), num("6"), op("−", "Subtract"),
  num("1"), num("2"), num("3"), op("+", "Add"),
  { label: "±", name: "Change sign", kind: "fn", press: toggleSign },
  num("0"), num("."),
  { label: "=", name: "Equals", kind: "equals", press: equals },
];
const KEYBOARD: Record<string, string> = { "+": "Add", "-": "Subtract", "*": "Multiply", x: "Multiply", "/": "Divide", Enter: "Equals", "=": "Equals", Backspace: "Backspace", Escape: "Clear", Delete: "Clear", "%": "Percent", ".": "Decimal point", ",": "Decimal point" };

export default function CalculatorScreen() {
  const [state, setState] = useState<CalcState>(start);
  const [history, setHistory] = useState<Array<{ expression: string; result: string }>>([]);
  const [copied, setCopied] = useState("");

  const press = useCallback((key: Key) => {
    setState((s) => {
      const next = key.press(s);
      if (key.kind === "equals" && !s.done && !next.error && s.tokens.length) {
        const expression = \`\${expressionOf(s)} \${s.entry}\`.trim();
        setHistory((h) => [{ expression, result: next.entry }, ...h].slice(0, 20));
      }
      return next;
    });
    setCopied("");
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const target = e.target as HTMLElement | null;
      if (target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return;
      const name = /^[0-9]$/.test(e.key) ? e.key : KEYBOARD[e.key];
      const key = KEYS.find((k) => k.name === name);
      if (!key) return;
      e.preventDefault();
      press(key);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [press]);

  const shown = displayOf(state);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(shown);
      setCopied("Copied");
    } catch {
      setCopied("Copy isn't available here");
    }
  };

  return (
    <div className="calc">
      <h1 className="calc__title">Calculator</h1>
      <div className="calc__body">
        <section className="calc__device" aria-label="Calculator">
          <div className="calc__display">
            <p className="calc__expression" aria-label="Expression">{expressionOf(state) || "\\u00a0"}</p>
            <output className={state.error ? "calc__result is-error" : "calc__result"} aria-live="polite" aria-label="Result">
              {shown}
            </output>
          </div>
          <div className="calc__keys">
            {KEYS.map((k) => (
              <button key={k.name} type="button" className={\`calc__key calc__key--\${k.kind}\`} aria-label={k.name} onClick={() => press(k)}>
                {k.label}
              </button>
            ))}
          </div>
          <div className="calc__tools">
            <button type="button" className="calc__copy" onClick={() => void copy()}>
              Copy result
            </button>
            <span className="calc__copied" role="status">
              {copied}
            </span>
          </div>
        </section>
        <section className="calc__history" aria-label="History">
          <h2>History</h2>
          {history.length ? (
            <ol>
              {history.map((h, i) => (
                <li key={\`\${i}-\${h.expression}\`}>
                  <span className="calc__history-expr">{h.expression} =</span> <strong>{h.result}</strong>
                </li>
              ))}
            </ol>
          ) : (
            <p className="calc__empty">Results from this session appear here. They're cleared when you close the app.</p>
          )}
        </section>
      </div>
    </div>
  );
}
`;

export const sheetFile = (): string => `/* The calculator, ${COMPOSED_CALC}: in the app's tokens only. */
.calc { display: grid; gap: var(--space-5); max-width: 56rem; }
.calc__title { margin: 0; font-family: var(--font-display); font-size: var(--text-2xl); }
.calc__body { display: grid; gap: var(--space-5); grid-template-columns: minmax(0, 22rem) minmax(0, 1fr); align-items: start; }
@media (max-width: 720px) { .calc__body { grid-template-columns: minmax(0, 1fr); } }
.calc__device { display: grid; gap: var(--space-3); padding: var(--space-4); border: var(--border-width, 1px) solid var(--color-border); border-radius: var(--radius-lg, var(--radius-md)); background: var(--color-surface); }
.calc__display { display: grid; gap: var(--space-1); padding: var(--space-3) var(--space-4); border-radius: var(--radius-md); background: var(--color-surface-sunken); text-align: right; min-width: 0; }
.calc__expression { margin: 0; min-height: 1.5em; color: var(--color-text-muted); font-size: var(--text-sm); font-variant-numeric: tabular-nums; overflow-wrap: anywhere; }
.calc__result { display: block; color: var(--color-text); font-size: var(--text-3xl, 2rem); font-weight: var(--weight-semibold); font-variant-numeric: tabular-nums; line-height: 1.2; overflow-wrap: anywhere; }
.calc__result.is-error { font-size: var(--text-lg); color: var(--color-danger, var(--color-text)); }
.calc__keys { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: var(--space-2); }
.calc__key { min-height: 3.5rem; border: var(--border-width, 1px) solid var(--color-border); border-radius: var(--radius-md); background: var(--color-bg); color: var(--color-text); font: inherit; font-size: var(--text-lg); font-variant-numeric: tabular-nums; cursor: pointer; transition: background var(--duration-fast, 120ms) var(--easing, ease); }
.calc__key:hover { background: var(--color-surface-sunken); }
.calc__key:focus-visible, .calc__copy:focus-visible { outline: 2px solid var(--color-focus, var(--color-accent)); outline-offset: 2px; }
.calc__key--op { color: var(--color-accent); font-weight: var(--weight-semibold); }
.calc__key--fn { color: var(--color-text-muted); }
.calc__key--equals { background: var(--color-accent); border-color: var(--color-accent); color: var(--color-on-accent); font-weight: var(--weight-semibold); }
.calc__key--equals:hover { background: var(--color-accent); filter: brightness(1.05); }
.calc__tools { display: flex; align-items: center; gap: var(--space-3); }
.calc__copy { min-height: 2.75rem; padding: 0 var(--space-3); border: var(--border-width, 1px) solid var(--color-border); border-radius: var(--radius-md); background: var(--color-surface); color: var(--color-text); font: inherit; font-size: var(--text-sm); cursor: pointer; }
.calc__copied { color: var(--color-text-muted); font-size: var(--text-sm); }
.calc__history h2 { margin: 0 0 var(--space-2); font-size: var(--text-lg); }
.calc__history ol { display: grid; gap: var(--space-2); margin: 0; padding: 0; list-style: none; font-variant-numeric: tabular-nums; }
.calc__history-expr { color: var(--color-text-muted); }
.calc__empty { margin: 0; color: var(--color-text-muted); }
@media (prefers-reduced-motion: reduce) { .calc__key { transition: none; } }
`;

/** The acceptance tests, from the PRD's requirements and the values its planned checks name. */
export const testsFile = (title: string): string => `/**
 * Acceptance tests for "${title.replace(/\*\//g, "* /")}", written by FlowCode (calculatorComposer.ts): the calculator used the way a
 * person does, by its keys and by the keyboard. When one fails, fix the app, not the test.
 */
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";
import App from "../App";

const user = userEvent.setup();
const result = () => screen.getByLabelText("Result");
const press = async (...names: string[]) => {
  for (const n of names) await user.click(screen.getByRole("button", { name: n }));
};

beforeEach(() => {
  window.location.hash = "";
  render(<App />);
});

describe(${JSON.stringify(title)}, () => {
  it("adds, subtracts, multiplies and divides", async () => {
    await press("2", "Add", "3", "Equals");
    expect(result()).toHaveTextContent("5");
    await press("Clear", "3", "Multiply", "4", "Equals");
    expect(result()).toHaveTextContent("12");
    await press("Clear", "3", "Subtract", "2", "Equals");
    expect(result()).toHaveTextContent(/^1$/);
    await press("Clear", "8", "Divide", "2", "Equals");
    expect(result()).toHaveTextContent(/^4$/);
  });

  it("follows the standard order of operations: 2 + 3 × 4 = 14", async () => {
    await press("2", "Add", "3", "Multiply", "4", "Equals");
    expect(result()).toHaveTextContent("14");
  });

  it("says it can't divide by zero, and carries on after Clear", async () => {
    await press("7", "Divide", "0", "Equals");
    expect(result()).toHaveTextContent("Can't divide by zero");
    await press("Clear", "1", "Add", "1", "Equals");
    expect(result()).toHaveTextContent(/^2$/);
  });

  it("takes a decimal point once, and deletes the last digit with backspace", async () => {
    await press("1", "2", "3", "Decimal point", "4", "5", "6", "Decimal point");
    expect(result()).toHaveTextContent("123.456");
    await press("Backspace");
    expect(result()).toHaveTextContent("123.45");
  });

  it("works out a percent and changes the sign", async () => {
    await press("5", "0", "Percent");
    expect(result()).toHaveTextContent("0.5");
    await press("Clear", "9", "Change sign");
    expect(result()).toHaveTextContent("-9");
  });

  it("shows a very large result in scientific notation without clipping it", async () => {
    await press(..."12345678901234567890".split(""), "Multiply", "1", "Equals");
    expect(result()).toHaveTextContent("1.23456789012e+19");
  });

  it("shows the running expression while it is typed", async () => {
    await press("1", "2", "Add", "3");
    expect(screen.getByLabelText("Expression")).toHaveTextContent("12 +");
  });

  it("works from the keyboard", async () => {
    await user.keyboard("6*7{Enter}");
    expect(result()).toHaveTextContent("42");
    await user.keyboard("{Escape}");
    expect(result()).toHaveTextContent(/^0$/);
  });

  it("lists this session's results", async () => {
    await press("2", "Add", "2", "Equals");
    expect(screen.getByRole("region", { name: "History" })).toHaveTextContent("2 + 2 = 4");
  });
});
`;
