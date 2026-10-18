/**
 * Submits the recorded corrections through the actual plan review card (the UI at localhost:5199, pointed at the
 * validation daemon), recording the screen. It presses Request changes and Send, nothing else: no approval.
 */
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright";

const dir = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1"));
const { created } = JSON.parse(fs.readFileSync(path.join(dir, "freeze.json"), "utf8"));
const feedback = fs.readFileSync(path.join(dir, "revision-feedback.txt"), "utf8").trim();
const url = `http://127.0.0.1:5199/?port=7465&token=frameproof-token-3&temp=1#/projects/${created.projectId}/runs/${created.runId}`;

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1280, height: 860 }, recordVideo: { dir, size: { width: 1280, height: 860 } } });
const page = await context.newPage();
await page.goto(url);
const modal = page.locator(".approval-modal");
await modal.locator(".plan-review").waitFor({ timeout: 60_000 });
await page.waitForTimeout(1500);
await page.screenshot({ path: path.join(dir, "v1-card.png") });
const version = await modal.locator(".plan-review__title").innerText();
await modal.getByRole("button", { name: "Request changes" }).click();
await modal.getByLabel("What should change in this plan?").fill(feedback);
await page.waitForTimeout(800);
await page.screenshot({ path: path.join(dir, "v1-card-request.png") });
await modal.getByRole("button", { name: "Send and plan again" }).click();
await page.waitForTimeout(3000);
const status = await page.locator("[data-plan-status]").first().innerText().catch(() => "");
await page.screenshot({ path: path.join(dir, "after-request.png") });
const video = page.video();
await context.close();
fs.renameSync(await video.path(), path.join(dir, "request-changes.webm"));
await browser.close();
fs.writeFileSync(path.join(dir, "request-submitted.json"), JSON.stringify({ at: new Date().toISOString(), cardTitle: version, statusLineAfter: status, feedbackChars: feedback.length }, null, 2));
console.log(JSON.stringify({ version, status }));
