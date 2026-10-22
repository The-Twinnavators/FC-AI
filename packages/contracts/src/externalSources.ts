/**
 * External component sources: websites and repositories outside FlowCode's own library that its agents may learn
 * from. Each carries the owner's license decision, and only an "allowed" source ever reaches an agent: its components
 * are adapted (rewritten in FlowCode's own React and tokens, with the source's notice kept), never copied. Many
 * component sites forbid redistribution or AI use in their terms, so a link added by hand starts as "check" and the
 * owner decides. The list starts from the sources whose licenses were checked (docs/component-library-sources.md).
 */
export type ExternalLicense = "allowed" | "inspiration" | "not-allowed" | "check";

export interface ExternalSource {
  id: string;
  name: string;
  url: string;
  license: ExternalLicense;
  /** The license and what it covers, in plain words. */
  terms: string;
  /** What FlowCode can take from it. */
  use: string;
  addedBy: "flowcode" | "you";
  addedAt: string;
}

export const EXTERNAL_LICENSES: Array<{ id: ExternalLicense; label: string; what: string }> = [
  { id: "allowed", label: "Allowed", what: "Agents may adapt its components, rewritten in FlowCode's code, keeping its notice" },
  { id: "inspiration", label: "Look only", what: "Agents may study how it looks; nothing from it is copied or rewritten" },
  { id: "check", label: "Needs a license check", what: "Not used until you set its license" },
  { id: "not-allowed", label: "Not allowed", what: "Its terms forbid this use; agents never use it" },
];

const S = (id: string, name: string, url: string, license: ExternalLicense, terms: string, use: string): ExternalSource => ({ id, name, url, license, terms, use, addedBy: "flowcode", addedAt: "2026-10-22" });

/** The sources already checked (licenses as read on their own LICENSE files and terms pages). */
export const DEFAULT_EXTERNAL_SOURCES: ExternalSource[] = [
  S("hyperui", "HyperUI", "https://github.com/markmead/hyperui", "allowed", "MIT (Mark Mead)", "Application, marketing and ecommerce components"),
  S("meraki-ui", "Meraki UI components", "https://merakiui.com/components", "allowed", "MIT (Khatab Wedaa); components only, not its site templates", "Components (RTL-ready)"),
  S("tailblocks", "Tailblocks", "https://github.com/mertJF/tailblocks", "allowed", "MIT (Mert Cukuren)", "Page sections"),
  S("tailadmin-free", "TailAdmin free edition", "https://github.com/TailAdmin/tailadmin-free-tailwind-dashboard-template", "allowed", "MIT (TailAdmin); the free repo only", "Dashboard, calendar, profile and widget patterns"),
  S("tailgrids-repo", "TailGrids (open-source repo)", "https://github.com/TailGrids/tailgrids", "allowed", "MIT (Tailgrids); the GitHub repo only", "Core components: inputs, menus, overlays"),
  S("flowbite-mit", "Flowbite library", "https://github.com/themesberg/flowbite", "allowed", "MIT (Bergside Inc.); the MIT repo only", "Components"),
  S("shadcn-ui", "shadcn/ui", "https://github.com/shadcn-ui/ui", "allowed", "MIT (shadcn); the official repo only", "App shells, sidebars, dashboards, data tables"),
  S("tremor", "Tremor", "https://github.com/tremorlabs/tremor", "allowed", "Apache-2.0 (state changes, keep notices)", "Dashboard, table and chart patterns"),
  S("creative-tim-ui", "Creative Tim UI", "https://github.com/creativetimofficial/ui", "allowed", "MIT (Creative Tim); free blocks", "Account, settings and app blocks"),
  S("astrowind", "AstroWind", "https://github.com/onwidget/astrowind", "allowed", "MIT (onWidget)", "Marketing sections"),
  S("landwind", "Landwind", "https://github.com/themesberg/landwind", "allowed", "MIT (Themesberg)", "Landing page sections"),
  S("daisyui", "daisyUI", "https://github.com/saadeghi/daisyui", "allowed", "MIT", "Component looks"),
  S("scroll-craft", "scroll-craft", "https://github.com/nateherkai/scroll-craft", "allowed", "MIT", "Scroll-driven marketing techniques (pinned sections, rails)"),
  S("html5up", "HTML5 UP", "https://html5up.net", "allowed", "CC BY 3.0: credit required in FlowCode and in each prototype", "Site layouts"),
  S("getnextjstemplates", "getnextjstemplates.com (free repos)", "https://github.com/wrappixel", "check", "Paid templates not allowed; free ones live on GitHub, each repo's LICENSE to check", "Next.js templates, once a repo is checked"),
  S("sweet-tape", "Sweet Tape", "https://sweet-tape.com", "inspiration", "All rights reserved (a brand's marketing site)", "Pacing, imagery and type, as reference only"),
  S("21st-dev", "21st.dev marketplace", "https://21st.dev", "not-allowed", "Terms forbid redistribution, scraping and AI use without written consent", "Use the MIT source repos behind its components instead"),
  S("flowbite-pro", "Flowbite Blocks and Pro", "https://flowbite.com/blocks", "not-allowed", "EULA forbids redistribution and website-builder use", "Nothing"),
  S("tailgrids-premium", "TailGrids blocks and templates", "https://tailgrids.com/blocks", "not-allowed", "Site license forbids website builders and AI generators", "Nothing (the open-source repo is allowed)"),
  S("tailadmin-pro", "TailAdmin Pro components", "https://tailadmin.com/components", "not-allowed", "Not valid for SaaS end products; no redistribution", "Nothing (the free repo is allowed)"),
  S("getlayers", "GetLayers", "https://www.getlayers.ai", "not-allowed", "Paid commercial license for your own sites; no redistribution in another product", "Nothing"),
  S("react-bits", "React Bits", "https://reactbits.dev", "not-allowed", "MIT + Commons Clause: no redistributing the components", "Nothing"),
  S("preline", "Preline", "https://preline.co", "not-allowed", "Fair Use License", "Nothing"),
  S("shuffle", "Shuffle", "https://shuffle.dev", "not-allowed", "Terms forbid bundling into a generator", "Nothing"),
  S("themewagon", "ThemeWagon", "https://themewagon.com", "not-allowed", "Terms forbid redistribution", "Nothing"),
  S("magicpattern", "MagicPattern", "https://www.magicpattern.design", "not-allowed", "Terms forbid commercial reuse and AI training without permission", "Nothing"),
];
