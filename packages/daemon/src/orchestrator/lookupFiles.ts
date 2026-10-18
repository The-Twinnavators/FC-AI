/**
 * "Complete app" builds of a look-up app (find it and where to get it): the app written from its app model without the
 * model writing code. Beside the schema, sample records and the one store (as appFiles writes for every app), the
 * look-up layer (places near a ZIP code, which places carry what, likes, saves, ratings and lists), the routes, a screen
 * per destination built from the library's look-up pieces (catalog, entry page, place finder, list builder), and the
 * look-up frame (a top bar with search and the ZIP code; a bottom bar on phones). The landing page is a starting point the
 * design step composes; custom pages are left for the design and feature steps.
 */
import type { AppModel, ModelView } from "./appModel.js";

/** The library pieces a look-up app is built from (their data layers and icons come with them). */
export const LOOKUP_PIECES = ["lookup-frame", "lookup-catalog", "lookup-entry", "place-finder", "list-builder"];

/**
 * How the Home page is composed, from the library's own layouts: the opening (the look-up hero with its search, the
 * library's centered hero with the search under it, or its split hero with the most liked entry beside the promise),
 * the categories (tiles, chips or a sideways rail), the most liked entries (a grid of cards or wide rows) and the order
 * of the sections under the opening. A design concept chooses one; the person picks the concept.
 */
export interface HomeLayout {
  /**
   * A whole Home page from the library's full-page designs, made for look-up apps (lookup-home-<design>.tsx: the
   * storefront, magazine and listings pages, filled from the app's data). When set, it is the page; the parts below
   * describe the composed page used without one.
   */
  design?: "storefront" | "magazine" | "listings";
  hero: "search" | "centered" | "split";
  categories: "tiles" | "chips" | "rail";
  list: "grid" | "rows";
  order: Array<"zip" | "categories" | "featured">;
}
export const DEFAULT_HOME: HomeLayout = { hero: "search", categories: "tiles", list: "grid", order: ["zip", "categories", "featured"] };
/** The library heroes a Home layout uses, beside the look-up pieces. */
export const homePieces = (h?: HomeLayout) => (h?.design ? [`lookup-home-${h.design}`] : h?.hero === "centered" ? ["hero-centered"] : h?.hero === "split" ? ["hero-split"] : []);
/** Whether the Home page has its own search (then the top bar leaves its search out there). Every full-page design does. */
const heroSearches = (h: HomeLayout) => Boolean(h.design) || h.hero !== "split";
const DESIGN_COMPONENT = { storefront: "LookupHomeStorefront", magazine: "LookupHomeMagazine", listings: "LookupHomeListings" } as const;

const pascal = (id: string) => id.split(/[^a-zA-Z0-9]+/).filter(Boolean).map((w) => w[0]!.toUpperCase() + w.slice(1)).join("");
const q = (s: string) => JSON.stringify(s);
const attr = (s: string) => `{${JSON.stringify(s)}}`;
const commentSafe = (s: string) => s.replace(/\*\//g, "* /").replace(/[\r\n\u2028\u2029]+/g, " ");

/** The look-up destinations a page links to. */
function routesOf(m: AppModel) {
  const all = m.nav.flatMap((g) => g.items);
  const of = (k: ModelView["kind"]) => all.find((v) => v.kind === k)?.id;
  return { landing: of("landing"), catalog: of("catalog"), categories: of("categories"), entry: of("entry"), places: of("places"), lists: of("lists"), mylist: of("mylist"), saved: of("saved") };
}

/** One look-up screen's source, or undefined for a kind appFiles writes (custom). */
export function lookupScreenSource(m: AppModel, v: ModelView): string | undefined {
  const l = m.lookup!;
  const r = routesOf(m);
  const name = `${pascal(v.id)}Screen`;
  const head = `/**\n * ${commentSafe(v.label)}${v.purpose ? `: ${commentSafe(v.purpose)}` : ""}\n * Built by FlowCode from the app model; it reads and writes the app's store and look-up layer (src/app/).\n */`;
  const imports = `import { go } from "../app/routes";\nimport { lookup } from "../app/lookup";`;
  // The catalog's own filter and search stay on the catalog: the address changes, but it isn't a new page.
  const catalogImports = `import { go, update } from "../app/routes";\nimport { lookup } from "../app/lookup";`;
  const onCatalog = (arg: string) => (r.catalog ? `update(${q(r.catalog)}, ${arg})` : "undefined");
  const open = r.entry ? `(id) => go(${q(r.entry)}, id)` : "undefined";
  const tags = l.tagsField ? ` tagsField=${attr(l.tagsField)}` : "";
  const toCatalog = (arg: string) => (r.catalog ? `go(${q(r.catalog)}, ${arg})` : "undefined");
  const catalogProps = [
    l.badgeField ? ` badgeField=${attr(l.badgeField)}` : "",
    l.tagsField ? ` tagsField=${attr(l.tagsField)}` : "",
    l.facets.length ? ` facets={${JSON.stringify(l.facets)}}` : "",
  ].join("");
  switch (v.kind) {
    case "catalog":
      // The address carries a category (#/<catalog>/<category>) or a search (#/<catalog>/q=<words>).
      // One catalog for every category and search (no remount): what you were using keeps focus as the results change.
      return `${head}\nimport { LookupCatalog } from "../sections/LookupCatalog";\nimport { useHashId } from "../sections/AppData";\n${v.id === r.catalog ? catalogImports : imports}\n\nexport default function ${name}() {\n  const arg = useHashId(${q(v.id)});\n  const query = arg?.startsWith("q=") ? arg.slice(2) : undefined;\n  const category = arg && !query ? arg : undefined;\n  return (\n    <LookupCatalog\n      lookup={lookup}\n      title=${attr(v.label)}${v.purpose ? `\n      description=${attr(v.purpose)}` : ""}\n      category={category}\n      query={query}\n      onOpen={${open}}\n      onCategory={(c) => ${v.id === r.catalog ? onCatalog("c") : toCatalog("c")}}\n      onSearch={(s) => ${v.id === r.catalog ? onCatalog('`q=${s}`') : toCatalog('`q=${s}`')}}${catalogProps}\n    />\n  );\n}\n`;
    case "categories":
      return `${head}\nimport { CategoryIndex } from "../sections/LookupCatalog";\n${imports}\n\nexport default function ${name}() {\n  return <CategoryIndex lookup={lookup}${v.purpose ? ` description=${attr(v.purpose)}` : ""} onCategory={(c) => ${toCatalog("c")}} />;\n}\n`;
    case "saved":
      return `${head}\nimport { LookupCatalog } from "../sections/LookupCatalog";\nimport { useLookup } from "../sections/LookupData";\n${imports}\n\nexport default function ${name}() {\n  const { saved } = useLookup(lookup);\n  return (\n    <LookupCatalog\n      lookup={lookup}\n      title=${attr(v.label)}\n      only={saved}\n      empty={{ title: "Nothing saved yet", text: "Tap the heart on anything to keep it here."${r.catalog ? `, action: { label: "Browse", onClick: () => go(${q(r.catalog)}) }` : ""} }}\n      onOpen={${open}}${catalogProps}\n    />\n  );\n}\n`;
    case "entry":
      return `${head}\nimport { LookupEntry } from "../sections/LookupEntry";\nimport { useHashId } from "../sections/AppData";\n${imports}\n\nexport default function ${name}() {\n  const id = useHashId(${q(v.id)}) ?? "";\n  return (\n    <LookupEntry\n      lookup={lookup}\n      id={id}\n      shareScreen=${attr(v.id)}${r.catalog ? `\n      onBack={() => go(${q(r.catalog)})}` : ""}${r.places ? `\n      onOpenPlace={() => go(${q(r.places)})}` : ""}${r.mylist ? `\n      onOpenList={(list) => go(${q(r.mylist)}, list)}` : ""}${l.detailFields.length ? `\n      detailFields={${JSON.stringify(l.detailFields)}}` : ""}${l.badgeField ? `\n      badgeField=${attr(l.badgeField)}` : ""}\n    />\n  );\n}\n`;
    case "places":
      return `${head}\nimport { PlaceFinder } from "../sections/PlaceFinder";\n${imports}\n\nexport default function ${name}() {\n  void go;\n  return <PlaceFinder lookup={lookup} title=${attr(v.label)}${v.purpose ? ` description=${attr(v.purpose)}` : ""} />;\n}\n`;
    case "lists":
      return `${head}\nimport { ListIndex } from "../sections/ListBuilder";\n${imports}\n\nexport default function ${name}() {\n  return <ListIndex lookup={lookup} title=${attr(v.label)} onOpen={(id) => ${r.mylist ? `go(${q(r.mylist)}, id)` : "void id"}} />;\n}\n`;
    case "mylist":
      return `${head}\nimport { ListBuilder } from "../sections/ListBuilder";\nimport { useHashId } from "../sections/AppData";\n${imports}\n\nexport default function ${name}() {\n  const id = useHashId(${q(v.id)}) ?? "";\n  return <ListBuilder lookup={lookup} id={id}${r.lists ? ` onBack={() => go(${q(r.lists)})}` : ""} onOpenEntry={${open}} />;\n}\n`;
    case "landing": {
      if (m.home) return landingSource(m, v, m.home, { head, imports, open, tags, catalogProps, toCatalog, catalog: r.catalog });
      // A working start the design step composes into the product's landing page: the promise, search, the ZIP code,
      // the categories and the most liked entries, all on the same data.
      return `${head}\nimport { CatalogSearch, CategoryIndex, LookupCatalog } from "../sections/LookupCatalog";\nimport { ZipPrompt } from "../sections/PlaceFinder";\n${imports}\n\nexport default function ${name}() {\n  return (\n    <div className="fl-lkf-stack">\n      {/* 1. Hero: ${commentSafe(m.product)}, its promise and the search (design step: compose this from the PRD's words) */}\n      <section className="fl-lkf-hero" aria-labelledby="landing-title">\n        <h1 id="landing-title">{${q(m.product)}}</h1>\n        ${v.purpose ? `<p>{${q(v.purpose)}}</p>` : ""}\n        <CatalogSearch lookup={lookup}${tags} onSearch={(s) => ${toCatalog('`q=${s}`')}} onOpen={${open}} />\n      </section>\n      {/* 2. Where to find it: the ZIP code */}\n      <ZipPrompt lookup={lookup} />\n      {/* 3. Categories */}\n      <CategoryIndex lookup={lookup} onCategory={(c) => ${toCatalog("c")}} />\n      {/* 4. The most liked */}\n      <LookupCatalog lookup={lookup} title="Most liked" pageSize={8} toolbar={false} onOpen={${open}}${catalogProps} />\n    </div>\n  );\n}\n`;
    }
    default:
      return undefined;
  }
}

/** The Home page composed from a chosen layout: one opening, then the ZIP code, categories and most liked in its order. */
function landingSource(
  m: AppModel,
  v: ModelView,
  h: HomeLayout,
  p: { head: string; imports: string; open: string; tags: string; catalogProps: string; toCatalog: (arg: string) => string; catalog?: string },
): string {
  if (h.design) {
    const name = DESIGN_COMPONENT[h.design];
    const to = (arg: string) => p.toCatalog(arg);
    return `${p.head}
import { ${name} } from "../sections/${pascal(`lookup-home-${h.design}`)}";
${p.imports}

/* Home: the ${h.design} page from the library, filled from the app's data. */
export default function ${pascal(v.id)}Screen() {
  return (
    <${name}
      lookup={lookup}
      product={${q(m.product)}}${v.purpose ? `
      promise={${q(v.purpose)}}` : ""}
      onOpen={${p.open}}
      onCategory={(c) => ${to("c")}}
      onSearch={(s) => ${to("`q=${s}`")}}
      onBrowse={() => ${to("undefined")}}
    />
  );
}
`;
  }
  const browse = p.catalog ? `{ label: "Browse everything", href: ${q(`#/${p.catalog}`)} }` : "undefined";
  const search = `<CatalogSearch lookup={lookup}${p.tags} onSearch={(s) => ${p.toCatalog("`q=${s}`")}} onOpen={${p.open}} />`;
  const lede = q(v.purpose ?? "");
  const hero =
    h.hero === "centered"
      ? `<HeroCentered id="landing" title={${q(m.product)}} lede={${lede}} primary={${browse}} background="grid">\n        <div className="fl-lkf-hero-search">${search}</div>\n      </HeroCentered>`
      : h.hero === "split"
        ? `<HeroSplit id="landing" title={${q(m.product)}} lede={${lede}} primary={${browse}} aside={<LookupSpotlight lookup={lookup} onOpen={${p.open}} />} />`
        : `<section className="fl-lkf-hero" aria-labelledby="landing-title">\n        <h1 id="landing-title">{${q(m.product)}}</h1>\n        ${v.purpose ? `<p>{${lede}}</p>` : ""}\n        ${search}\n      </section>`;
  const parts: Record<HomeLayout["order"][number], string> = {
    zip: `<ZipPrompt lookup={lookup} />`,
    categories: `<CategoryIndex lookup={lookup} layout=${attr(h.categories)} onCategory={(c) => ${p.toCatalog("c")}} />`,
    featured: `<LookupCatalog lookup={lookup} title="Most liked" pageSize={8} toolbar={false} layout=${attr(h.list)} onOpen={${p.open}}${p.catalogProps} />`,
  };
  const order = [...new Set([...h.order, ...DEFAULT_HOME.order])];
  const imports = [
    `import { ${["CategoryIndex", "LookupCatalog", ...(heroSearches(h) ? ["CatalogSearch"] : []), ...(h.hero === "split" ? ["LookupSpotlight"] : [])].sort().join(", ")} } from "../sections/LookupCatalog";`,
    `import { ZipPrompt } from "../sections/PlaceFinder";`,
    ...(h.hero === "centered" ? [`import { HeroCentered } from "../sections/HeroCentered";`] : []),
    ...(h.hero === "split" ? [`import { HeroSplit } from "../sections/HeroSplit";`] : []),
  ].join("\n");
  return `${p.head}\n${imports}\n${p.imports}\n\n/* Home layout: ${h.hero} opening; ${order.join(", ")}; categories as ${h.categories}; most liked as ${h.list}. */\nexport default function ${pascal(v.id)}Screen() {\n  void go;\n  return (\n    <div className="fl-lkf-stack fl-lkf-home fl-lkf-home--${h.hero}">\n      ${hero}\n${order.map((k) => `      ${parts[k]}`).join("\n")}\n    </div>\n  );\n}\n`;
}

/** The look-up layer's config and seed, as src/app/lookup.ts holds them (also what a live concept preview runs on). */
export function lookupData(m: AppModel) {
  const l = m.lookup!;
  return {
    config: { entries: l.entries, places: l.places, categoryField: l.categoryField, placesField: l.placesField, areas: l.areas, placeWord: l.placeWord, carryWord: l.carryWord },
    seed: { ratings: l.ratings, lists: l.lists, likes: l.likes, saves: l.saves },
  };
}

/** The frame's links, as App.tsx holds them. */
export function lookupLinks(m: AppModel, defaultIcon: Record<string, string>) {
  const shown = m.nav.flatMap((g) => g.items).filter((v) => v.kind !== "entry" && v.kind !== "mylist");
  // Saved is the bookmark, as Save is everywhere in the app (the heart is Like), whatever icon the model gave it.
  return shown.map((v) => ({ id: v.id, label: v.label, icon: v.kind === "saved" ? "bookmark" : (v.icon ?? defaultIcon[v.kind] ?? "dot"), ...(v.kind === "placeholder" ? { available: false } : {}), ...(["landing", "catalog", "places", "lists", "saved"].includes(v.kind) ? { mobile: true } : {}) }));
}

/** The look-up layer: places, availability, likes, saves, ratings and lists, beside the store. */
export function lookupFile(m: AppModel): { path: string; content: string } {
  const { config, seed } = lookupData(m);
  return {
    path: "src/app/lookup.ts",
    content: `/** The look-up layer, written by FlowCode from the app model: places near a ZIP code, which places carry what, likes, saves, ratings and lists. */\nimport { createLookup, type LookupConfig, type LookupSeed } from "../sections/LookupData";\nimport { store } from "./store";\n\nexport const config: LookupConfig = ${JSON.stringify(config, null, 2)};\n\nconst seed: LookupSeed = ${JSON.stringify(seed, null, 2)};\n\nexport const lookup = createLookup(store, config, seed);\n`,
  };
}

/** The look-up app's App.tsx: the frame, its places, search, ZIP code, and the page for each destination. */
export function lookupAppSource(m: AppModel, built: ModelView[], defaultIcon: Record<string, string>): string {
  const r = routesOf(m);
  const links = lookupLinks(m, defaultIcon);
  const parent: Record<string, string> = {};
  if (r.entry && r.catalog) parent[r.entry] = r.catalog;
  if (r.mylist && r.lists) parent[r.mylist] = r.lists;
  const open = r.entry ? `(id) => go(${q(r.entry)}, id)` : "undefined";
  const tags = m.lookup!.tagsField ? ` tagsField=${attr(m.lookup!.tagsField)}` : "";
  return [
    `/** ${commentSafe(m.product)}: the look-up frame with its places, search and ZIP code, and the page for each destination. Written by FlowCode from the app model. */`,
    `import type { ComponentType } from "react";`,
    `import { LookupFrame, type LookupLink } from "./sections/LookupFrame";`,
    `import { CatalogSearch } from "./sections/LookupCatalog";`,
    `import { PlaceBadge, ZipPrompt } from "./sections/PlaceFinder";`,
    `import { useRoute } from "./lib/screens";`,
    `import { lookup } from "./app/lookup";`,
    `import { SCREEN_IDS, go } from "./app/routes";`,
    ...built.map((v) => `import ${pascal(v.id)}Screen from "./screens/${pascal(v.id)}Screen";`),
    ``,
    `const LINKS: LookupLink[] = ${JSON.stringify(links, null, 2)};`,
    ``,
    `/** A page inside another highlights it in the bar (an entry its catalog, a list its lists). */`,
    `const PARENT: Record<string, string> = ${JSON.stringify(parent)};`,
    ``,
    `const VIEWS: Record<string, ComponentType> = {`,
    ...built.map((v) => `  ${q(v.id)}: ${pascal(v.id)}Screen,`),
    `};`,
    ``,
    `export default function App() {`,
    `  const { screen } = useRoute(SCREEN_IDS);`,
    `  const View = VIEWS[screen];`,
    `  return (`,
    `    <LookupFrame`,
    `      lookup={lookup}`,
    `      product=${attr(m.product)}`,
    `      links={LINKS}`,
    `      current={PARENT[screen] ?? screen}`,
    `      onNavigate={(id) => go(id)}${r.saved ? `\n      savedId=${attr(r.saved)}` : ""}`,
    // The landing page's hero has the search; a second one in the bar above it is one too many (Clean Cart's look check).
    `      search={${r.landing && heroSearches(m.home ?? DEFAULT_HOME) ? `screen === ${q(r.landing)} ? undefined : ` : ""}<CatalogSearch lookup={lookup}${tags} onSearch={(s) => ${r.catalog ? `go(${q(r.catalog)}, \`q=\${s}\`)` : "void s"}} onOpen={${open}} />}`,
    `      place={<PlaceBadge lookup={lookup} />}`,
    // No frame ZIP banner on Home (its own opening) or on a record's page (it has its own "Where to find it" form).
    `      prompt={${[r.landing, r.entry].filter(Boolean).map((id) => `screen === ${q(id!)}`).join(" || ") || "false"} ? undefined : <ZipPrompt lookup={lookup} />}`,
    `    >`,
    `      {View ? <View key={screen} /> : null}`,
    `    </LookupFrame>`,
    `  );`,
    `}`,
    ``,
  ].join("\n");
}
