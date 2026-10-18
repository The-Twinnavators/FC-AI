/**
 * A Home concept, live (concept-preview.html, framed by the plan card): the build's own app frame and Home page from
 * the library, running on the build's own records (its schema, sample records, look-up config and links, sent by the
 * card), in the concept's look (its tokens, fonts and surface style). It is what the built app will show, before the
 * app is written. The page asks for its data by message, so it needs no connection of its own.
 */
import { createRoot } from "react-dom/client";
import { useMemo, useState } from "react";
import { previewBaseCss } from "./libraryStyle";
import baseCss from "../../../templates/library/library.css?raw";
import { createStore, type AppSchema, type RecordData } from "../../../templates/library/sections/app-data";
import { createLookup, type LookupConfig, type LookupSeed } from "../../../templates/library/sections/lookup-data";
import { LookupFrame, type LookupLink } from "../../../templates/library/sections/lookup-frame";
import { LookupHomeStorefront } from "../../../templates/library/sections/lookup-home-storefront";
import { LookupHomeMagazine } from "../../../templates/library/sections/lookup-home-magazine";
import { LookupHomeListings } from "../../../templates/library/sections/lookup-home-listings";

const categoryCss = import.meta.glob<string>("../../../templates/library/css/*.css", { query: "?raw", import: "default", eager: true });

export interface ConceptPreviewData {
  schema: AppSchema;
  records: Record<string, RecordData[]>;
  lookupConfig: LookupConfig;
  lookupSeed: LookupSeed;
  links: LookupLink[];
  product: string;
  landing?: string;
  saved?: string;
}
export interface ConceptPreviewMessage {
  type: "fl-concept";
  id: string;
  design: "storefront" | "magazine" | "listings";
  tokens: Record<string, string>;
  promise?: string;
  data: ConceptPreviewData;
}

const HOMES = { storefront: LookupHomeStorefront, magazine: LookupHomeMagazine, listings: LookupHomeListings };

function Preview({ m }: { m: ConceptPreviewMessage }) {
  // Its own storage key: a preview never reads or writes a built app's saved data.
  const { lookup } = useMemo(() => {
    const store = createStore({ ...m.data.schema, appKey: `concept-preview-${m.data.schema.appKey}-${m.id}` }, m.data.records, { user: "You" });
    return { lookup: createLookup(store, m.data.lookupConfig, m.data.lookupSeed) };
  }, [m]);
  const [at, setAt] = useState(m.data.landing ?? m.data.links[0]?.id ?? "");
  const Home = HOMES[m.design];
  const here = m.data.links.find((l) => l.id === at);
  return (
    <LookupFrame lookup={lookup} product={m.data.product} links={m.data.links} current={at} onNavigate={setAt} savedId={m.data.saved} fixed={false}>
      {at === m.data.landing ? (
        <Home lookup={lookup} product={m.data.product} promise={m.promise} onOpen={() => undefined} onCategory={() => undefined} onSearch={() => undefined} onBrowse={() => undefined} />
      ) : (
        <div style={{ padding: "48px 0", color: "var(--color-text-muted)" }}>
          <h1 style={{ margin: 0, fontFamily: "var(--font-display)" }}>{here?.label}</h1>
          <p>This preview shows the Home page in this direction. The other pages are written from the same app model when the build runs.</p>
        </div>
      )}
    </LookupFrame>
  );
}

const root = createRoot(document.getElementById("root")!);
let styled = false;
window.addEventListener("message", (e: MessageEvent<ConceptPreviewMessage>) => {
  if (e.origin !== location.origin || e.data?.type !== "fl-concept") return;
  const m = e.data;
  if (!styled) {
    styled = true;
    const style = document.createElement("style");
    // The starter's tokens and FlowCode's bundled fonts, every library style (a built app gets the ones its pieces
    // use; all of them is the same for these), then the concept's own tokens on top.
    style.textContent = [
      previewBaseCss("", m.tokens["--surface-style"] ?? ""),
      "html,body{margin:0;background:var(--color-bg);color:var(--color-text);font-family:var(--font-sans);font-size:var(--text-md);-webkit-font-smoothing:antialiased}*,*::before,*::after{box-sizing:border-box}",
      baseCss,
      ...Object.keys(categoryCss).sort().map((k) => categoryCss[k]),
      `:root{${Object.entries(m.tokens).map(([k, v]) => `${k}:${v}`).join(";")}}`,
    ].join("\n\n");
    document.head.appendChild(style);
  }
  root.render(<Preview m={m} />);
});
// Ask the card for the concept.
parent.postMessage({ type: "fl-concept-ready" }, location.origin);
