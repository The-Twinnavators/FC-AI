/**
 * A page in the generated fixture app that uses the starter's shipped motion parts (components/ui/motion-parts.tsx),
 * with the app's own styles: tabs, two disclosures, a native dialog and a drawer, and a way to leave the page (its
 * content unmounts) in the middle of an animation. motion-fixture-app.test.ts drives it.
 */
import { StrictMode, useState } from "react";
import { createRoot } from "react-dom/client";
import "./styles/tokens.css";
import "./styles/library.css";
import "./styles/app.css";
import "./styles/components.css";
import "./styles/motion.css";
import { setMotionOff } from "./lib/motion";
import { Disclosure, Drawer, NativeDialog, TabStrip } from "./components/ui/motion-parts";

if (new URLSearchParams(location.search).get("motion") === "off") setMotionOff(true);
const TABS = [
  { id: "overview", label: "Overview" },
  { id: "nutrition", label: "Nutrition" },
  { id: "stores", label: "Stores nearby" },
];
const PANELS: Record<string, string> = { overview: "Oat Milk Original, 1 L.", nutrition: "Per 100 ml: 46 kcal.", stores: "3 stores within 3 miles." };

function Parts() {
  const [tab, setTab] = useState("overview");
  const [dialog, setDialog] = useState(false);
  const [drawer, setDrawer] = useState(false);
  return (
    <>
      <h1>Motion parts</h1>
      <TabStrip label="Product" tabs={TABS} current={tab} onChange={setTab}>
        <p data-panel={tab}>{PANELS[tab]}</p>
      </TabStrip>
      <Disclosure title="Ingredients">
        Oats, water, sea salt. <a href="#allergens" id="inside-link">Allergy information</a>
      </Disclosure>
      <Disclosure title="Where it's sold">Northside Market · Corner Grocer</Disclosure>
      <p>
        <button type="button" id="open-dialog" onClick={() => setDialog(true)}>
          Rename list
        </button>{" "}
        <button type="button" id="open-drawer" onClick={() => setDrawer(true)}>
          Filters
        </button>
      </p>
      <NativeDialog
        open={dialog}
        title="Rename list"
        onClose={() => setDialog(false)}
        actions={
          <>
            <button type="button" onClick={() => setDialog(false)}>
              Cancel
            </button>
            <button type="button" id="dialog-save" onClick={() => setDialog(false)}>
              Save name
            </button>
          </>
        }
      >
        <label>
          List name <input id="dialog-field" defaultValue="Weekly shop" />
        </label>
      </NativeDialog>
      <Drawer open={drawer} title="Filters" onClose={() => setDrawer(false)} actions={<button type="button" onClick={() => setDrawer(false)}>Show 18 products</button>}>
        <label>
          Max price <input id="drawer-field" defaultValue="4.00" />
        </label>
      </Drawer>
    </>
  );
}

function Page() {
  const [here, setHere] = useState(true);
  return (
    <main>
      <button type="button" id="leave" onClick={() => setHere((h) => !h)}>
        {here ? "Leave this page" : "Come back"}
      </button>
      {here ? <Parts /> : <p id="elsewhere">Another page</p>}
    </main>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Page />
  </StrictMode>,
);
