/**
 * A test run's failures at a glance, for the top of what the agent reads: each failing test's name with its first
 * error line. The agent only gets the output's tail, and with many failures (each with a stack trace, plus jsdom's
 * "Not implemented" noise) the tail held the last two or three, so it couldn't see what to fix (Calendar prototype:
 * it fell back to reading vitest's JSON file with a node script).
 */
export function testFailureDigest(output: string, max = 25): string {
  const clean = output.replace(/\x1b\[[0-9;]*m/g, "");
  const lines = clean.split(/\r?\n/);
  const failed: string[] = [];
  for (let i = 0; i < lines.length && failed.length < max; i++) {
    const m = /^\s*(?:×|✗|FAIL)\s+(.+?)(?:\s+\d+m?s)?\s*$/.exec(lines[i]);
    if (!m || /^\S+\.(test|spec)\.[jt]sx?\s*\(\d+ tests?/.test(m[1])) continue;
    const name = m[1].replace(/\s+\[\s*\S+\s*\]$/, "").trim();
    if (failed.some((f) => f.startsWith(`- ${name}`))) continue;
    // The first explanation after it: vitest's "→ expected …" line, or an Error line.
    let why = "";
    for (let j = i + 1; j < Math.min(lines.length, i + 8); j++) {
      const w = /^\s*(?:→\s*(.+)|((?:Assertion)?Error:.+|TestingLibraryElementError:.+))/.exec(lines[j]);
      if (w) {
        why = (w[1] ?? w[2]).trim().slice(0, 220);
        break;
      }
      if (/^\s*(?:×|✗|✓|FAIL)\s/.test(lines[j])) break;
    }
    failed.push(`- ${name}${why ? `: ${why}` : ""}`);
  }
  if (!failed.length) return "";
  const summary = /Tests\s+(\d+ failed[^\n]*)/.exec(clean)?.[1]?.trim();
  // Many failures that can't find something on screen usually share one cause (Calendar design rebuild: 9 of 12 failed
  // because event details stopped opening, and the coder fixed tests one by one until it ran out of turns).
  const missing = failed.filter((f) => /Unable to find (an accessible element|an element|role)/.test(f)).length;
  const shared = failed.length >= 3 && missing * 2 >= failed.length ? `${missing} of these ${failed.length} can't find something on screen: usually one shared cause (a screen, dialog or list that no longer renders or opens). Find and fix that first, then run the tests again.\n` : "";
  return `Failing tests${summary ? ` (${summary})` : ""}:\n${shared}${failed.join("\n")}\n\n`;
}
