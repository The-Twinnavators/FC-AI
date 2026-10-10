# Right-click "Explain this"

A portable spec for adding FlowCode's right-click explainer to another product. Hand this whole
file to a coding agent, or implement it by hand. It describes a feature that works today, including
the failure that made it look broken on half the product.

It stands alone. It does not need a chat assistant, a walkthrough, or an AI — a static description
registry answers most of it.

---

## What it is

Right-click anything in the app and get a small menu: **Explain "the thing you clicked"**,
contextual links for that thing, and **Explain this page**. The answer says what it is for, not what
it is called.

It replaces the documentation nobody opens with an answer in the place the question occurred.

---

## Part 1 — The description registry

One list, one entry per feature. Plain data, no components:

```ts
interface GuideEntry {
  /** Stable id. Page entries are `nav.<section>` by convention; see Part 4. */
  id: string;
  /** Where it applies: "*" for everywhere, or a route prefix. */
  route: string;
  title: string;
  /** What it is for, in the product's own voice. Two or three sentences. */
  description: string;
  /** Words someone would actually search for, including the wrong ones. */
  keywords: string[];
}

export const APP_GUIDE: GuideEntry[] = [ /* ... */ ];
```

Writing the descriptions is most of the work, and it is not filler:

- **Say what it is for and what happens**, not what it looks like. *"Re-reads tasks, checks,
  workspace files and git state"* beats *"a refresh button"*.
- **Answer the question behind the question.** Someone right-clicking an export button wants to know
  what comes out and where it goes.
- **Include the words people get wrong** in `keywords`. If half your users call the repo report an
  "audit", put "audit" in.
- **One registry, used by everything** — this menu, in-app search, and any assistant you add later.
  Two descriptions of the same feature will disagree within a month.

---

## Part 2 — Anchors

Mark each feature's container:

```html
<section data-guide="models.lab"> ... </section>
<nav     data-guide="nav.library"> ... </nav>
```

The menu walks up from whatever was right-clicked to the nearest `[data-guide]`. Put it on the
**container**, not on every control inside it — the specific control is identified separately, in
Part 3.

Optional contextual links, read the same way:

```html
<tr data-ctx-path="src/api/client.ts" data-ctx-status="failed"> ... </tr>
```

Each `data-ctx-*` becomes a quick action — open the file, filter to failures — which is what makes
the menu useful on dense pages like tables and logs.

---

## Part 3 — Naming the thing that was clicked

A menu that only says "Explain this page" is a worse help button. The value is naming the *exact*
thing under the pointer. Walk up from the target through an ordered list, most specific first:

```ts
const KINDS: Array<[selector: string, kind: string]> = [
  ["[data-part]", "part"],
  ["[role=tab]", "tab"],
  ["[role=radio], [role=switch], input[type=checkbox], input[type=radio]", "option"],
  ["button, [role=button]", "button"],
  ["a[href]", "link"],
  ["select", "menu"],
  ["label", "label"],
  ["h1, h2, h3, h4", "heading"],
  ["th", "column"],
  [".chip, .tag", "tag"],
  ["img, svg, canvas", "image"],
];
```

For the first match, take its name from `data-part`, then `aria-label`, then `title`, then its text.
Fall back to the nearest `p, li, td, dd, span, strong, em, code` for plain content, so
right-clicking a sentence still explains that sentence.

Two details that matter:

- **Stop at the feature's own container.** If the match *is* the `[data-guide]` element, that is the
  whole feature, not a part of it — otherwise every explanation says "Explain 'Models & capability
  lab'" no matter where you clicked.
- **Carry a little surrounding text** with the name. "Allow" means nothing on its own; "Allow — write
  to src/api/client.ts" is the question they were actually asking.

---

## Part 4 — Falling back to the page, and the bug that hides here

With no `[data-guide]` under the pointer, fall back to the page's own entry, derived from the route:

```ts
const section = location.pathname.split("/")[1] ?? "";
const pageId  = `nav.${section || "home"}`;
const pageGuide = APP_GUIDE.find((g) => g.id === pageId);
```

**Then build the menu — and if it has nothing in it, return `null`** so the browser's own menu
appears. Suppressing the native menu to show an empty one is worse than not having the feature.

> This is exactly how it broke in FlowCode. The menu was app-wide from the first day, but eight
> sections had no `nav.<section>` entry. On those pages the menu built nothing, returned `null`, and
> the browser menu came up — so the feature looked as though it existed on some pages and not
> others. Nobody had removed it. It simply had nothing to say, and silence is indistinguishable from
> absence.
>
> **Write the test that enumerates your routes and asserts every one has a page entry.** It is five
> lines and it is the difference between a feature that works everywhere and one that works where
> somebody remembered.

```ts
it("every page has a guide entry, so the right-click menu is never empty", () => {
  const missing = ROUTES.filter((r) => !APP_GUIDE.some((g) => g.id === `nav.${r}`));
  expect(missing).toEqual([]);
});
```

---

## Part 5 — Behaviour

A single always-mounted component listening for `contextmenu` on the document.

**Hand back the native menu when:**

- **Shift is held.** The documented escape hatch; say so somewhere.
- The target is a **text input, textarea or `contenteditable`.** Cut, copy, paste and spellcheck
  belong to the browser and people need them.
- There is **nothing to offer** (Part 4).

**Otherwise:**

- `preventDefault()`, open at the pointer, and **keep it on screen** — flip it above or left when it
  would overflow the viewport.
- Dismiss on Escape, on a click elsewhere, on scroll, and on resize.
- **Return focus** to the element that was right-clicked when it closes.
- Group the items: the specific thing, then contextual links, then the page. Hide empty groups
  rather than showing headings with nothing under them.

**Keyboard — not optional.** The context-menu key and Shift+F10 open it on the focused element, and
it is reachable by Tab. A help feature that only works with a mouse excludes the people who most
need it. Arrow keys move, Enter runs, Escape closes, `role="menu"` with `role="menuitem"` children.

---

## Part 6 — Answering

The registry alone answers "Explain this page" and any feature with an entry: show the title and
description in a panel or a dialog. No model required.

If you do have an assistant, pass it the entry plus the part, and let it answer in context:

```ts
explain({ anchor: "models.lab", part: { name: "Run capability test", kind: "button", context: "qwen3:8b row" } });
```

Keep the registry description as the fallback when the assistant is unavailable, slow or switched
off. The feature must work with the model turned off — that is what makes it documentation rather
than a demo.

---

## Build order

1. The registry, with entries for **every page** and the test from Part 4.
2. The menu component: page fallback only, `null` when empty, native menu on Shift and in inputs.
3. `data-guide` on feature containers, most-used screens first.
4. Part-level naming (`KINDS`).
5. `data-ctx-*` quick links on tables and lists.
6. Keyboard access — before launch, not after.
7. The assistant hand-off, if there is one, with the registry still answering when it is not there.

Steps 1 and 2 alone are a working feature on every page. Everything after that is depth.
