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
      return `${head}\nimport { LookupCatalog } from "../sections/LookupCatalog";\nimport { useHashId } from "../sections/AppData";\n${imports}\n\nexport default function ${name}() {\n  const arg = useHashId(${q(v.id)});\n  const query = arg?.startsWith("q=") ? arg.slice(2) : undefined;\n  const category = arg && !query ? arg : undefined;\n  return (\n    <LookupCatalog\n      key={arg ?? "all"}\n      lookup={lookup}\n      title=${attr(v.label)}${v.purpose ? `\n      description=${attr(v.purpose)}` : ""}\n      category={category}\n      query={query}\n      onOpen={${open}}\n      onCategory={(c) => ${toCatalog("c")}}\n      onSearch={(s) => ${toCatalog('`q=${s}`')}}${catalogProps}\n    />\n  );\n}\n`;
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
      // A working start the design step composes into the product's landing page: the promise, search, the ZIP code,
      // the categories and the most liked entries, all on the same data.
      return `${head}\nimport { CatalogSearch, CategoryIndex, LookupCatalog } from "../sections/LookupCatalog";\nimport { ZipPrompt } from "../sections/PlaceFinder";\n${imports}\n\nexport default function ${name}() {\n  return (\n    <div className="fl-lkf-stack">\n      {/* 1. Hero: ${commentSafe(m.product)}, its promise and the search (design step: compose this from the PRD's words) */}\n      <section className="fl-lkf-hero" aria-labelledby="landing-title">\n        <h1 id="landing-title">{${q(m.product)}}</h1>\n        ${v.purpose ? `<p>{${q(v.purpose)}}</p>` : ""}\n        <CatalogSearch lookup={lookup}${tags} onSearch={(s) => ${toCatalog('`q=${s}`')}} onOpen={${open}} />\n      </section>\n      {/* 2. Where to find it: the ZIP code */}\n      <ZipPrompt lookup={lookup} />\n      {/* 3. Categories */}\n      <CategoryIndex lookup={lookup} onCategory={(c) => ${toCatalog("c")}} />\n      {/* 4. The most liked */}\n      <LookupCatalog lookup={lookup} title="Most liked" pageSize={8} toolbar={false} onOpen={${open}}${catalogProps} />\n    </div>\n  );\n}\n`;
    }
    default:
      return undefined;
  }
}

/** The look-up layer: places, availability, likes, saves, ratings and lists, beside the store. */
export function lookupFile(m: AppModel): { path: string; content: string } {
  const l = m.lookup!;
  const config = { entries: l.entries, places: l.places, categoryField: l.categoryField, placesField: l.placesField, areas: l.areas, placeWord: l.placeWord, carryWord: l.carryWord };
  const seed = { ratings: l.ratings, lists: l.lists, likes: l.likes, saves: l.saves };
  return {
    path: "src/app/lookup.ts",
    content: `/** The look-up layer, written by FlowCode from the app model: places near a ZIP code, which places carry what, likes, saves, ratings and lists. */\nimport { createLookup, type LookupConfig, type LookupSeed } from "../sections/LookupData";\nimport { store } from "./store";\n\nexport const config: LookupConfig = ${JSON.stringify(config, null, 2)};\n\nconst seed: LookupSeed = ${JSON.stringify(seed, null, 2)};\n\nexport const lookup = createLookup(store, config, seed);\n`,
  };
}

/** The look-up app's App.tsx: the frame, its places, search, ZIP code, and the page for each destination. */
export function lookupAppSource(m: AppModel, built: ModelView[], defaultIcon: Record<string, string>): string {
  const r = routesOf(m);
  const shown = m.nav.flatMap((g) => g.items).filter((v) => v.kind !== "entry" && v.kind !== "mylist");
  const links = shown.map((v) => ({ id: v.id, label: v.label, icon: v.icon ?? defaultIcon[v.kind] ?? "dot", ...(v.kind === "placeholder" ? { available: false } : {}), ...(["landing", "catalog", "places", "lists", "saved"].includes(v.kind) ? { mobile: true } : {}) }));
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
    `      search={${r.landing ? `screen === ${q(r.landing)} ? undefined : ` : ""}<CatalogSearch lookup={lookup}${tags} onSearch={(s) => ${r.catalog ? `go(${q(r.catalog)}, \`q=\${s}\`)` : "void s"}} onOpen={${open}} />}`,
    `      place={<PlaceBadge lookup={lookup} />}`,
    `      prompt={screen === ${q(r.landing ?? "")} ? undefined : <ZipPrompt lookup={lookup} />}`,
    `    >`,
    `      {View ? <View key={screen} /> : null}`,
    `    </LookupFrame>`,
    `  );`,
    `}`,
    ``,
  ].join("\n");
}
