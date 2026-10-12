/** @flowcode-library breadcrumbs · Breadcrumbs (responsive) (Tabs, breadcrumbs and paging)
 * Catalog ID: c.breadcrumbs@responsive (component version)
 * Version of: c.breadcrumbs
 * Function: Breadcrumb trail with a home icon whose middle levels fold into a "…" button on phones, with aria-current on the last crumb; clicking a crumb moves you up to that level.
 * Use it as: import { Breadcrumbs } from "./breadcrumbs-variants"; <Breadcrumbs version="responsive" items={[{ label, href }]} label="Breadcrumb" homeIcon? movedTo?="Now on" restoreLabel?="Back to the product" />
 * Look: A chevron trail with a house icon where pressing a crumb shortens the trail and, on phones, the middle levels fold behind a button.
 * Tokens: --color-text --color-text-muted --color-accent --space-1 --space-2 --weight-semibold --focus-ring
 * Use cases: breadcrumb navigation; category hierarchy; folder path; docs navigation; product category trail; nested settings; file browser path
 * Jobs to be done: see where i am in the site; go back up a level; find my way through nested pages
 * Keywords: breadcrumbs, navigation, trail, hierarchy, responsive
 */
/**
 * Breadcrumbs: c.breadcrumbs@responsive. The implementation lives in the component, in ./breadcrumbs-variants. A trail
 * from the home page to the page you are on. Pressing a crumb goes up to that level and shortens the trail; on phones
 * the middle levels fold into a "…" button that reveals them, and focus moves to the first revealed level. The last
 * crumb is the current page (aria-current). Use it on pages three or more levels deep.
 * Make it the app's own: replace SAMPLE with your page path and point each crumb at its real route.
 */
import { Breadcrumbs as Trail } from "./breadcrumbs-variants";

// flowcode:sample
const SAMPLE = {
  label: "Breadcrumb",
  trail: [
    { label: "Home", href: "#home" },
    { label: "Shop", href: "#shop" },
    { label: "Products", href: "#products" },
    { label: "Kitchen", href: "#kitchen" },
    { label: "Mugs and cups", href: "#mugs" },
    { label: "Speckled stoneware mug", href: "#speckled-mug" },
  ],
  movedTo: "Now on",
  reset: "Back to the product",
};

export default function Breadcrumbs() {
  const d = SAMPLE;
  return (
    <section className="fl-section">
      <div className="fl-wrap fl-wrap--narrow">
        <Trail version="responsive" items={d.trail} label={d.label} homeIcon movedTo={d.movedTo} restoreLabel={d.reset} />
      </div>
    </section>
  );
}
