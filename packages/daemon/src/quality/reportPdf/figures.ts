/**
 * One glyph per report section, drawn inline (the PDF renders with no network, where an icon font prints as an empty
 * box). The paths are the app's own Icon set from apps/ui/src/components/ui.tsx where it has one, on the same 24-unit
 * grid and stroke, so the report's sections look like the screens they came from.
 */
import { ACCENT_ON_LIGHT } from "../reportBrand.js";

const GLYPHS: Record<string, string> = {
  checklist: "M10 6h10M10 12h10M10 18h10M3.5 6l1.5 1.5L7.5 5M3.5 12l1.5 1.5 2.5-2.5M4 18h3",
  reports: "M6 3h9l4 4v14H6zM14 3v5h5M9 13h7M9 17h7",
  diagnostics: "M3 12h4l3-8 4 16 3-8h4",
  code: "M8 17 3 12l5-5m8 0 5 5-5 5m-2-13-4 16",
  lock: "M5 11V8a7 7 0 0 1 14 0v3M4 11h16v10H4V11Zm8 4v3",
  a11y: "M12 4a1.5 1.5 0 1 0 0 .01M5 8l7 1.5L19 8M12 9.5V14M12 14l-3 6M12 14l3 6",
  search: "M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM20 20l-4-4",
  quality: "M12 3 4 6v6c0 4.5 3.4 8.3 8 9 4.6-.7 8-4.5 8-9V6zM8.5 12l2.5 2.5 4.5-5",
  layers: "M12 3 3 8l9 5 9-5zM3 13l9 5 9-5M3 17.5l9 5 9-5",
  server: "M4 4h16v6H4zM4 14h16v6H4zM8 7h.01M8 17h.01",
  // FlowReport's sections that have no screen of their own in the app (its glyphs, on the same grid).
  warning: "M12 3 2 21h20L12 3Zm0 6v5m0 3.2v.1",
  bars: "M4 20V9m5 11V4m5 16v-7m5 7V7",
  money: "M12 2v20M17 6H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6",
  bag: "M3 9h18l-2 11H5L3 9Zm4 0V6a5 5 0 0 1 10 0v3",
  people: "M4 20a5 5 0 0 1 10 0M9 4a4 4 0 1 0 0 8 4 4 0 0 0 0-8Zm8 16a5 5 0 0 0-3-4.6",
  compare: "M4 12h6m4 0h6M9 7l-5 5 5 5m6-10 5 5-5 5",
  target: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm0-5a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z",
  link: "M9 15l6-6M10 6l1-1a4 4 0 0 1 6 6l-1 1M14 18l-1 1a4 4 0 0 1-6-6l1-1",
  check: "m20 6-11 11-5-5",
};

/** The glyph for each section id the two reports use. */
const SECTION_GLYPH: Record<string, string> = {
  build: "checklist",
  spec: "reports",
  errors: "diagnostics",
  engineering: "code",
  security: "lock",
  a11y: "a11y",
  accessibility: "a11y",
  seo: "search",
  compliance: "quality",
  privacy: "quality",
  design: "layers",
  data: "server",
  // FlowReport's categories.
  error_log: "warning",
  product_intel: "bars",
  engineering_quality: "code",
  monetization: "money",
  marketplace_health: "bag",
  role_journeys: "people",
  competitive_gaps: "compare",
  security_qa: "lock",
  marketing_opportunity: "target",
  data_architecture: "server",
  cross_domain: "link",
  action_plan: "check",
};

/** Empty string for an unknown section, so a caller can interpolate it without checking. */
export function sectionIcon(sectionId: string, sizeMm = 4.6, colour = ACCENT_ON_LIGHT): string {
  const d = GLYPHS[SECTION_GLYPH[sectionId] ?? ""];
  if (!d) return "";
  return `<svg viewBox="0 0 24 24" width="${sizeMm}mm" height="${sizeMm}mm" fill="none" stroke="${colour}" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${d}"/></svg>`;
}
