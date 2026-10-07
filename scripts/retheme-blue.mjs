// One-off: moves remaining hard-coded violet/magenta accents to the Supernova blue system.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const src = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "apps", "ui", "src");
const apply = (rel, pairs) => {
  const f = path.join(src, rel);
  let s = fs.readFileSync(f, "utf8");
  for (const [re, to] of pairs) s = s.replace(re, to);
  fs.writeFileSync(f, s);
};
const cssPairs = [
  [/rgba\(139, 92, 246, ([0-9.]+)\)/g, "rgba(26, 94, 229, $1)"],
  [/rgba\(192, 38, 211, ([0-9.]+)\)/g, "rgba(77, 129, 235, $1)"],
  [/rgba\(176, 59, 224, ([0-9.]+)\)/g, "rgba(26, 94, 229, $1)"],
  [/rgba\(15, 138, 143, ([0-9.]+)\)/g, "rgba(26, 94, 229, $1)"],
  [/rgba\(2, 14, 16, ([0-9.]+)\)/g, "rgba(4, 9, 22, $1)"],
  [/rgba\(2, 16, 19, ([0-9.]+)\)/g, "rgba(5, 11, 26, $1)"],
  [/linear-gradient\(135deg, #9d5cf6 0%, #b23be3 55%, #c026d3 100%\)/g, "linear-gradient(180deg, #2a69ea 0%, #1a5ee5 100%)"],
  [/linear-gradient\(135deg, #a96ef8 0%, #bf4be8 55%, #d23ae0 100%\)/g, "linear-gradient(180deg, #4d81eb 0%, #2a69ea 100%)"],
];
apply("styles/app.css", cssPairs);
apply("styles/motion.css", cssPairs);
apply("components/motion.tsx", [
  [/stopColor="#8b5cf6"/g, 'stopColor="#1a5ee5"'],
  [/stopColor="#c026d3"/g, 'stopColor="#4d81eb"'],
  [/stopColor="#5eead4"/g, 'stopColor="#719bef"'],
  [/rgba\(192,38,211,\.45\)/g, "rgba(26,94,229,.45)"],
]);
apply("components/Dashboard.tsx", [[/const COLORS = \{[^}]+\};/, 'const COLORS = { runs: "#1a5ee5", verified: "#3ccf8e", toolCalls: "#719bef", knowledge: "#38bdf8" };']]);
apply("views/ProjectsView.tsx", [
  [/rgba\(192,38,211,\.55\)/g, "rgba(26,94,229,.55)"],
  [/rgba\(15,138,143,\.6\)/g, "rgba(113,155,239,.45)"],
]);
console.log("blue retheme applied");
