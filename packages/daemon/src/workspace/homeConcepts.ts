/**
 * Home page concepts for a look-up app: a few deliberately different directions the person chooses from before the
 * rest of the app is designed. Each is a design spec (designSpec.ts) whose Home is one of the library's full-page
 * designs made for look-up apps (lookup-home-storefront, -magazine, -listings) and whose look comes from bundled fonts, a
 * WCAG-checked palette and a surface style, so FlowCode renders it without a coder step. The person's pick becomes the
 * spec for the build; nothing is chosen for them.
 *
 * Clean Cart evals 1-3: every build had the same Home (search opening, ZIP prompt, category tiles, a card grid) and only
 * its colours differed, so there was never a direction to choose.
 *
 * For now these three are fixed, contrasting starting points; tailoring them to a PRD, a selected style or research
 * comes later.
 */
import type { DesignSpec } from "./designSpec.js";

const internal = (ref: string) => [{ kind: "internal" as const, ref, confidence: "high" as const }];

export const HOME_CONCEPTS: DesignSpec[] = [
  {
    version: 1,
    id: "concept-editorial",
    name: "Editorial",
    thesis: "A calm front page: the library's magazine design, with a sticky side column (search, sections, most liked, saved), the most liked product as the cover story, sections and a feed.",
    typography: { display: "Playfair Display", body: "Literata", scale: "expressive", headingWeight: 700, headingCase: "normal" },
    palette: {
      bg: "#f6f1e7", surface: "#fffdf8", surfaceSunken: "#ece4d4", text: "#2a2118", textMuted: "#5f5446",
      border: "#ddd2bf", borderStrong: "#8c7f6c", accent: "#7a3b1e", accentHover: "#5f2c14", onAccent: "#ffffff", secondary: "#3f5a3c",
    },
    density: "airy",
    surface: { vibe: "flat", radii: [2, 2, 4, 4], borderWidth: 1 },
    composition: { contentWidth: "wide", changes: [], home: { design: "magazine", hero: "centered", categories: "chips", list: "rows", order: ["featured", "categories", "zip"] } },
    signature: "",
    responsive: [],
    sources: internal("Home concept: editorial"),
  },
  {
    version: 1,
    id: "concept-market",
    name: "Market hall",
    thesis: "A friendly shop: the library's storefront design, with a bold promo banner, category tabs and a grid of products to save.",
    typography: { display: "Fraunces", body: "Work Sans", scale: "regular", headingWeight: 600, headingCase: "normal" },
    palette: {
      bg: "#f3f7f1", surface: "#ffffff", surfaceSunken: "#e3ecdf", text: "#14251a", textMuted: "#4d5e52",
      border: "#cfdcca", borderStrong: "#7d8f80", accent: "#1f6f43", accentHover: "#175735", onAccent: "#ffffff", secondary: "#b4532a",
    },
    density: "regular",
    surface: { vibe: "flat", radii: [6, 8, 12, 12], borderWidth: 1 },
    composition: { contentWidth: "wide", changes: [], home: { design: "storefront", hero: "split", categories: "rail", list: "grid", order: ["categories", "featured", "zip"] } },
    signature: "",
    responsive: [],
    sources: internal("Home concept: market hall"),
  },
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
