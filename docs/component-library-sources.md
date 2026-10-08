# Component library: sources and licences

FlowCode's component library and industry templates are written in FlowCode's own React + design-token CSS. These
third-party sources are reference material for that conversion. Their originals are kept in `.vendor-sources/` (not
committed, not shipped); every converted item keeps its source's licence notice, and HTML5 UP items keep the credit.

## Allowed

| Source | Licence | Use | Condition |
|---|---|---|---|
| Open Props (`open-props` on npm) | MIT | Design tokens: spacing, type, shadows, easing | Keep the MIT notice |
| Meraki UI (`github.com/merakiuilabs/merakiui`) | MIT | Components (RTL-ready) | Keep the MIT notice |
| daisyUI (`daisyui` on npm) | MIT | Components and theme roles | Keep the MIT notice |
| Tailblocks (`github.com/mertJF/tailblocks`) | MIT | Page sections | Keep the MIT notice |
| HTML5 UP (`html5up.net`) | CC BY 3.0 | Industry templates | Credit "HTML5 UP" in FlowCode and in each prototype built from one |
| AstroWind (`github.com/arthelokyo/astrowind`) | MIT | 37 composable sections; six landing pages | Keep the MIT notice |
| Landwind (`github.com/themesberg/landwind`) | MIT | SaaS / product landing template | Keep the MIT notice |
| Creative Tim UI blocks (`github.com/creativetimofficial/ui`) | MIT | React + shadcn/ui page sections | Free blocks in the repo only; PRO blocks are paid and not allowed. Keep the MIT notice and those of shadcn/ui, Material Tailwind and Geist |
| Creative Tim, UIdeck, TailAwesome, Windy Toolbox listings, GitHub topic `tailwind-template` | Per repo | Templates | Only repos with an MIT (or similar) licence file; a repo with no licence is all rights reserved |

## Not allowed

| Source | Why |
|---|---|
| Shuffle (`shuffle.dev`) | Licence: no use in "generators" / UI libraries, no redistribution, no new component library |
| UIdeck site templates | Free: personal use only. Paid: no resale or redistribution |
| ThemeWagon | Licence excludes derivative themes and "generators" |
| Preline UI and templates | Its Fair Use License forbids general-purpose reusable component systems and competing products. A person may connect Preline's own MCP or import its skills into their own FlowCode with their own Preline licence, but FlowCode must not ship them |
| Meraki UI templates (site) | Paid, or no licence stated (so all rights reserved) |

Checked 2026-10-08 against each site's licence page or repository. Not legal advice; re-check a source before adding
more of it if its terms may have changed.
