/**
 * Home page concepts for a look-up app: a few deliberately different directions the person chooses from before the
 * rest of the app is designed. Each is a design spec (designSpec.ts) whose Home is one of the library's full-page
 * designs made for look-up apps (lookup-home-listings) and whose look comes from bundled fonts, a
 * WCAG-checked palette and a surface style, so FlowCode renders it without a coder step. The person's pick becomes the
 * spec for the build; nothing is chosen for them.
 *
 * Clean Cart evals 1-3: every build had the same Home (search opening, ZIP prompt, category tiles, a card grid) and only
 * its colours differed, so there was never a direction to choose.
 *
 * One fixed starting point now (the storefront and magazine Home pages were dropped on 21 October 2026, never
 * approved); agent-led design proofs (orchestrator/designProofs.ts) are the tailored alternative.
 */
import type { DesignSpec } from "./designSpec.js";

const internal = (ref: string) => [{ kind: "internal" as const, ref, confidence: "high" as const }];

export const HOME_CONCEPTS: DesignSpec[] = [
  {
    version: 1,
    id: "concept-bold",
    name: "Bold aisle",
    thesis: "Find it fast: the library's listings design, with a search hero, real counts as proof points, sortable listings, the stores near you and the ZIP code; flat surfaces on a light yellow ground.",
    typography: { display: "Oswald", body: "DM Sans", scale: "compact", headingWeight: 600, headingCase: "normal" },
    palette: {
      bg: "#fff8dc", surface: "#ffffff", surfaceSunken: "#fbefc0", text: "#111111", textMuted: "#3d3d3d",
      border: "#e6dcb4", borderStrong: "#8a7f55", accent: "#1d4ed8", accentHover: "#1e40af", onAccent: "#ffffff", secondary: "#be123c",
    },
    density: "compact",
    // Flat (FlowCode's default): fine borders and modest corners, not the neo-brutalist outlines it first had.
    surface: { vibe: "flat", radii: [4, 6, 8, 8], borderWidth: 1 },
    composition: { contentWidth: "wide", changes: [], home: { design: "listings", hero: "search", categories: "tiles", list: "grid", order: ["zip", "featured", "categories"] } },
    signature: "",
    responsive: [],
    sources: internal("Home concept: bold aisle"),
  },
];
