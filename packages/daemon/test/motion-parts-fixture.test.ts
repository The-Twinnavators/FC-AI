/**
 * The starter's shipped motion parts (components/ui/motion-parts.tsx: TabStrip, NativeDialog, Drawer, Disclosure) in a
 * generated app (motion-fixture.ts, page fixtures/motion-check), driven in Chromium with real keys and presses, at each
 * level, with reduced motion and with animation off: keyboard behaviour, focus kept inside and given back, closed
 * content unreachable, rapid input and interruption, and leaving the page in the middle of an animation.
 */
import net from "node:net";
import path from "node:path";
import { spawn, type ChildProcess } from "node:child_process";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { chromium, type Browser, type Page } from "playwright";
import { motionTokens, type MotionLevel } from "@flowcode/contracts";
import { hasRecordedApp, motionFixtureApp } from "./motion-fixture.js";

const SKIP = process.env.FLOWCODE_SKIP_BROWSER === "1" || !hasRecordedApp();
let server: ChildProcess | undefined;
let browser: Browser | undefined;
let base = "";
const freePort = () => new Promise<number>((resolve) => { const s = net.createServer().listen(0, "127.0.0.1", () => { const p = (s.address() as net.AddressInfo).port; s.close(() => resolve(p)); }); });

beforeAll(async () => {
  if (SKIP) return;
  const root = motionFixtureApp("balanced");
  const port = await freePort();
  server = spawn(process.execPath, [path.join(root, "node_modules/vite/bin/vite.js"), "--port", String(port), "--strictPort", "--host", "127.0.0.1"], { cwd: root, stdio: ["ignore", "pipe", "pipe"] });
  base = `http://127.0.0.1:${port}/`;
  for (let i = 0; i < 120 && !(await fetch(base).then((r) => r.ok, () => false)); i++) await new Promise((r) => setTimeout(r, 500));
  browser = await chromium.launch();
}, 120_000);
afterAll(async () => {
  await browser?.close();
  server?.kill();
});

type Mode = { level: MotionLevel; reduced?: boolean; off?: boolean };
async function openParts(o: Mode) {
  const context = await browser!.newContext({ viewport: { width: 1280, height: 860 }, reducedMotion: o.reduced ? "reduce" : "no-preference" });
  const page = await context.newPage();
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  await page.goto(`${base}motion-check.html${o.off ? "?motion=off" : ""}`);
  if (o.level !== "balanced") await page.addStyleTag({ content: `:root { ${Object.entries(motionTokens(o.level)).map(([k, v]) => `${k}: ${v};`).join(" ")} }` });
  await page.locator("h1").waitFor();
  return { page, errors };
}
const settle = (page: Page, ms = 500) => page.waitForTimeout(ms);
// What has focus: a tab by its name, anything else by its id.
const active = (page: Page) => page.evaluate(() => { const a = document.activeElement; return a?.getAttribute("role") === "tab" ? a.textContent?.trim() : a?.id || a?.tagName; });
const MODES: Mode[] = [{ level: "minimal" }, { level: "balanced" }, { level: "expressive" }, { level: "expressive", reduced: true }, { level: "balanced", off: true }];
const name = (m: Mode) => `${m.level}${m.reduced ? " + reduced motion" : ""}${m.off ? " + animation off" : ""}`;

describe.skipIf(SKIP)("the starter's motion parts in a generated app", () => {
  for (const mode of MODES) {
    it(`${name(mode)}: tabs by keyboard with rapid presses; the indicator ends on the selected tab`, async () => {
      const { page, errors } = await openParts(mode);
      await page.getByRole("tab", { name: "Overview" }).focus();
      for (let i = 0; i < 4; i++) await page.keyboard.press("ArrowRight");
      await settle(page, 600);
      expect(await page.getByRole("tab", { selected: true }).innerText()).toBe("Nutrition");
      expect(await active(page)).toBe("Nutrition");
      expect(await page.locator("[role=tabpanel] [data-panel]").getAttribute("data-panel")).toBe("nutrition");
      await page.keyboard.press("End");
      expect(await active(page)).toBe("Stores nearby");
      await page.keyboard.press("Home");
      await settle(page, 600);
      const at = await page.evaluate(() => {
        const t = document.querySelector('[role="tab"][aria-selected="true"]')!.getBoundingClientRect();
        const i = document.querySelector(".fc-tab-indicator")!.getBoundingClientRect();
        return { dx: Math.round(Math.abs(t.left - i.left)), dw: Math.round(Math.abs(t.width - i.width)) };
      });
      expect(await active(page)).toBe("Overview");
      expect(at.dx).toBeLessThan(2);
      expect(at.dw).toBeLessThan(2);
      expect(errors).toEqual([]);
      await page.context().close();
    }, 60_000);

    it(`${name(mode)}: disclosure by keyboard; closed content unreachable, open content reachable; rapid toggles end consistent`, async () => {
      const { page, errors } = await openParts(mode);
      const toggle = page.getByRole("button", { name: /Ingredients/ });
      await toggle.focus();
      await page.keyboard.press("Tab");
      expect(await active(page)).not.toBe("inside-link");
      await toggle.focus();
      await page.keyboard.press("Enter");
      await page.keyboard.press("Tab");
      expect(await active(page)).toBe("inside-link");
      await toggle.focus();
      for (let i = 0; i < 7; i++) await page.keyboard.press("Space");
      await settle(page);
      const s = await page.evaluate(() => {
        const b = document.querySelector<HTMLButtonElement>(".ui-disclosure__toggle")!;
        const region = document.getElementById(b.getAttribute("aria-controls")!)!;
        return { expanded: b.getAttribute("aria-expanded"), open: region.dataset.open, inert: (region.querySelector(".ui-disclosure__body") as HTMLElement).inert };
      });
      // Opened once by Enter, then 7 more presses: closed.
      expect(s).toEqual({ expanded: "false", open: "false", inert: true });
      expect(errors).toEqual([]);
      await page.context().close();
    }, 60_000);

    it(`${name(mode)}: dialog and drawer keep focus inside, close on Escape (also mid-entry) and give focus back`, async () => {
      const { page, errors } = await openParts(mode);
      for (const [opener, field] of [["open-dialog", "dialog-field"], ["open-drawer", "drawer-field"]] as const) {
        await page.locator(`#${opener}`).focus();
        await page.keyboard.press("Enter");
        expect(await page.evaluate(() => !!document.querySelector("dialog[open]"))).toBe(true);
        // Its field works on the first frame.
        await page.locator(`#${field}`).fill("Changed");
        // Tab never reaches the page behind (a native modal may hand focus to the browser's own controls, never to the page).
        for (let i = 0; i < 6; i++) {
          await page.keyboard.press("Tab");
          expect(await page.evaluate(() => { const a = document.activeElement; return !a || a === document.body || !!a.closest("dialog[open]"); })).toBe(true);
        }
        await page.locator(`#${field}`).focus();
        await page.keyboard.press("Escape");
        await settle(page, 400);
        expect(await page.evaluate(() => document.querySelector("dialog[open]"))).toBeNull();
        expect(await active(page)).toBe(opener);
        // Open and close again and again, Escape 20ms into the entry.
        for (let i = 0; i < 4; i++) {
          await page.keyboard.press("Enter");
          await page.waitForTimeout(20);
          await page.keyboard.press("Escape");
        }
        await settle(page, 400);
        expect(await page.evaluate(() => document.querySelector("dialog[open]"))).toBeNull();
        expect(await active(page)).toBe(opener);
      }
      expect(errors).toEqual([]);
      await page.context().close();
    }, 60_000);
  }

  it("reduced motion: the parts' motion becomes quick fades with no travel; animation off: none at all", async () => {
    const rm = await openParts({ level: "expressive", reduced: true });
    const rmStyle = await rm.page.evaluate(() => ({ dist: getComputedStyle(document.documentElement).getPropertyValue("--enter-distance").trim(), dialog: getComputedStyle(document.querySelector("dialog")!).transitionDuration.split(",")[0]!.trim() }));
    expect(rmStyle).toEqual({ dist: "0px", dialog: "0.12s" });
    await rm.page.context().close();
    const off = await openParts({ level: "balanced", off: true });
    await off.page.locator("#open-drawer").click();
    const offStyle = await off.page.evaluate(() => ({
      animations: document.getAnimations().length,
      dialog: getComputedStyle(document.querySelector("dialog[open]")!).transitionDuration,
      indicator: getComputedStyle(document.querySelector(".fc-tab-indicator")!).transitionDuration,
      collapse: getComputedStyle(document.querySelector(".fc-collapse")!).transitionDuration,
    }));
    expect(offStyle).toEqual({ animations: 0, dialog: "0s", indicator: "0s", collapse: "0s" });
    await off.page.context().close();
  }, 60_000);

  it("leaving the page in the middle of a drawer, a dialog, a disclosure or a tab move leaves nothing behind", async () => {
    const { page, errors } = await openParts({ level: "expressive" });
    const leaveAndBack = async () => {
      await page.evaluate(() => (document.getElementById("leave") as HTMLButtonElement).click());
      await settle(page);
      const after = await page.evaluate(() => {
        const leave = document.getElementById("leave")!;
        leave.focus();
        return { dialogs: document.querySelectorAll("dialog").length, modal: !!document.querySelector(":modal"), animations: document.getAnimations().length, leaveFocusable: document.activeElement === leave, elsewhere: !!document.getElementById("elsewhere") };
      });
      expect(after).toEqual({ dialogs: 0, modal: false, animations: 0, leaveFocusable: true, elsewhere: true });
      await page.locator("#leave").click();
      await page.locator("h1").waitFor();
    };
    await page.locator("#open-drawer").click();
    await page.waitForTimeout(30);
    await leaveAndBack();
    await page.locator("#open-dialog").click();
    await page.waitForTimeout(30);
    await leaveAndBack();
    await page.getByRole("button", { name: /Ingredients/ }).click();
    await page.waitForTimeout(30);
    await leaveAndBack();
    await page.getByRole("tab", { name: "Stores nearby" }).click();
    await page.waitForTimeout(30);
    await leaveAndBack();
    expect(errors).toEqual([]);
    await page.context().close();
  }, 60_000);
});
