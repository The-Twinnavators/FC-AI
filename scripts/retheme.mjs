// One-off: aligns hard-coded accent values in app.css with the teal + purple/magenta theme.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const file = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "apps", "ui", "src", "styles", "app.css");
let s = fs.readFileSync(file, "utf8");
const pairs = [
  [/linear-gradient\(135deg, #9b6dff 0%, #6d5cf6 55%, #5b5ff0 100%\)/g, "linear-gradient(135deg, #9d5cf6 0%, #b23be3 55%, #c026d3 100%)"],
  [/linear-gradient\(135deg, #a77cff 0%, #7a69f8 55%, #676bf2 100%\)/g, "linear-gradient(135deg, #a96ef8 0%, #bf4be8 55%, #d23ae0 100%)"],
  [/rgba\(124, 92, 255, ([0-9.]+)\)/g, "rgba(176, 59, 224, $1)"],
  [/rgba\(99, 102, 241, ([0-9.]+)\)/g, "rgba(192, 38, 211, $1)"],
  [/rgba\(109, 74, 255, ([0-9.]+)\)/g, "rgba(139, 92, 246, $1)"],
  [/rgba\(4, 5, 10, ([0-9.]+)\)/g, "rgba(2, 14, 16, $1)"],
  [/rgba\(5, 6, 10, ([0-9.]+)\)/g, "rgba(2, 16, 19, $1)"],
];
for (const [re, to] of pairs) s = s.replace(re, to);
fs.writeFileSync(file, s);
console.log("retheme applied");
