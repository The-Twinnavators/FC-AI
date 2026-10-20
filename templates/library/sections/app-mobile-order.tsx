/** @flowcode-library app-mobile-order · Mobile ordering app (App screens)
 * Catalog ID: t.app-mobile-order (template)
 * Function: Ordering from a local cafe inside a phone app (t.app-mobile-order): pickup or delivery, category tabs, a menu with drawn food art, an item sheet with sizes and extras, an order sheet with steppers, a note, tax and a pickup-code confirmation, and Orders, Rewards and Account tabs, assembled from the bottom navigation, bottom sheets, an action sheet, a segmented control, checkboxes, quantity steppers, a text field, badges, avatars, switches and buttons.
 * Use it as: Copy app-mobile-order.tsx (FlowCode brings the components it uses); replace SAMPLE with the cafe's own menu, prices, sizes, extras, tax rate and pickup slots, and send the order to the app's own backend instead of keeping it in this screen's memory.
 * Built from: c.bottom-nav.labels, c.drawer.bottom, c.drawer@action-sheet, c.segmented.segmented, c.checkbox, c.quantity, c.text-field.outlined, c.badge.status, c.avatar.person, c.switch, c.button.primary, c.button.secondary, c.button.tertiary
 * Look: A phone-width cafe ordering screen: the cafe's name with a pickup or delivery switch and the pickup time, sideways-scrolling category chips, menu rows with drawn food art, dietary badges, prices and round add buttons, and a sticky View order bar over a fixed bottom tab bar.
 * Use cases: cafe ordering app; coffee shop app; restaurant ordering; food pickup app; bakery app; food truck ordering; order ahead; mobile menu
 * Jobs to be done: browse the menu by category; customize an item and see the price; review and change my order; choose pickup or delivery and a time; place an order and get a pickup code; reorder something I had before; earn and use a reward
 * Keywords: app, mobile app, phone app, food ordering, cafe, restaurant, menu, cart, pickup, delivery, bottom sheet, tab bar
 */
/**
 * App screen: ordering from a local cafe inside a phone app. A phone-width column (centered on wider screens) with the
 * cafe's name and hours, a Pickup or Delivery switch and the pickup time (changed from an action sheet of slots),
 * category tabs that scroll sideways and filter the menu, and menu items with drawn food art, a short description,
 * dietary badges, the price and a + button. Tapping an item opens a bottom sheet with its sizes and extras, which
 * change the price as you pick them, and Add to order. A sticky "View order · 3 items · $18.40" bar opens the order:
 * quantity steppers, a note for the barista, subtotal, delivery, tax and total, and Place order, which confirms with a
 * pickup code. A fixed bottom tab bar (Menu, Orders, Rewards, Account) marks the current tab; Orders tracks what was
 * placed and reorders past orders, Rewards fills a stamp card that turns into a free drink, Account holds the person
 * and their notifications. Works by keyboard, keeps 44px targets, honors reduced motion and clears the phone's home bar.
 * Use it as the ordering screen of a cafe, bakery, juice bar, food truck or small restaurant app. Make it the app's
 * own: replace SAMPLE with the place's real menu, prices, tax rate and pickup slots, and send the order to the app's
 * own backend instead of keeping it in this screen's memory.
 * Assembled from: header (inline: name, hours, c.segmented for pickup or delivery, the time as a button) > category
 * tabs (inline, scrolling) > menu list (inline SVG food art, c.badge.status, a round add button) > item sheet
 * (c.drawer.bottom: c.segmented sizes, c.checkbox extras, c.quantity, c.button.primary) > order bar (inline) > order
 * sheet (c.drawer.bottom: c.quantity, c.text-field multiline note, totals, c.button.primary) > confirmation
 * (c.drawer.bottom) > c.drawer@action-sheet for the pickup time > c.bottom-nav.labels; Orders (c.badge.status,
 * c.button.secondary), Rewards (inline stamp card, c.button.primary) and Account (c.avatar.person, c.switch).
 */
import { useState } from "react";
import { Button } from "./buttons-variants";
import { Badge } from "./badges-status";
import { Avatar } from "./avatars-variants";
import { Checkbox } from "./checkboxes-radios";
import { Switch } from "./switches-states";
import { Segmented } from "./segmented-control";
import { Quantity } from "./input-quantity";
import { TextField } from "./text-fields-states";
import { BottomNav, type BottomNavItem } from "./bottom-nav";
import { Drawer } from "./panels-drawers";

// flowcode:sample
const SAMPLE = {
  cafe: "Juniper & Rye",
  place: "Corner of 5th and Alder · Open until 6 PM",
  address: "412 Alder Street, Apt 3",
  deliveryEta: "25–35 min",
  deliveryFee: 2.99,
  taxRate: 0.0825,
  slots: [
    { id: "asap", label: "As soon as it's ready", hint: "About 10 minutes", short: "ASAP, about 10 min" },
    { id: "0930", label: "9:30 AM", hint: "", short: "9:30 AM" },
    { id: "0945", label: "9:45 AM", hint: "", short: "9:45 AM" },
    { id: "1000", label: "10:00 AM", hint: "", short: "10:00 AM" },
    { id: "1015", label: "10:15 AM", hint: "", short: "10:15 AM" },
  ],
  tabs: [
    { id: "menu", label: "Menu", icon: "home" },
    { id: "orders", label: "Orders", icon: "clock" },
    { id: "rewards", label: "Rewards", icon: "star" },
    { id: "account", label: "Account", icon: "user" },
  ],
  categories: [
    { id: "popular", label: "Popular" },
    { id: "coffee", label: "Coffee" },
    { id: "tea", label: "Tea & more" },
    { id: "bakery", label: "Bakery" },
    { id: "breakfast", label: "Breakfast" },
    { id: "lunch", label: "Lunch" },
  ],
  drinkSizes: [
    { id: "s", label: "Small", add: 0 },
    { id: "m", label: "Medium", add: 0.6 },
    { id: "l", label: "Large", add: 1.1 },
  ],
  drinkExtras: [
    { id: "oat", label: "Oat milk", add: 0.7 },
    { id: "shot", label: "Extra shot", add: 1 },
    { id: "vanilla", label: "Vanilla syrup", add: 0.6 },
  ],
  foodExtras: [
    { id: "warm", label: "Warm it up", add: 0 },
    { id: "butter", label: "Salted butter on the side", add: 0.5 },
    { id: "egg", label: "Add a soft egg", add: 2 },
  ],
  items: [
    { id: "flat", name: "Flat white", cat: "coffee", popular: true, kind: "cup", tone: "warm", price: 4.5, text: "Double ristretto, silky whole milk.", diet: ["Vegetarian"], drink: true },
    { id: "latte", name: "Honey cardamom latte", cat: "coffee", popular: true, kind: "glass", tone: "accent", price: 5.25, text: "Local wildflower honey, a pinch of cardamom.", diet: ["Vegetarian", "Gluten-free"], drink: true },
    { id: "cold", name: "Cold brew", cat: "coffee", popular: false, kind: "glass", tone: "secondary", price: 4.25, text: "Steeped 18 hours, served over ice.", diet: ["Vegan", "Gluten-free"], drink: true },
    { id: "chai", name: "Masala chai", cat: "tea", popular: false, kind: "cup", tone: "secondary", price: 4.75, text: "Spiced black tea simmered with milk.", diet: ["Vegetarian"], drink: true },
    { id: "matcha", name: "Iced matcha", cat: "tea", popular: true, kind: "glass", tone: "accent", price: 5.5, text: "Ceremonial matcha whisked to order.", diet: ["Vegetarian", "Gluten-free"], drink: true },
    { id: "croissant", name: "Almond croissant", cat: "bakery", popular: true, kind: "croissant", tone: "warm", price: 4.75, text: "Twice-baked, frangipane, toasted almonds.", diet: ["Vegetarian"], drink: false },
    { id: "muffin", name: "Blueberry oat muffin", cat: "bakery", popular: false, kind: "muffin", tone: "secondary", price: 3.95, text: "Wild blueberries, oat crumble top.", diet: ["Vegan"], drink: false },
    { id: "toast", name: "Avocado toast", cat: "breakfast", popular: true, kind: "toast", tone: "accent", price: 7.85, text: "Sourdough, smashed avocado, chili crunch, lime.", diet: ["Vegan"], drink: false },
    { id: "bowl", name: "Yogurt & granola bowl", cat: "breakfast", popular: false, kind: "bowl", tone: "warm", price: 6.5, text: "Greek yogurt, house granola, berries, honey.", diet: ["Vegetarian"], drink: false },
    { id: "sandwich", name: "Turkey pesto sandwich", cat: "lunch", popular: false, kind: "sandwich", tone: "warm", price: 10.5, text: "Roast turkey, basil pesto, provolone, ciabatta.", diet: [], drink: false },
    { id: "salad", name: "Farro harvest salad", cat: "lunch", popular: false, kind: "bowl", tone: "accent", price: 11.25, text: "Farro, roasted squash, kale, feta, cider dressing.", diet: ["Vegetarian"], drink: false },
  ],
  // What is already in the order when the screen opens: 3 items, $18.40.
  startOrder: [
    { item: "flat", size: "m", extras: ["oat"], qty: 1 },
    { item: "croissant", size: "", extras: [], qty: 1 },
    { item: "toast", size: "", extras: [], qty: 1 },
  ],
  pastOrders: [
    { id: "p1", when: "Friday, Oct 16", lines: [{ item: "latte", size: "m", extras: [], qty: 1 }, { item: "muffin", size: "", extras: ["warm"], qty: 1 }] },
    { id: "p2", when: "Tuesday, Oct 13", lines: [{ item: "cold", size: "l", extras: [], qty: 2 }] },
  ],
  stamps: 9,
  stampGoal: 10,
  rewardValue: 5,
  perks: [
    { id: "k1", title: "A stamp for every drink", text: "Ten stamps and your next drink is on us, up to $5." },
    { id: "k2", title: "Birthday pastry", text: "Any pastry, free, during your birthday week." },
    { id: "k3", title: "Members' Tuesday", text: "Half-price drip coffee every Tuesday before 10 AM." },
  ],
  person: { name: "Sam Rivera", email: "sam.rivera@example.com", since: "Ordering from Juniper & Rye since June 2024" },
  settings: [
    { id: "ready", label: "Text me when it's ready", text: "One message when your order is on the counter", on: true },
    { id: "receipt", label: "Email receipts", text: "A receipt for every order", on: true },
    { id: "offers", label: "News and offers", text: "New seasonal drinks, about twice a month", on: false },
  ],
};

type Item = (typeof SAMPLE.items)[number];
type Line = { key: string; item: string; size: string; extras: string[]; qty: number };
type Placed = { code: string; when: string; mode: "pickup" | "delivery"; lines: Line[]; total: number };

const money = (n: number) => n.toLocaleString("en-US", { style: "currency", currency: "USD" });
const itemOf = (id: string) => SAMPLE.items.find((i) => i.id === id)!;
const sizesOf = (it: Item) => (it.drink ? SAMPLE.drinkSizes : []);
const extrasOf = (it: Item) => (it.drink ? SAMPLE.drinkExtras : SAMPLE.foodExtras);
const keyOf = (item: string, size: string, extras: string[]) => [item, size, ...[...extras].sort()].join("|");
const unitPrice = (l: { item: string; size: string; extras: string[] }) => {
  const it = itemOf(l.item);
  const size = sizesOf(it).find((s) => s.id === l.size)?.add ?? 0;
  return it.price + size + extrasOf(it).filter((e) => l.extras.includes(e.id)).reduce((n, e) => n + e.add, 0);
};
const lineNote = (l: { item: string; size: string; extras: string[] }) => {
  const it = itemOf(l.item);
  return [sizesOf(it).find((s) => s.id === l.size)?.label, ...extrasOf(it).filter((e) => l.extras.includes(e.id)).map((e) => e.label)].filter(Boolean).join(", ");
};
const toLines = (ls: Array<{ item: string; size: string; extras: string[]; qty: number }>): Line[] => ls.map((l) => ({ ...l, key: keyOf(l.item, l.size, l.extras) }));

/** Food art drawn in SVG from the theme colors: a cup, a glass, a croissant, a muffin, toast, a bowl or a sandwich. */
function FoodArt({ kind, tone, big }: { kind: string; tone: string; big?: boolean }) {
  return (
    <span className={`fl-mord-art${big ? " fl-mord-art--big" : ""}`} data-tone={tone} aria-hidden="true">
      <svg viewBox="0 0 80 80">
        {kind === "cup" ? (
          <>
            <ellipse className="fl-mord-art__c" cx="40" cy="62" rx="26" ry="6" />
            <path className="fl-mord-art__a" d="M18 30h38v14a19 19 0 0 1-38 0z" />
            <path className="fl-mord-art__line" d="M56 34h4a7 7 0 0 1 0 14h-5" />
            <ellipse className="fl-mord-art__b" cx="37" cy="30" rx="19" ry="4" />
            <path className="fl-mord-art__line" d="M31 14c-3 4 3 6 0 10M41 12c-3 4 3 6 0 10" />
          </>
        ) : kind === "glass" ? (
          <>
            <path className="fl-mord-art__c" d="M22 16h36l-4 52a4 4 0 0 1-4 4H30a4 4 0 0 1-4-4z" />
            <path className="fl-mord-art__a" d="M24 34h32l-2.6 34a3 3 0 0 1-3 3H29.6a3 3 0 0 1-3-3z" />
            <rect className="fl-mord-art__b" x="31" y="38" width="8" height="8" rx="1.5" />
            <rect className="fl-mord-art__b" x="41" y="46" width="8" height="8" rx="1.5" />
            <path className="fl-mord-art__line" d="M46 6l-6 30" />
          </>
        ) : kind === "croissant" ? (
          <>
            <ellipse className="fl-mord-art__c" cx="40" cy="60" rx="30" ry="6" />
            <path className="fl-mord-art__a" d="M10 50c4-18 18-28 30-28s26 10 30 28c-6 4-12 4-16 0-4 4-10 6-14 6s-10-2-14-6c-4 4-10 4-16 0z" />
            <path className="fl-mord-art__line" d="M28 28c2 8 2 16 0 24M40 22v32M52 28c-2 8-2 16 0 24" />
          </>
        ) : kind === "muffin" ? (
          <>
            <path className="fl-mord-art__c" d="M22 42h36l-5 26H27z" />
            <path className="fl-mord-art__line" d="M32 44l2 22M40 44v22M48 44l-2 22" />
            <path className="fl-mord-art__a" d="M16 42c0-14 11-24 24-24s24 10 24 24z" />
            <circle className="fl-mord-art__b" cx="32" cy="30" r="3" />
            <circle className="fl-mord-art__b" cx="46" cy="27" r="3" />
            <circle className="fl-mord-art__b" cx="40" cy="36" r="3" />
          </>
        ) : kind === "toast" ? (
          <>
            <ellipse className="fl-mord-art__c" cx="40" cy="62" rx="30" ry="6" />
            <path className="fl-mord-art__b" d="M14 30c0-8 6-12 12-12 2-4 8-6 14-6s12 2 14 6c6 0 12 4 12 12 0 4-2 6-4 7v21H18V37c-2-1-4-3-4-7z" />
            <path className="fl-mord-art__a" d="M22 34c4-4 10-6 18-6s14 2 18 6v18H22z" />
            <circle className="fl-mord-art__c" cx="32" cy="40" r="2" />
            <circle className="fl-mord-art__c" cx="46" cy="44" r="2" />
          </>
        ) : kind === "sandwich" ? (
          <>
            <ellipse className="fl-mord-art__c" cx="40" cy="64" rx="30" ry="5" />
            <path className="fl-mord-art__b" d="M12 50h56v6a4 4 0 0 1-4 4H16a4 4 0 0 1-4-4z" />
            <path className="fl-mord-art__a" d="M10 44c6-4 10 2 15-1s9 3 15 0 9 3 15 0 9-3 15 1v6H10z" />
            <path className="fl-mord-art__b" d="M14 40c0-12 12-20 26-20s26 8 26 20z" />
            <path className="fl-mord-art__line" d="M28 28l3 2M40 25v3M51 28l-3 2" />
          </>
        ) : (
          <>
            <ellipse className="fl-mord-art__b" cx="40" cy="36" rx="28" ry="7" />
            <circle className="fl-mord-art__a" cx="30" cy="33" r="5" />
            <circle className="fl-mord-art__a" cx="44" cy="31" r="4" />
            <circle className="fl-mord-art__a" cx="52" cy="36" r="3.5" />
            <path className="fl-mord-art__c" d="M12 38h56c0 16-12 28-28 28S12 54 12 38z" />
          </>
        )}
      </svg>
    </span>
  );
}

const PLUS = "M12 5v14M5 12h14";
const BAG = "M5 8h14l-1 12H6zM9 8V6a3 3 0 0 1 6 0v2";

function Glyph({ d }: { d: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={d} />
    </svg>
  );
}

export default function AppMobileOrder() {
  const d = SAMPLE;
  const [tab, setTab] = useState("menu");
  const [mode, setMode] = useState<"pickup" | "delivery">("pickup");
  const [slot, setSlot] = useState(d.slots[0]!.id);
  const [choosingTime, setChoosingTime] = useState(false);
  const [cat, setCat] = useState("popular");
  const [order, setOrder] = useState<Line[]>(() => toLines(d.startOrder));
  const [open, setOpen] = useState<Item | null>(null);
  const [size, setSize] = useState("m");
  const [extras, setExtras] = useState<string[]>([]);
  const [qty, setQty] = useState(1);
  const [viewing, setViewing] = useState(false);
  const [note, setNote] = useState("");
  const [placed, setPlaced] = useState<Placed[]>([]);
  const [confirmed, setConfirmed] = useState<Placed | null>(null);
  const [stamps, setStamps] = useState(d.stamps);
  const [useReward, setUseReward] = useState(false);
  const [prefs, setPrefs] = useState<Record<string, boolean>>(() => Object.fromEntries(d.settings.map((s) => [s.id, s.on])));
  const [say, setSay] = useState("");

  const shown = cat === "popular" ? d.items.filter((i) => i.popular) : d.items.filter((i) => i.cat === cat);
  const count = order.reduce((n, l) => n + l.qty, 0);
  const subtotal = order.reduce((n, l) => n + unitPrice(l) * l.qty, 0);
  const drinkPrices = order.filter((l) => itemOf(l.item).drink).map((l) => unitPrice(l));
  const rewardReady = stamps >= d.stampGoal;
  const credit = useReward && rewardReady && drinkPrices.length ? Math.min(d.rewardValue, Math.max(...drinkPrices)) : 0;
  const fee = mode === "delivery" ? d.deliveryFee : 0;
  const tax = Math.round((subtotal - credit) * d.taxRate * 100) / 100;
  const total = subtotal - credit + fee + tax;
  const slotInfo = d.slots.find((s) => s.id === slot)!;
  const sheetPrice = open ? unitPrice({ item: open.id, size: open.drink ? size : "", extras }) * qty : 0;
  const active = placed.length;

  const navItems: BottomNavItem[] = d.tabs.map((t) => (t.id === "orders" ? { ...t, badge: active } : t));

  function openItem(it: Item) {
    setOpen(it);
    setSize("m");
    setExtras([]);
    setQty(1);
  }
  function addLines(lines: Array<{ item: string; size: string; extras: string[]; qty: number }>) {
    setOrder((o) => {
      const next = [...o];
      for (const l of toLines(lines)) {
        const at = next.findIndex((x) => x.key === l.key);
        if (at >= 0) next[at] = { ...next[at]!, qty: next[at]!.qty + l.qty };
        else next.push(l);
      }
      return next;
    });
  }
  function addOpen() {
    if (!open) return;
    addLines([{ item: open.id, size: open.drink ? size : "", extras, qty }]);
    setSay(`Added ${qty} ${open.name} to your order.`);
    setOpen(null);
  }
  function setLineQty(key: string, n: number) {
    const l = order.find((x) => x.key === key);
    setOrder((o) => (n <= 0 ? o.filter((x) => x.key !== key) : o.map((x) => (x.key === key ? { ...x, qty: n } : x))));
    if (l && n <= 0) setSay(`Removed ${itemOf(l.item).name}.`);
  }
  function place() {
    const code = `JR-${String(4827 + placed.length * 113).slice(-4)}`;
    const p: Placed = { code, when: mode === "pickup" ? slotInfo.short : d.deliveryEta, mode, lines: order, total };
    const drinks = order.filter((l) => itemOf(l.item).drink).reduce((n, l) => n + l.qty, 0);
    setPlaced((x) => [p, ...x]);
    setStamps((s) => (credit ? s - d.stampGoal : s) + drinks);
    setUseReward(false);
    setOrder([]);
    setNote("");
    setViewing(false);
    setConfirmed(p);
    setSay(`Order placed. Pickup code ${code}.`);
  }
  function go(id: string) {
    setTab(id);
    setSay(`${d.tabs.find((t) => t.id === id)?.label ?? ""} tab`);
  }

  return (
    <div className="fl-mord">
      <div className="fl-mord-phone">
        {tab === "menu" && (
          <main className="fl-mord-main" aria-labelledby="fl-mord-cafe">
            <header className="fl-mord-head">
              <div className="fl-mord-head__top">
                <span className="fl-mord-logo" aria-hidden="true">
                  <FoodArt kind="cup" tone="warm" />
                </span>
                <div>
                  <h1 id="fl-mord-cafe" className="fl-mord-h1">
                    {d.cafe}
                  </h1>
                  <p className="fl-mord-meta">{d.place}</p>
                </div>
              </div>
              <Segmented
                size="lg"
                label="How you get your order"
                value={mode}
                onChange={(v) => {
                  setMode(v as "pickup" | "delivery");
                  setSay(v === "pickup" ? "Pickup at the counter." : "Delivery to your address.");
                }}
                options={[
                  { value: "pickup", label: "Pickup" },
                  { value: "delivery", label: "Delivery" },
                ]}
              />
              {mode === "pickup" ? (
                <button type="button" className="fl-mord-when" onClick={() => setChoosingTime(true)} aria-label={`Pickup time: ${slotInfo.short}. Change it`}>
                  <span className="fl-mord-when__label">Pickup</span>
                  <span className="fl-mord-when__value">{slotInfo.short}</span>
                  <span className="fl-mord-when__change">Change</span>
                </button>
              ) : (
                <p className="fl-mord-when fl-mord-when--static">
                  <span className="fl-mord-when__label">Delivery</span>
                  <span className="fl-mord-when__value">
                    {d.deliveryEta} · {d.address}
                  </span>
                </p>
              )}
            </header>

            <nav className="fl-mord-cats" aria-label="Menu categories">
              <ul>
                {d.categories.map((c) => (
                  <li key={c.id}>
                    <button
                      type="button"
                      className="fl-mord-cat"
                      aria-pressed={cat === c.id}
                      onClick={(e) => {
                        setCat(c.id);
                        e.currentTarget.scrollIntoView({ block: "nearest", inline: "nearest" });
                      }}
                    >
                      {c.label}
                    </button>
                  </li>
                ))}
              </ul>
            </nav>

            <section aria-labelledby="fl-mord-list">
              <h2 id="fl-mord-list" className="fl-mord-h2">
                {d.categories.find((c) => c.id === cat)?.label}
                <span className="fl-mord-meta"> · {shown.length} items</span>
              </h2>
              <ul className="fl-mord-menu">
                {shown.map((it) => {
                  const inOrder = order.filter((l) => l.item === it.id).reduce((n, l) => n + l.qty, 0);
                  return (
                    <li key={it.id} className="fl-mord-item">
                      <button type="button" className="fl-mord-item__open" onClick={() => openItem(it)}>
                        <FoodArt kind={it.kind} tone={it.tone} />
                        <span className="fl-mord-item__body">
                          <span className="fl-mord-item__name">{it.name}</span>
                          <span className="fl-mord-item__text">{it.text}</span>
                          <span className="fl-mord-item__price">
                            {it.drink ? "from " : ""}
                            {money(it.price)}
                            {inOrder ? <span className="fl-mord-item__count"> · {inOrder} in order</span> : null}
                          </span>
                        </span>
                      </button>
                      {it.diet.length ? (
                        <span className="fl-mord-item__diet">
                          {it.diet.map((t) => (
                            <Badge key={t} tone={t === "Vegan" ? "success" : t === "Gluten-free" ? "info" : "neutral"}>
                              {t}
                            </Badge>
                          ))}
                        </span>
                      ) : null}
                      <button type="button" className="fl-mord-add" onClick={() => openItem(it)} aria-label={`Add ${it.name}, ${money(it.price)}`}>
                        <Glyph d={PLUS} />
                      </button>
                    </li>
                  );
                })}
              </ul>
            </section>
          </main>
        )}

        {tab === "orders" && (
          <main className="fl-mord-main" aria-labelledby="fl-mord-orders">
            <header className="fl-mord-head">
              <h1 id="fl-mord-orders" className="fl-mord-h1">
                Orders
              </h1>
            </header>
            <section aria-labelledby="fl-mord-now">
              <h2 id="fl-mord-now" className="fl-mord-h2">
                In progress
              </h2>
              {placed.length ? (
                <ul className="fl-mord-list">
                  {placed.map((p) => (
                    <li key={p.code} className="fl-mord-card">
                      <div className="fl-mord-row">
                        <span className="fl-mord-code">{p.code}</span>
                        <Badge tone="info" led pulse>
                          Being made
                        </Badge>
                      </div>
                      <p className="fl-mord-meta">
                        {p.mode === "pickup" ? `Pickup ${p.when} · show this code at the counter` : `Delivery in ${p.when}`}
                      </p>
                      <ol className="fl-mord-steps" aria-label="Order status">
                        <li data-done="">Received</li>
                        <li data-now="">Being made</li>
                        <li>{p.mode === "pickup" ? "Ready" : "On its way"}</li>
                      </ol>
                      <p className="fl-mord-row">
                        <span className="fl-mord-meta">{p.lines.reduce((n, l) => n + l.qty, 0)} items</span>
                        <strong className="fl-mord-num">{money(p.total)}</strong>
                      </p>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="fl-mord-empty">
                  Nothing on the way right now.{" "}
                  <Button variant="tertiary" size={44} onClick={() => go("menu")}>
                    Browse the menu
                  </Button>
                </p>
              )}
            </section>
            <section aria-labelledby="fl-mord-past">
              <h2 id="fl-mord-past" className="fl-mord-h2">
                Past orders
              </h2>
              <ul className="fl-mord-list">
                {d.pastOrders.map((p) => {
                  const lines = toLines(p.lines);
                  const sum = lines.reduce((n, l) => n + unitPrice(l) * l.qty, 0);
                  return (
                    <li key={p.id} className="fl-mord-card">
                      <div className="fl-mord-row">
                        <span className="fl-mord-meta">{p.when}</span>
                        <strong className="fl-mord-num">{money(sum)}</strong>
                      </div>
                      <ul className="fl-mord-lines">
                        {lines.map((l) => (
                          <li key={l.key}>
                            {l.qty} × {itemOf(l.item).name}
                            {lineNote(l) ? <span className="fl-mord-meta"> ({lineNote(l)})</span> : null}
                          </li>
                        ))}
                      </ul>
                      <Button
                        variant="secondary"
                        size={44}
                        icon="refresh"
                        onClick={() => {
                          addLines(p.lines);
                          setSay(`Added your ${p.when} order to the cart.`);
                          go("menu");
                        }}
                      >
                        Order again
                      </Button>
                    </li>
                  );
                })}
              </ul>
            </section>
          </main>
        )}

        {tab === "rewards" && (
          <main className="fl-mord-main" aria-labelledby="fl-mord-rewards">
            <header className="fl-mord-head">
              <h1 id="fl-mord-rewards" className="fl-mord-h1">
                Rewards
              </h1>
            </header>
            <section className="fl-mord-card" aria-labelledby="fl-mord-stamps">
              <div className="fl-mord-row">
                <h2 id="fl-mord-stamps" className="fl-mord-h2">
                  Stamp card
                </h2>
                <span className="fl-mord-meta">
                  {Math.min(stamps, d.stampGoal)} of {d.stampGoal}
                </span>
              </div>
              <ol className="fl-mord-stamps" role="img" aria-label={`${Math.min(stamps, d.stampGoal)} of ${d.stampGoal} stamps`}>
                {Array.from({ length: d.stampGoal }, (_, i) => (
                  <li key={i} data-on={i < stamps || undefined}>
                    <Glyph d="M5 9h11v6a5 5 0 0 1-5 5h-1a5 5 0 0 1-5-5zM16 11h1.5a2.5 2.5 0 0 1 0 5H16" />
                  </li>
                ))}
              </ol>
              {rewardReady ? (
                <>
                  <p>Your next drink is on us, up to {money(d.rewardValue)}.</p>
                  <Button
                    size={48}
                    block
                    pressed={useReward}
                    onClick={() => {
                      setUseReward((u) => !u);
                      setSay(useReward ? "Free drink taken off this order." : "Free drink will be used on this order.");
                    }}
                  >
                    {useReward ? "Free drink on this order" : "Use it on this order"}
                  </Button>
                </>
              ) : (
                <p className="fl-mord-meta">
                  {d.stampGoal - stamps} more {d.stampGoal - stamps === 1 ? "drink" : "drinks"} to a free one. Every drink you order adds a stamp.
                </p>
              )}
            </section>
            <section aria-labelledby="fl-mord-perks">
              <h2 id="fl-mord-perks" className="fl-mord-h2">
                Member perks
              </h2>
              <ul className="fl-mord-list">
                {d.perks.map((k) => (
                  <li key={k.id} className="fl-mord-card fl-mord-card--tight">
                    <strong>{k.title}</strong>
                    <span className="fl-mord-meta">{k.text}</span>
                  </li>
                ))}
              </ul>
            </section>
          </main>
        )}

        {tab === "account" && (
          <main className="fl-mord-main" aria-labelledby="fl-mord-account">
            <header className="fl-mord-head">
              <h1 id="fl-mord-account" className="fl-mord-h1">
                Account
              </h1>
            </header>
            <section className="fl-mord-card fl-mord-me" aria-label="You">
              <Avatar name={d.person.name} size={64} tone="c" decorative />
              <div>
                <p className="fl-mord-item__name">{d.person.name}</p>
                <p className="fl-mord-meta">{d.person.email}</p>
                <p className="fl-mord-meta">{d.person.since}</p>
              </div>
            </section>
            <section aria-labelledby="fl-mord-notify">
              <h2 id="fl-mord-notify" className="fl-mord-h2">
                Notifications
              </h2>
              <ul className="fl-mord-list">
                {d.settings.map((s) => (
                  <li key={s.id} className="fl-mord-card fl-mord-setting">
                    <span className="fl-mord-setting__body">
                      <span className="fl-mord-item__name">{s.label}</span>
                      <span className="fl-mord-meta">{s.text}</span>
                    </span>
                    <Switch
                      on={Boolean(prefs[s.id])}
                      label={s.label}
                      onToggle={(on) => {
                        setPrefs((p) => ({ ...p, [s.id]: on }));
                        setSay(`${s.label} ${on ? "on" : "off"}.`);
                      }}
                    />
                  </li>
                ))}
              </ul>
            </section>
          </main>
        )}

        {count > 0 && tab === "menu" ? (
          <div className="fl-mord-bar">
            <button type="button" className="fl-mord-bar__btn" onClick={() => setViewing(true)}>
              <span className="fl-mord-bar__icon" aria-hidden="true">
                <Glyph d={BAG} />
                <span className="fl-mord-bar__count">{count}</span>
              </span>
              <span className="fl-mord-bar__label">
                View order · {count} {count === 1 ? "item" : "items"} · {money(subtotal)}
              </span>
            </button>
          </div>
        ) : null}

        <p className="fl-sr" aria-live="polite">
          {say}
        </p>
      </div>

      <BottomNav items={navItems} current={tab} onNavigate={go} label={`${d.cafe} tabs`} />

      <Drawer
        side="bottom"
        overlay
        open={open !== null}
        onClose={() => setOpen(null)}
        title={open?.name ?? ""}
        className="fl-mord-sheet"
        actions={
          <Button size={48} block onClick={addOpen}>
            {`Add to order · ${money(sheetPrice)}`}
          </Button>
        }
      >
        {open ? (
          <div className="fl-mord-sheetbody">
            <div className="fl-mord-sheethero">
              <FoodArt kind={open.kind} tone={open.tone} big />
              <div className="fl-mord-sheethero__text">
                <p>{open.text}</p>
                {open.diet.length ? (
                  <span className="fl-mord-item__diet">
                    {open.diet.map((t) => (
                      <Badge key={t} tone={t === "Vegan" ? "success" : t === "Gluten-free" ? "info" : "neutral"}>
                        {t}
                      </Badge>
                    ))}
                  </span>
                ) : null}
              </div>
            </div>
            {open.drink ? (
              <fieldset className="fl-mord-field">
                <legend>Size</legend>
                <Segmented
                  size="lg"
                  label="Size"
                  value={size}
                  onChange={setSize}
                  options={d.drinkSizes.map((s) => ({ value: s.id, label: s.add ? `${s.label} +${money(s.add)}` : s.label }))}
                />
              </fieldset>
            ) : null}
            <fieldset className="fl-mord-field">
              <legend>Extras</legend>
              <ul className="fl-mord-extras">
                {extrasOf(open).map((e) => (
                  <li key={e.id}>
                    <label className="fl-mord-extra">
                      <Checkbox
                        size={20}
                        checked={extras.includes(e.id)}
                        onChange={(ev) => {
                          const on = ev.target.checked;
                          setExtras((x) => (on ? [...x, e.id] : x.filter((y) => y !== e.id)));
                        }}
                      />
                      <span>{e.label}</span>
                      <span className="fl-mord-meta">{e.add ? `+${money(e.add)}` : "Free"}</span>
                    </label>
                  </li>
                ))}
              </ul>
            </fieldset>
            <div className="fl-mord-row">
              <span className="fl-mord-item__name">How many</span>
              <Quantity size="lg" min={1} max={20} value={qty} onChange={(n) => setQty(n)} label={open.name} />
            </div>
          </div>
        ) : null}
      </Drawer>

      <Drawer
        side="bottom"
        overlay
        open={viewing}
        onClose={() => setViewing(false)}
        title="Your order"
        eyebrow={mode === "pickup" ? `Pickup · ${slotInfo.short}` : `Delivery · ${d.deliveryEta}`}
        className="fl-mord-sheet"
        actions={
          <Button size={48} block disabled={!count} onClick={place}>
            {`Place order · ${money(total)}`}
          </Button>
        }
      >
        <div className="fl-mord-sheetbody">
          {order.length ? (
            <ul className="fl-mord-olines">
              {order.map((l) => {
                const it = itemOf(l.item);
                return (
                  <li key={l.key} className="fl-mord-oline">
                    <FoodArt kind={it.kind} tone={it.tone} />
                    <span className="fl-mord-oline__body">
                      <span className="fl-mord-item__name">{it.name}</span>
                      {lineNote(l) ? <span className="fl-mord-meta">{lineNote(l)}</span> : null}
                      <span className="fl-mord-num">{money(unitPrice(l) * l.qty)}</span>
                    </span>
                    <Quantity size="lg" min={0} max={20} value={l.qty} onChange={(n) => setLineQty(l.key, n)} label={it.name} />
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="fl-mord-empty">Your order is empty. Pick something from the menu and it will wait here.</p>
          )}
          <label className="fl-mord-field fl-mord-note" htmlFor="fl-mord-note">
            <span className="fl-mord-item__name">Note for the barista</span>
            <TextField id="fl-mord-note" multiline rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Extra hot, no lid, name on the cup…" />
          </label>
          <dl className="fl-mord-totals">
            <div>
              <dt>Subtotal</dt>
              <dd>{money(subtotal)}</dd>
            </div>
            {credit ? (
              <div>
                <dt>Free drink reward</dt>
                <dd>−{money(credit)}</dd>
              </div>
            ) : null}
            {fee ? (
              <div>
                <dt>Delivery</dt>
                <dd>{money(fee)}</dd>
              </div>
            ) : null}
            <div>
              <dt>Tax ({(d.taxRate * 100).toFixed(2).replace(/0+$/, "")}%)</dt>
              <dd>{money(tax)}</dd>
            </div>
            <div className="fl-mord-totals__sum">
              <dt>Total</dt>
              <dd>{money(total)}</dd>
            </div>
          </dl>
          {rewardReady && !useReward && drinkPrices.length ? (
            <Button variant="tertiary" size={44} icon="star" onClick={() => setUseReward(true)}>
              Use my free drink
            </Button>
          ) : null}
        </div>
      </Drawer>

      <Drawer
        side="bottom"
        overlay
        open={confirmed !== null}
        onClose={() => setConfirmed(null)}
        title="Order placed"
        className="fl-mord-sheet"
        actions={
          <>
            <Button
              variant="secondary"
              size={48}
              block
              onClick={() => {
                setConfirmed(null);
                go("orders");
              }}
            >
              Track this order
            </Button>
            <Button size={48} block onClick={() => setConfirmed(null)}>
              Done
            </Button>
          </>
        }
      >
        {confirmed ? (
          <div className="fl-mord-sheetbody fl-mord-done">
            <span className="fl-mord-done__check" aria-hidden="true">
              <Glyph d="M5 12.5 10 17l9-10" />
            </span>
            <p className="fl-mord-meta">{confirmed.mode === "pickup" ? "Your pickup code" : "Your order number"}</p>
            <p className="fl-mord-code fl-mord-code--big">{confirmed.code}</p>
            <p>
              {confirmed.mode === "pickup"
                ? `Ready ${confirmed.when === d.slots[0]!.short ? "in about 10 minutes" : `at ${confirmed.when}`}. Show the code at the counter.`
                : `Arriving in ${confirmed.when} at ${d.address}.`}
            </p>
            <p className="fl-mord-meta">Total paid {money(confirmed.total)}</p>
          </div>
        ) : null}
      </Drawer>

      <Drawer
        version="action-sheet"
        open={choosingTime}
        onClose={() => setChoosingTime(false)}
        title="Pickup time"
        className="fl-mord-times"
        hint={`At ${d.cafe}, ${d.place.split(" · ")[0]}`}
        options={d.slots.map((s) => ({ id: s.id, label: s.id === slot ? `${s.label} (chosen)` : s.label, hint: s.hint || undefined, icon: s.id === slot ? "check" : "clock" }))}
        onSelect={(id) => {
          setSlot(id);
          setChoosingTime(false);
          setSay(`Pickup time: ${d.slots.find((s) => s.id === id)?.short}.`);
        }}
        closeLabel="Cancel"
      />
    </div>
  );
}
