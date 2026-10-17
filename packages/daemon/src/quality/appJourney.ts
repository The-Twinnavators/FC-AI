/**
 * A browser journey through a complete app, derived from its app model and the PRD, not from the agent's own tests:
 * every screen the PRD names opens from the top bar as a working page; the PRD's own records can be searched for (each
 * shown once when it is one record), opened and saved, and seen in Saved as the same record; a search that matches
 * nothing says so. Driven through accessible names, like a person would.
 *
 * It is run as the functional baseline right after FlowCode writes the app (recorded on that step, with its checkpoint
 * and source state, never counted as the final check) and again in final verification, after design.
 *
 * Clean Cart slice eval 1: the catalog showed each PRD product twice and the Search link went nowhere; the build's own
 * checks never looked.
 */
import type { Page } from "playwright";
import { coveringView, type AppModel } from "../orchestrator/appModel.js";
import { compositeKey } from "../orchestrator/recordIdentity.js";

export interface JourneyPlan {
  /** Each screen the PRD names: the working page that is it (empty when there is none) and its top-bar label. */
  screens: Array<{ name: string; view: string; label: string; kind?: string }>;
  /** Where search happens (a look-up app's catalog page, or the page that is the PRD's Search). */
  catalog?: { view: string; label: string };
  entryView?: string;
  saved?: { view: string; label: string };
  /** The records the journey looks for: the PRD's named records, else the first sample records; `once` when one record has that title. */
  records: Array<{ title: string; once: boolean; subtitle?: string }>;
  /** The model has a not-signed-in role (a visitor): saving asks to sign in, and signing in is one tap. */
  visitor?: boolean;
}

export interface JourneyStep {
  step: string;
  ok: boolean;
  detail: string;
}

export function journeyPlan(m: AppModel, declared: Array<{ name: string }>, named: string[]): JourneyPlan {
  const views = m.nav.flatMap((g) => g.items);
  const screens = declared.map((d) => {
    // A page of the screen's kind is that screen only as an explicit alias (appModel.resolveScreenAliases).
    const cover = coveringView(views, d.name);
    const v = cover && (cover.byName || m.aliases?.some((a) => a.screen === d.name && a.view === cover.view.id)) ? cover.view : undefined;
    return { name: d.name, view: v?.id ?? "", label: v?.label ?? "", ...(v ? { kind: v.kind } : {}) };
  });
  const find = (kind: string) => views.find((v) => v.kind === kind);
  const searchAlias = m.aliases?.find((a) => /\bsearch\b/i.test(a.screen));
  const catalogView = (searchAlias && views.find((v) => v.id === searchAlias.view)) ?? find("catalog");
  const entries = m.lookup ? m.entities.find((e) => e.key === m.lookup!.entries) : m.entities[0];
  const rows = entries ? (m.seed[entries.key] ?? []) : [];
  const titleOf = (r: Record<string, unknown>) => String(r[entries?.titleField ?? "name"] ?? "").trim();
  // How many different records (by identity, recordIdentity.ts) have that title: one means it must be shown once.
  const count = (t: string) => new Set(rows.filter((r) => titleOf(r).toLowerCase() === t.toLowerCase()).map((r) => (entries ? compositeKey(entries, r) : titleOf(r)))).size;
  const titles = (named.length ? named : rows.slice(0, 3).map(titleOf)).filter(Boolean).slice(0, 6);
  const saved = find("saved");
  return {
    screens,
    ...(catalogView ? { catalog: { view: catalogView.id, label: catalogView.label } } : {}),
    ...(find("entry") ? { entryView: find("entry")!.id } : {}),
    ...(saved ? { saved: { view: saved.id, label: saved.label } } : {}),
    records: titles.map((t) => {
      // The record's other identifying text (its brand, its subtitle), to check it is the same record on every page.
      const row = rows.find((r) => titleOf(r).toLowerCase() === t.toLowerCase());
      const subtitle = entries?.subtitleField && row ? String(row[entries.subtitleField] ?? "").trim() : "";
      return { title: t, once: count(t) <= 1, ...(subtitle ? { subtitle } : {}) };
    }),
    ...(m.roles.some((r) => /\b(visitor|guest|not signed in|signed out|anonymous)\b/i.test(r)) ? { visitor: true } : {}),
  };
}

const NO_MATCH = "zzqx no such record 0417";

export async function runJourney(page: Page, url: string, plan: JourneyPlan): Promise<{ ok: boolean; steps: JourneyStep[] }> {
  const steps: JourneyStep[] = [];
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message.slice(0, 200)));
  const base = url.replace(/#.*$/, "");
  const open = async (view: string) => {
    await page.goto(`${base}#/${view}`, { waitUntil: "load", timeout: 30_000 });
    await page.waitForTimeout(400);
  };
  const main = () => page.locator("main").first();
  const hash = () => page.evaluate(() => decodeURIComponent(location.hash));
  const step = async (name: string, fn: () => Promise<string | void>) => {
    const before = errors.length;
    try {
      const detail = (await fn()) ?? "ok";
      if (errors.length > before) throw new Error(`page error: ${errors[before]}`);
      steps.push({ step: name, ok: true, detail });
    } catch (err) {
      steps.push({ step: name, ok: false, detail: (err as Error).message.split("\n")[0]!.slice(0, 300) });
    }
  };
  const search = async (text: string) => {
    await open(plan.catalog!.view);
    const box = main().locator("input[type=search]").first();
    if (!(await box.count())) throw new Error(`the ${plan.catalog!.label} page has no search box`);
    await box.fill(text);
    await page.waitForTimeout(600);
  };
  const titled = (t: string) => main().getByRole("button", { name: t, exact: true }).or(main().getByRole("link", { name: t, exact: true }));

  await page.goto(base, { waitUntil: "load", timeout: 30_000 });
  await page.evaluate(() => localStorage.clear());

  // A record's own page (a product, a record, one list) isn't in the top bar: it opens from a record.
  const RECORD_PAGE = new Set(["entry", "detail", "mylist"]);
  for (const s of plan.screens.filter((x) => x.kind && RECORD_PAGE.has(x.kind))) {
    await step(`${s.name}: opens from a record`, async () => {
      const first = plan.records[0];
      if (!plan.catalog || !first) throw new Error("no catalog and record to open it from");
      await search(first.title);
      await titled(first.title).first().click();
      await page.waitForTimeout(500);
      const h = await hash();
      if (!h.startsWith(`#/${s.view}`)) throw new Error(`opening "${first.title}" went to ${h || "(no route)"}, not #/${s.view}`);
      return h;
    });
  }
  for (const s of plan.screens.filter((x) => !(x.kind && RECORD_PAGE.has(x.kind)))) {
    await step(`${s.name}: opens from the top bar`, async () => {
      if (!s.view) throw new Error("no working page is this screen (a placeholder doesn't count)");
      await page.goto(base, { waitUntil: "load", timeout: 30_000 });
      await page.waitForTimeout(300);
      const link = page.getByRole("button", { name: s.label, exact: true }).or(page.getByRole("link", { name: s.label, exact: true })).first();
      if (!(await link.count())) throw new Error(`no "${s.label}" in the top bar`);
      if (await link.isDisabled().catch(() => false)) throw new Error(`"${s.label}" in the top bar is disabled`);
      await link.click();
      await page.waitForTimeout(400);
      const h = await hash();
      if (s.view !== "landing" && !h.startsWith(`#/${s.view}`) && !(h === "" && /^(landing|home)$/.test(s.view))) throw new Error(`"${s.label}" went to ${h || "(no route)"}, not #/${s.view}`);
      const text = (await main().innerText().catch(() => "")).trim();
      if (!text) throw new Error("the page is empty");
      return `#/${s.view}`;
    });
  }
  if (plan.catalog) {
    for (const r of plan.records) {
      await step(`Search finds "${r.title}"`, async () => {
        await search(r.title);
        const n = await titled(r.title).count();
        if (!n) throw new Error(`no result named "${r.title}"`);
        if (r.once && n > 1) throw new Error(`"${r.title}" is shown ${n} times (it is one record)`);
        return `${n} result`;
      });
    }
    const first = plan.records[0];
    if (first && plan.entryView) {
      await step(`Opening "${first.title}" shows that record`, async () => {
        await search(first.title);
        await titled(first.title).first().click();
        await page.waitForTimeout(500);
        const h = await hash();
        if (!h.startsWith(`#/${plan.entryView}`)) throw new Error(`it went to ${h || "(no route)"}, not the record page`);
        const text = await main().innerText();
        if (!text.includes(first.title)) throw new Error(`the record page doesn't show "${first.title}"`);
        if (first.subtitle && !text.includes(first.subtitle)) throw new Error(`the record page shows "${first.title}" but not "${first.subtitle}": another record`);
        return h;
      });
    }
    if (first && plan.saved && plan.entryView) {
      // Fresh browser state, then everything through the app's own controls.
      await page.goto(base, { waitUntil: "load", timeout: 30_000 });
      await page.evaluate(() => localStorage.clear());
      await page.reload({ waitUntil: "load" });
      const control = (name: RegExp) => page.getByRole("button", { name }).or(page.getByRole("menuitem", { name })).first();
      const openRecord = async () => {
        await search(first.title);
        await titled(first.title).first().click();
        await page.waitForTimeout(500);
      };
      const saveControl = () => main().getByRole("button", { name: /^save\b/i }).first();
      const savedHere = async () => {
        await open(plan.saved!.view);
        const text = await main().innerText();
        return text.includes(first.title) && (!first.subtitle || text.includes(first.subtitle));
      };
      if (plan.visitor) {
        await step(`A visitor's Save asks them to sign in`, async () => {
          // A visitor: sign out through the account menu when the app starts signed in.
          if (!(await control(/^sign in$/i).count())) {
            const account = control(/account/i);
            if (!(await account.count())) throw new Error("no account control to sign out with, and no Sign in control");
            await account.click();
            const out = control(/sign out|log out/i);
            if (!(await out.count())) throw new Error("the account menu has no Sign out");
            await out.click();
            await page.waitForTimeout(400);
          }
          await openRecord();
          const save = saveControl();
          if (!(await save.count())) throw new Error(`the record page has no Save control`);
          await save.click();
          await page.waitForTimeout(400);
          const said = await page.locator("body").innerText();
          if (!/sign in/i.test(said)) throw new Error("saving as a visitor didn't ask them to sign in");
          if (!(await control(/^sign in$/i).count())) throw new Error("no Sign in control was offered");
          return "asked to sign in";
        });
        await step("Signing in is one tap", async () => {
          await control(/^sign in$/i).click();
          await page.waitForTimeout(500);
          if (await control(/^sign in$/i).count()) throw new Error("still signed out after tapping Sign in");
          return "signed in";
        });
      }
      await step(`Saving "${first.title}" puts the same record (${first.subtitle ? `${first.title}, ${first.subtitle}` : first.title}) in ${plan.saved.label}`, async () => {
        await openRecord();
        const save = saveControl();
        if (!(await save.count())) throw new Error("the record page has no Save control");
        // A visitor's Save can complete on sign-in: only press it when it isn't on already (pressing again removes it).
        if ((await save.getAttribute("aria-pressed")) !== "true") await save.click();
        await page.waitForTimeout(400);
        if ((await saveControl().getAttribute("aria-pressed")) === "false") throw new Error("the Save control isn't on after saving");
        if (!(await savedHere())) throw new Error(`${plan.saved!.label} doesn't show "${first.title}"${first.subtitle ? ` from ${first.subtitle}` : ""}`);
        return "saved and shown";
      });
      await step(`"${first.title}" is still in ${plan.saved.label} after a reload`, async () => {
        await page.reload({ waitUntil: "load" });
        await page.waitForTimeout(400);
        if (!(await savedHere())) throw new Error(`${plan.saved!.label} lost "${first.title}" on reload`);
        return "kept";
      });
    }
    await step("A search that matches nothing says so", async () => {
      await search(NO_MATCH);
      const shown = (await Promise.all(plan.records.map((r) => titled(r.title).count()))).reduce((a, b) => a + b, 0);
      if (shown) throw new Error(`${shown} of the PRD's records are still listed`);
      const text = await main().innerText();
      if (!/\bno\b[^.\n]*\b(match|result|found)|nothing (found|match)|\b0 [a-z]+/i.test(text)) throw new Error("no empty-results message");
      return "empty state shown";
    });
  }
  return { ok: steps.length > 0 && steps.every((s) => s.ok), steps };
}
