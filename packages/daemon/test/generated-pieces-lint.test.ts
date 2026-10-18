/**
 * The app pieces FlowCode writes into a complete app pass the starter app's lint rule `no-unused-expressions` (Frameproof
 * main build: record-detail's "Copy record id" was `clipboard?.writeText(…).then(…) ?? toast(…)` as a statement, so every
 * generated app failed lint before any model work, and the correction step was blocked). Checked on the generated
 * output (pieceFiles: the files as written into the app), with the rule's default options: a statement must be a call,
 * an assignment, `await`, `new`, `delete`, `void` or `++`/`--`; `a && b()`, `a ?? b()` and `a ? b() : c()` are not.
 */
import ts from "typescript";
import { describe, expect, it } from "vitest";
import { APP_PIECES } from "../src/orchestrator/appFiles.js";
import { pieceFiles } from "../src/orchestrator/sectionRecipes.js";

function unusedExpressions(file: string, src: string): string[] {
  const sf = ts.createSourceFile(file, src, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const out: string[] = [];
  const allowed = (e: ts.Expression): boolean => {
    while (ts.isParenthesizedExpression(e) || ts.isNonNullExpression(e) || ts.isAsExpression(e)) e = e.expression;
    if (ts.isCallExpression(e) || ts.isNewExpression(e) || ts.isAwaitExpression(e) || ts.isDeleteExpression(e) || ts.isVoidExpression(e) || ts.isTaggedTemplateExpression(e) || ts.isYieldExpression(e)) return true;
    if ((ts.isPrefixUnaryExpression(e) || ts.isPostfixUnaryExpression(e)) && (e.operator === ts.SyntaxKind.PlusPlusToken || e.operator === ts.SyntaxKind.MinusMinusToken)) return true;
    if (ts.isBinaryExpression(e)) {
      const k = e.operatorToken.kind;
      if (k >= ts.SyntaxKind.FirstAssignment && k <= ts.SyntaxKind.LastAssignment) return true;
      if (k === ts.SyntaxKind.CommaToken) return allowed(e.right);
    }
    return false;
  };
  const visit = (n: ts.Node) => {
    if (ts.isExpressionStatement(n) && !ts.isStringLiteral(n.expression) && !allowed(n.expression)) {
      const { line } = sf.getLineAndCharacterOfPosition(n.getStart());
      out.push(`${file}:${line + 1} ${n.getText().split("\n")[0]!.slice(0, 80)}`);
    }
    ts.forEachChild(n, visit);
  };
  visit(sf);
  return out;
}

describe("generated app pieces and the starter's no-unused-expressions rule", () => {
  it("flags the expression statement that blocked the Frameproof build (the rule check works)", () => {
    const before = "const run = () => {\n  navigator.clipboard?.writeText(id).then(() => toast('a'), () => toast('b')) ?? toast('c');\n};\n";
    expect(unusedExpressions("src/sections/RecordDetail.tsx", before)).toEqual([expect.stringContaining("src/sections/RecordDetail.tsx:2 navigator.clipboard")]);
  });

  it.each(APP_PIECES)("%s, as written into the app, has no unused expression statements", (id) => {
    const files = pieceFiles(id);
    expect(files.length).toBeGreaterThan(0);
    expect(files.flatMap((f) => unusedExpressions(f.rel, f.content))).toEqual([]);
  });

  it("record detail's Copy record id keeps all three outcomes: copied, refused, no clipboard", () => {
    const src = pieceFiles("record-detail").find((f) => f.rel === "src/sections/RecordDetail.tsx")!.content;
    const copy = src.slice(src.indexOf('id: "copy"'), src.indexOf('id: "copy"') + 700);
    expect(copy).toContain("if (!navigator.clipboard)");
    expect(copy).toContain("toast(`The id is ${rec.id}.`, \"neutral\")");
    expect(copy).toContain("toast(`Copied ${rec.id}.`, \"neutral\")");
    expect(copy).toContain("toast(`Couldn't copy. The id is ${rec.id}.`, \"warning\")");
  });
});
