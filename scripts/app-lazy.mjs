// One-off codemod: lazy-load views, add Primitives nav, wrap routes in Suspense with skeletons,
// and enable scroll-reveal + parallax hooks in App.tsx.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const file = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "apps", "ui", "src", "App.tsx");
let s = fs.readFileSync(file, "utf8");
const rep = (a, b) => {
  if (s.includes(b)) return;
  if (!s.includes(a)) throw new Error(`anchor not found: ${a.slice(0, 80)}`);
  s = s.replace(a, b);
};

const lazyViews = ["KnowledgeView", "LibraryView", "QualityView", "ReportsView", "ModelsView", "SettingsView", "DiagnosticsView", "SystemView", "AgentsView", "NetworkView"];
for (const v of lazyViews) rep(`import { ${v} } from "./views/${v}";\n`, "");
rep('import { useCallback, useEffect, useRef, useState } from "react";', 'import { lazy, Suspense, useCallback, useEffect, useRef, useState } from "react";');
rep(
  'import { Copilot } from "./components/Copilot";',
  `import { Copilot } from "./components/Copilot";
import { SkeletonBlock, useParallax, useRevealAll } from "./components/motion";

// Heavy pages load on demand (three.js, charts) so startup stays fast.
${[...lazyViews, "PrimitivesView"].map((v) => `const ${v} = lazy(() => import("./views/${v}").then((m) => ({ default: m.${v} })));`).join("\n")}

function PageSkeleton() {
  return (
    <div className="page">
      <SkeletonBlock rows={6} label="Loading page" />
    </div>
  );
}`,
);
rep('  { path: "/models", icon: "models", label: "Models & capability lab" },\n] as const;', '  { path: "/models", icon: "models", label: "Models & capability lab" },\n  { path: "/primitives", icon: "library", label: "Primitives (UI components)" },\n] as const;');
rep("  const route = useRoute();\n", "  const route = useRoute();\n  useRevealAll();\n  useParallax();\n");
rep('<main id="main" className="view" tabIndex={-1}>', '<main id="main" className="view" tabIndex={-1}>\n        <Suspense fallback={<PageSkeleton />}>\n        <div key={section || "home"} className="page-enter" style={{ minHeight: "100%" }}>');
rep('        {section === "network" && <NetworkView projects={projects.data ?? []} query={route.query} />}', '        {section === "network" && <NetworkView projects={projects.data ?? []} query={route.query} />}\n        {section === "primitives" && <PrimitivesView />}\n        </div>\n        </Suspense>');
rep('settings: "Settings", diagnostics: "Diagnostics", system: "System", agents: "Agents", network: "Network" };', 'settings: "Settings", diagnostics: "Diagnostics", system: "System", agents: "Agents", network: "Network", primitives: "Primitives" };');
fs.writeFileSync(file, s);
console.log("App.tsx updated");
