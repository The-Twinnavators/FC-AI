// Renders brand PNGs (app icon + wordmark lockup) from the SVG mark using the local Playwright Chromium.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const mark = fs.readFileSync(path.join(root, "docs/brand/flowcode-mark.svg"), "utf8");
const font = "data:font/woff2;base64," + fs.readFileSync(path.join(root, "node_modules/@fontsource-variable/hanken-grotesk/files/hanken-grotesk-latin-wght-normal.woff2")).toString("base64");
const browser = await chromium.launch();
const page = await browser.newPage({ deviceScaleFactor: 2 });

await page.setViewportSize({ width: 256, height: 256 });
await page.setContent(`<body style="margin:0;background:transparent"><div style="width:256px;height:256px;display:grid;place-items:center">${mark.replace("<svg", '<svg width="232" height="232"')}</div></body>`);
await page.screenshot({ path: path.join(root, "apps/desktop/assets/icon.png"), omitBackground: true });

await page.setViewportSize({ width: 560, height: 160 });
await page.setContent(`<style>@font-face{font-family:H;src:url(${font})}</style>
<body style="margin:0;background:#0f1115;font-family:H,sans-serif">
<div style="height:160px;display:flex;align-items:center;gap:22px;padding-left:36px">
${mark.replace("<svg", '<svg width="84" height="84"')}
<div><div style="color:#fff;font-weight:700;font-size:44px;letter-spacing:-0.5px;line-height:1.05">FlowCode</div>
<div style="color:#8a8f98;font-size:26px;margin-top:4px">Personal Intelligence</div></div></div></body>`);
await page.evaluate(() => document.fonts.ready);
await page.waitForTimeout(200);
await page.screenshot({ path: path.join(root, "docs/brand/flowcode-logo.png") });
await browser.close();
console.log("brand assets rendered");
