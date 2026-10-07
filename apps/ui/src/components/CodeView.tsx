/**
 * Read-only code view with line numbers and syntax colours. A small tokenizer per language family (TypeScript and
 * JavaScript, JSON, CSS, HTML, Python, Markdown, shell); anything else shows as plain text with line numbers.
 */
import { useMemo } from "react";

type Tok = { c?: string; t: string };
type Rule = [cls: string, re: RegExp];

const JS_KW =
  "abstract|as|async|await|break|case|catch|class|const|continue|debugger|declare|default|delete|do|else|enum|export|extends|finally|for|from|function|get|if|implements|import|in|instanceof|interface|keyof|let|new|of|private|protected|public|readonly|return|satisfies|set|static|super|switch|this|throw|try|type|typeof|var|void|while|with|yield";
const PY_KW = "and|as|assert|async|await|break|class|continue|def|del|elif|else|except|finally|for|from|global|if|import|in|is|lambda|nonlocal|not|or|pass|raise|return|try|while|with|yield|self";

const STR = /"(?:\\.|[^"\\\n])*"|'(?:\\.|[^'\\\n])*'/;
const NUM = /\b(?:0x[\da-f]+|\d[\d_]*(?:\.\d+)?(?:e[+-]?\d+)?)\b/i;

const RULES: Record<string, Rule[]> = {
  js: [
    ["com", /\/\/[^\n]*|\/\*[\s\S]*?\*\//],
    ["str", /`(?:\\[\s\S]|[^`\\])*`/],
    ["str", STR],
    ["kw", new RegExp(`\\b(?:${JS_KW})\\b`)],
    ["lit", /\b(?:true|false|null|undefined|NaN|Infinity)\b/],
    ["num", NUM],
    ["tag", /<\/?[A-Za-z][\w.]*(?=[\s/>])/],
    ["type", /\b[A-Z][A-Za-z0-9_]*\b/],
    ["fn", /\b[a-zA-Z_$][\w$]*(?=\s*\()/],
    ["prop", /(?<=\.)[a-zA-Z_$][\w$]*/],
    ["pun", /[{}()[\];,.<>/=+\-*%!&|?:^~]+/],
  ],
  json: [
    ["key", /"(?:\\.|[^"\\\n])*"(?=\s*:)/],
    ["str", STR],
    ["lit", /\b(?:true|false|null)\b/],
    ["num", /-?\b\d+(?:\.\d+)?(?:e[+-]?\d+)?\b/i],
    ["pun", /[{}[\],:]/],
  ],
  css: [
    ["com", /\/\*[\s\S]*?\*\//],
    ["str", STR],
    ["kw", /@[\w-]+/],
    ["var", /--[\w-]+/],
    ["num", /#[\da-f]{3,8}\b|-?\b\d+(?:\.\d+)?(?:px|rem|em|%|vh|vw|s|ms|deg|fr)?\b/i],
    ["key", /[\w-]+(?=\s*:(?!:))/],
    ["fn", /[\w-]+(?=\()/],
    ["tag", /[.#]?[a-zA-Z][\w-]*(?=[^{};]*\{)/],
    ["pun", /[{}();:,>+~]/],
  ],
  html: [
    ["com", /<!--[\s\S]*?-->/],
    ["tag", /<\/?[\w-]+|\/?>/],
    ["key", /[\w:@.-]+(?==)/],
    ["str", STR],
  ],
  py: [
    ["com", /#[^\n]*/],
    ["str", /"""[\s\S]*?"""|'''[\s\S]*?'''/],
    ["str", STR],
    ["kw", new RegExp(`\\b(?:${PY_KW})\\b`)],
    ["lit", /\b(?:True|False|None)\b/],
    ["num", NUM],
    ["fn", /\b[a-zA-Z_]\w*(?=\s*\()/],
    ["type", /\b[A-Z]\w*\b/],
    ["kw", /@[\w.]+/],
  ],
  md: [
    ["kw", /^#{1,6} [^\n]*/m],
    ["str", /`[^`\n]+`/],
    ["key", /\*\*[^*\n]+\*\*/],
    ["fn", /\[[^\]\n]+\]\([^)\n]+\)/],
    ["pun", /^\s*(?:[-*+]|\d+\.) /m],
  ],
  sh: [
    ["com", /#[^\n]*/],
    ["str", STR],
    ["var", /\$\{?[\w]+\}?/],
    ["kw", /\b(?:if|then|else|fi|for|do|done|while|case|esac|function|export|echo|cd|npm|npx|node)\b/],
  ],
};

function langOf(path: string): string | undefined {
  const ext = path.toLowerCase().split(".").pop() ?? "";
  if (["ts", "tsx", "js", "jsx", "mjs", "cjs", "mts", "cts"].includes(ext)) return "js";
  if (["json", "jsonc", "webmanifest"].includes(ext) || /(^|\/)\.?(prettierrc|eslintrc|babelrc)$/.test(path)) return "json";
  if (["css", "scss", "less"].includes(ext)) return "css";
  if (["html", "htm", "svg", "xml", "vue"].includes(ext)) return "html";
  if (ext === "py") return "py";
  if (["md", "mdx", "markdown"].includes(ext)) return "md";
  if (["sh", "bash", "zsh", "env"].includes(ext) || path.endsWith(".gitignore")) return "sh";
  return undefined;
}

function tokenize(text: string, rules: Rule[]): Tok[] {
  const re = new RegExp(rules.map(([, r]) => `(${r.source})`).join("|"), "gim");
  const out: Tok[] = [];
  let last = 0;
  for (let m = re.exec(text); m; m = re.exec(text)) {
    if (!m[0]) {
      re.lastIndex++;
      continue;
    }
    if (m.index > last) out.push({ t: text.slice(last, m.index) });
    const g = m.slice(1).findIndex((x) => x !== undefined);
    out.push({ c: rules[g][0], t: m[0] });
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push({ t: text.slice(last) });
  return out;
}

/** Splits tokens into lines, cutting tokens that span several lines (block comments, template strings). */
function toLines(toks: Tok[]): Tok[][] {
  const lines: Tok[][] = [[]];
  for (const tok of toks) {
    const parts = tok.t.split("\n");
    parts.forEach((p, i) => {
      if (i > 0) lines.push([]);
      if (p) lines[lines.length - 1].push({ c: tok.c, t: p });
    });
  }
  return lines;
}

const MAX_HIGHLIGHT = 300_000;

export function CodeView({ path, content, label }: { path: string; content: string; label?: string }) {
  const lines = useMemo(() => {
    const text = content.replace(/\r\n?/g, "\n").replace(/\n$/, "");
    const lang = langOf(path);
    const toks = lang && text.length <= MAX_HIGHLIGHT ? tokenize(text, RULES[lang]) : [{ t: text }];
    return toLines(toks);
  }, [path, content]);
  const width = String(lines.length).length;
  return (
    <div className="codeview" role="region" aria-label={label ?? `Contents of ${path}`} tabIndex={0} style={{ ["--ln-w" as string]: `${width + 1}ch` }}>
      <pre className="codeview__pre">
        <code>
          {lines.map((line, i) => (
            <span className="codeview__row" key={i}>
              <span className="codeview__ln" aria-hidden="true">
                {i + 1}
              </span>
              <span className="codeview__code">
                {line.length
                  ? line.map((tok, j) =>
                      tok.c ? (
                        <span key={j} className={`tk-${tok.c}`}>
                          {tok.t}
                        </span>
                      ) : (
                        tok.t
                      ),
                    )
                  : "​"}
              </span>
              {"\n"}
            </span>
          ))}
        </code>
      </pre>
    </div>
  );
}
