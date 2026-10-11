# Semantic Composition Catalog — audit, schema, pilot

Pre-implementation deliverable for the brief: turn the component library into a catalog the
agent can use to plan and assemble pages by user intent. Nothing in the library or the
orchestrator is edited until the pilot scope below is agreed.

---

## 1. Audit

Measured against `packages/contracts/src/sectionLibrary.ts`, `templates/library/sections/`,
`templates/layouts/` and `templates/ui-gallery.json`.

### What exists

| Proposed tier | Source today | Count |
| --- | --- | --- |
| `fc_pt` page template | library: `homepages`, `landings`, `sites`, `apptemplates` | 30 |
| `fc_pt` page template | `templates/layouts/*.tsx` — **not in the library** | 12 |
| `fc_pb` page block | library: `navigation`, `hero`, `features`, `stats`, `pricing`, `testimonials`, `faq`, `cta`, `team`, `contact`, `newsletter`, `blog`, `footer`, `commerce`, `backgrounds` | 47 |
| `fc_pa` / `fc_co` | library: `auth`, `forms`, `tables`, `cards`, `dialogs`, `alerts`, `data`, `wayfinding`, `neobrutal` | 65 |
| `fc_pr` primitive | `templates/ui-gallery.json` → `src/components/ui` | 24 |
| reference, not a build tier | specimens | 34 |

176 library entries + 12 layouts + 24 primitives.

### Findings

**F1 — Source references already resolve.** All 176 entries have a real file and a named
export (0 missing, 0 unnamed). The schema's source/export field is derivable from the repo;
it does not need authoring and must not be invented.

**F2 — `category` is topical, not structural.** It records what a piece is *about*, never
what it *is*. `forms` holds both a real sign-up form and the `chips-tags` specimen; `cards`
holds a product card and a card state matrix. This is the direct cause of the failure that
prompted the brief: `screenPicks` scored a specimen like a section and seeded a "Brands"
screen with a chip state matrix. A structural tier is the missing field.

**F3 — Size corroborates the tiers independently.** Median bytes: page block 2,217 · 
pattern/component 8,182 · specimen 7,856 · page template 22,542. A page template is ~10× a
block. The tiering is a real distinction in the material, not a label imposed on it.

**F4 — Intent metadata already exists.** Every entry has `useCases` and `jobs` ("find my way
around the site", "start a free trial"). These are the beginning of *use when* and the basis
for intent-first search. They are uneven in quality and unvalidated, but they are not nothing.

**F5 — Page templates live in two places.** 30 in the library, 12 in `templates/layouts/`,
which the Component library never displays. Builds draw screens from the second collection,
so users cannot see what their screens are made from. Unifying these under `fc_pt` is part of
the work.

**F6 — The 65 pattern/component entries are the only real classification judgement.** Tier for
the other 111 is mechanical (category group + the `specimen` flag already in the data).
Splitting pattern from component needs a definition and a human pass.

**F7 — No slot or composition data exists anywhere.** No entry declares what it contains, what
may sit inside it, or what it must sit beside. This is wholly new metadata and is the part the
brief depends on most.

**F8 — Placement is FlowCode's decision, not the model's.** `screenPicks` ranks by keyword fit,
takes the top 1–2, and `layoutStep` writes them into the screen. A guard then *requires* the
design step to keep them. Any composition logic must replace this path, not sit beside it.

---

## 2. Schema proposal

A new `CatalogItem`, additive to `LibrarySection`. Existing fields are kept and reused;
nothing is rewritten to start.

The catalog is read in two passes, because all 176 entries'' description + useCases + jobs come
to 61,000 characters (~15k tokens) and `reuseBrief` truncates at 1,600. The index is what the
planner searches; the contract is fetched only for the shortlist.

```ts
type Tier = "fc_pt" | "fc_pb" | "fc_pa" | "fc_co" | "fc_pr";
type Status = "active" | "draft" | "deprecated" | "reference";

/** Pass 1: searched for every screen. Keep each entry under ~150 characters. */
interface CatalogIndexEntry {
  catalogId: string;          // fc_pb_014
  tier: Tier;
  name: string;
  purpose: string;            // one sentence, what it does for the person using the page
  jobs: string[];             // "find my way around the site" - matched against the screen goal
}

/** Pass 2: fetched for shortlisted items only. */
interface CatalogItem extends CatalogIndexEntry {
  slug: string;               // hero-split, matches the file
  status: Status;             // specimens are "reference": browsable, never composable
  version: string;            // bumped when the contract changes, not when styling does

  structure: string;          // arrangement only - "promise and actions beside a picture".
                              // No colour, font or theme words: a lint rule rejects them, so a
                              // theme can never define functional identity.
  behavior?: string;          // what it does when used: chips toggle and update a count; a
                              // wizard keeps state across steps. REQUIRED for fc_pa and for
                              // any item declaring states.
  useCases: string[];         // where it belongs: "site header", "landing page header"
  avoidWhen: string[];        // required for fc_pt and fc_pb - prevents out-of-context reuse

  slots?: Slot[];             // named regions this item exposes (fc_pt, fc_pb)
  fitsIn?: Tier[];
  pairsWith?: string[];
  maxPerScreen?: number;      // one nav, one hero

  content: { required: string[]; optional: string[] };
  variants?: string[];
  states?: string[];
  responsive: string;         // what changes below 768px
  a11y: string[];

  source: { file: string; export: string };   // GENERATED from the repo, asserted by a test
  preview: { id: string };                    // GENERATED
  verify: string[];
}

interface Slot {
  name: string;               // "header" | "body" | "aside" | "footer"
  accepts: Tier[];
  required: boolean;
  max?: number;
}
```
### Decisions embedded in this schema

- **Tier is separate from category.** Category stays as the topical axis and keeps powering
  the Component library's shelves. Tier is the new structural axis. Search uses both.
- **Specimens get `status: "reference"`** rather than a tier. They remain browsable and are
  structurally incapable of being composed, which is stronger than the current exclusion flag.
- **`source` and `preview` are generated**, asserted against the repo by a test. They cannot
  drift and cannot be invented.
- **Themes are not in this schema.** Design tokens and preview styles stay where they are, so
  a theme cannot alter functional identity.
- **`useWhen` is not a field.** It would duplicate `useCases`, and three overlapping intent fields authored at different times drift until the planner gets contradictory signals.
- **`avoidWhen` is mandatory for `fc_pt` and `fc_pb`.** Out-of-context reuse is the failure
  this exists to prevent; the field that prevents it cannot be optional.

---

## 3. Pilot scope

Three page types, chosen because they exercise different composition shapes and all three
already exist in the library:

1. **A list/browse screen** (the "Brands" case that failed) — header, filter, list, empty state.
2. **A sign-in screen** — one centred pattern, no blocks, minimal composition.
3. **A marketing landing page** — many blocks in a deliberate order.

Catalogued for the pilot: roughly **24 items** — the blocks and patterns those three screens
need, plus the primitives they rest on. Not 176. The brief's instruction holds: do not rewrite
every entry before the approach is validated.

Deliberately out of scope for the pilot: the pattern/component split across all 65 (F6), the
`templates/layouts` merge (F5), and replacing `screenPicks` in production.

---

## 4. Expected files

**New**

- `packages/contracts/src/catalog.ts` — `CatalogItem`, `Tier`, `Slot`, `Status`.
- `packages/contracts/src/catalogData.ts` — the pilot's ~24 entries.
- `packages/daemon/src/orchestrator/catalogSearch.ts` — compact index + retrieval by id.
- `packages/daemon/src/orchestrator/composition.ts` — layout plan → composition manifest.
- `scripts/catalog-audit.mjs` — regenerates `source`/`preview` and fails on drift.
- `packages/daemon/test/catalog-schema.test.ts` — every entry resolves; required fields present.
- `packages/daemon/test/composition.test.ts` — the three pilot pages compose correctly.

**Changed**

- `packages/contracts/src/sectionLibrary.ts` — carries `catalogId` per entry; nothing removed.
- `packages/daemon/src/orchestrator/screenPicks.ts` — consults the catalog when an entry has
  one, falls back to today's scoring when it does not. Both paths live during the pilot.

**Not changed in the pilot**

- `templates/library/sections/*` — no component source is touched.
- The Component library view — specimens keep showing; they gain a "reference" label later.

---

## 5. Evaluation plan

The pilot passes only if all of these hold.

| # | Check | How it is measured |
| --- | --- | --- |
| E1 | Selection starts from intent, not similarity | The manifest for each pilot page cites `purpose`/`useWhen` per item; no item is chosen on tag overlap alone |
| E2 | Retrieval by id and discovery by purpose both work | Unit test: `byId("fc_pb_014")` and `search("let someone filter a list")` both return expected items |
| E3 | Plans explain themselves | Every manifest entry has a rationale naming the slot it fills and the requirement it serves |
| E4 | Implementation references resolve | `catalog-audit.mjs` asserts every `source.file`/`source.export` exists; fails the build otherwise |
| E5 | No out-of-context reuse | A specimen or an `avoidWhen` violation in a manifest is a hard failure, tested |
| E6 | Themes do not change behaviour | The same manifest under two design templates produces the same structure |
| E7 | Composition beats today's picker | The three pilot pages are built both ways; the catalog path produces a correctly structured screen where the current picker does not |
| E8 | Honest gaps | Any item the pilot could not classify or verify is listed, not silently defaulted |

**E7 is the one that matters.** The "Brands" screen is the control: today's picker seeds it with
a chip state matrix. The pilot passes if the catalog path produces header → filter → list →
empty state from items whose `purpose` matches the screen's goal.

---

## 6. Risks

- **Description quality is the whole system.** `useWhen`/`avoidWhen` are what the planner reads.
  Twenty-four good entries beat 176 vague ones, which is why the pilot is small.
- **Two selection paths during the pilot.** Mitigated by the fallback being explicit and by E7
  comparing them directly on the same pages.
- **Slot data is new (F7)** and has no existing source. It is the most likely thing to be wrong
  in the first schema, which is why the brief's "expand only after the pilot exposes schema
  problems" is right.
- **This does not address model capability.** A coder that cannot keep a 30B model resident will
  still stall. The catalog makes the *instructions* unambiguous; it does not make the model able
  to follow them.
