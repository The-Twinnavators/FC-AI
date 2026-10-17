/**
 * "The app frame is designed" (orchestrator/taskContract.ts deliverableChecks, kind frame-designed), in two parts:
 *
 * 1. Evidence that the frame changed (frameEvidence, no browser): a rule whose selector is the frame's (ui-shell, the app
 *    frame, its nav, header, tab or side bar) whose declarations this step changed or added, compared rule by rule
 *    with the stylesheet before the step's first edit; or a frame component of the app's own that App.tsx renders.
 *    The previous check counted changed lines that themselves mentioned "ui-shell" or "nav", so restyling an existing
 *    frame rule (its declarations change, its selector line doesn't) counted 0 at every point of the Clean Cart frame
 *    step, and it needed 6. A change to an unrelated rule (.card) is not frame evidence.
 * 2. Evidence that it renders and works (frameRendered, in the browser): an element one of the changed frame selectors
 *    (or the frame's navigation landmark) matches is visible on some screen, and clicking another destination in the
 *    frame's navigation changes the screen, with no page error. Frame code nothing shows doesn't count.
 *
 * How it looks is the person's to judge at review; this checks that the frame changed, shows and works.
 */
import type { Page } from "playwright";

/** Selectors that are the app frame or its navigation. */
export const FRAME_SELECTOR = /ui-shell|app-?frame|lookup-?frame|\bnav\b|navbar|nav-|top-?bar|tab-?bar|side-?bar|site-header|app-header|\bheader\b|\bbanner\b/i;

/** A stylesheet's rules: each selector (at-rules dropped, nested ones flattened) with its declarations, normalised. */
export function cssRules(text: string): Map<string, string> {
  let css = text.replace(/\/\*[\s\S]*?\*\//g, "");
  const rules = new Map<string, string>();
  // Innermost blocks first: "selector { decls }" with no braces inside, recorded and removed until none is left.
  for (let guard = 0; guard < 50; guard++) {
    let found = false;
    css = css.replace(/([^{}]*)\{([^{}]*)\}/g, (_m, pre: string, body: string) => {
      found = true;
      const selector = pre.split(/[;}]/).pop()!.trim().replace(/\s+/g, " ");
      if (selector && !selector.startsWith("@")) {
        const decls = body
          .split(";")
          .map((d) => d.trim().replace(/\s+/g, " "))
          .filter(Boolean)
          .sort()
          .join("; ");
        rules.set(selector, rules.has(selector) ? `${rules.get(selector)}; ${decls}` : decls);
      }
      return "";
    });
    if (!found) break;
  }
  return rules;
}

/**
 * Frame rules whose declarations differ between two versions of a stylesheet (new rules included; removed ones too).
 * `isFrame`: which selectors are the frame's; the app's resolved frame (appFrame.ts) when there is one, else the
 * generic frame vocabulary.
 */
export function frameCssChanges(before: string, after: string, isFrame: (selector: string) => boolean = (s) => FRAME_SELECTOR.test(s)): string[] {
  const a = cssRules(before);
  const b = cssRules(after);
  const changed: string[] = [];
  for (const [sel, decls] of b) if (isFrame(sel) && a.get(sel) !== decls) changed.push(sel);
  for (const sel of a.keys()) if (isFrame(sel) && !b.has(sel)) changed.push(sel);
  return [...new Set(changed)];
}

/**
 * Part 1. `cssChanges`: each stylesheet the step changed, before its first edit and now. `components`: frame components
 * the step created in src/components (outside the kit) with whether App.tsx imports them. `frame`: the frame App.tsx
 * renders (appFrame.ts), when it could be resolved: rules naming its classes are frame rules, and a change to its own
 * component file is frame evidence. `frameFileChanged`: the step changed that file.
 */
export function frameEvidence(
  cssChanges: Array<{ file: string; before: string; now: string }>,
  components: Array<{ file: string; rendered: boolean }>,
  frame?: { component: string; file: string; classes: string[]; isFrame: (selector: string) => boolean },
  frameFileChanged = false,
): { ok: true; selectors: string[]; component?: string } | { ok: false; problem: string } {
  const rendered = components.find((c) => c.rendered);
  const selectors = [...new Set(cssChanges.flatMap((c) => frameCssChanges(c.before, c.now, frame?.isFrame)))];
  // The frame component's own file, changed by the step: its rendered classes are what the browser part looks for.
  const ownSelectors = frameFileChanged && frame ? frame.classes.slice(0, 6).map((c) => `.${c}`) : [];
  if (selectors.length || rendered || ownSelectors.length) return { ok: true, selectors: selectors.length ? selectors : ownSelectors, ...(rendered ? { component: rendered.file } : frameFileChanged && frame ? { component: frame.file } : {}) };
  const name = frame ? `${frame.component} (${frame.file}, classes like .${frame.classes.slice(0, 2).join(", .")})` : "the frame (ui-shell, the app frame, its nav, header, tab or side bar)";
  const unused = components.filter((c) => !c.rendered);
  if (unused.length) return { ok: false, problem: `the frame component ${unused.map((c) => c.file).join(", ")} isn't rendered: App.tsx doesn't import it, and no rule of ${name} changed` };
  const other = cssChanges.some((c) => c.before !== c.now);
  return { ok: false, problem: other ? `this step's stylesheet changes don't touch the frame: no rule of ${name} changed` : `no rule of ${name} changed, its component wasn't changed, and no frame component of the app's own was added` };
}

/** Removes pseudo-classes and pseudo-elements that only match in a state (hover, focus) so the element itself is found. */
export function matchable(selector: string): string {
  return selector
    .split(",")
    .map((s) => s.replace(/::?(hover|focus(-visible|-within)?|active|visited|before|after|placeholder|marker|selection|first-letter|first-line)\b(\([^)]*\))?/g, "").trim())
    .filter(Boolean)
    .join(", ");
}

/**
 * Part 2, in a page: `open(route)` shows a screen. Looks for a visible element the changed frame selectors (or, for a
 * frame component, the navigation landmark) match on the screens in order; on the first that has one, clicks another
 * destination in the frame's navigation and checks the screen changed. Undefined when it passes, else why not.
 */
export async function frameRendered(page: Page, open: (route: string) => Promise<void>, routes: string[], selectors: string[]): Promise<string | undefined> {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message.slice(0, 200)));
  const targets = [...selectors.map(matchable).filter(Boolean), "nav", "[role=navigation]"];
  const own = selectors.map(matchable).filter(Boolean);
  let shownOn: string | undefined;
  for (const route of routes.length ? routes : [""]) {
    await open(route);
    const visible = await page.evaluate((sels: string[]) => {
      const shows = (el: Element) => {
        const st = getComputedStyle(el);
        const r = el.getBoundingClientRect();
        return st.display !== "none" && st.visibility !== "hidden" && Number(st.opacity) > 0 && r.width > 0 && r.height > 0 && r.bottom > 0 && r.right > 0;
      };
      return sels.filter((s) => {
        try {
          return Array.from(document.querySelectorAll(s)).some(shows);
        } catch {
          return false;
        }
      });
    }, own.length ? own : targets);
    if (visible.length) {
      shownOn = route;
      break;
    }
  }
  if (shownOn === undefined) return own.length ? `the frame rules this step changed (${own.slice(0, 4).join(", ")}) match nothing visible on any screen` : "no frame navigation is visible on any screen";
  // Navigation: another destination in the frame's navigation changes the screen.
  const links = page.locator("nav a, nav button, [role=navigation] a, [role=navigation] button");
  const n = await links.count();
  let target = -1;
  for (let i = 0; i < n && target < 0; i++) {
    const l = links.nth(i);
    if ((await l.isVisible()) && (await l.getAttribute("aria-current")) !== "page" && ((await l.textContent()) ?? "").trim()) target = i;
  }
  if (target < 0) return "the frame shows, but its navigation has no other destination to open";
  const state = () => page.evaluate(() => ({ hash: location.hash, path: location.pathname, main: (document.querySelector("main") ?? document.body).textContent?.replace(/\s+/g, " ").slice(0, 600) ?? "" }));
  const before = await state();
  const label = ((await links.nth(target).textContent()) ?? "").trim().slice(0, 40);
  await links.nth(target).click();
  await page.waitForTimeout(500);
  const after = await state();
  if (before.hash === after.hash && before.path === after.path && before.main === after.main) return `clicking "${label}" in the frame's navigation didn't change the screen`;
  if (errors.length) return `the page threw an error: ${errors[0]}`;
  return undefined;
}
