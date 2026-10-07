/** Look check: what a person would call a badly designed screen fails the step, a clean one passes. */
import http from "node:http";
import { describe, expect, it } from "vitest";
import { lookCheck } from "../src/quality/lookCheck.js";
import { BrowserSession } from "../src/quality/preview.js";

const serve = async (html: string) => {
  const server = http.createServer((_req, res) => res.writeHead(200, { "content-type": "text/html" }).end(html));
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  return { server, url: `http://127.0.0.1:${(server.address() as { port: number }).port}/` };
};

const page = (main: string, sim = "") =>
  `<html lang="en"><head><meta name="viewport" content="width=device-width, initial-scale=1"><style>body{font-family:sans-serif}button{background:#4f46e5;color:#fff;border:0;padding:12px}div{display:flex;flex-wrap:wrap}</style></head><body><nav><a href="#c">Calendar</a></nav><main><h1>Calendar</h1>${main}</main>${sim}</body></html>`;

describe.skipIf(process.env.FLOWCODE_SKIP_BROWSER === "1")("look check rules", () => {
  it("fails a control on every item, a repeated empty label, sign in next to sign out, and hidden sample data", async () => {
    // Calendar prototype: "Create" and "0 events" in each day cell, and "No events" while the sample data had eight.
    const cells = Array.from({ length: 14 }, (_, i) => `<div><span>${i + 1}</span><button>Create</button><p>0 events</p></div>`).join("");
    const sim = `<script>window.__simCounts = () => ({ "calendar-events": 8 });</script>`;
    const { server, url } = await serve(page(`<button>Sign out</button><a href="#in">Sign in</a>${cells}`, sim));
    const session = await BrowserSession.launch("test-look-check");
    try {
      const rules = (await lookCheck(session, url)).findings.filter((f) => f.serious).map((f) => f.rule);
      expect(rules).toEqual(expect.arrayContaining(["repeated-controls", "repeated-empty-text", "contradictory-controls", "sample-data-hidden"]));
    } finally {
      server.close();
      await session.close();
    }
  }, 60_000);

  it("passes a composed screen that shows its sample data", async () => {
    const days = Array.from({ length: 14 }, (_, i) => `<button aria-label="October ${i + 1}">${i + 1}</button>`).join("");
    const sim = `<script>window.__simCounts = () => ({ "calendar-events": 3 });</script>`;
    const { server, url } = await serve(page(`<p>Your events for the week of 5 October, saved on this device.</p><button>New event</button><div>${days}</div><ul><li>Team sync</li><li>Dentist</li><li>Book club</li></ul>`, sim));
    const session = await BrowserSession.launch("test-look-check-ok");
    try {
      const serious = (await lookCheck(session, url)).findings.filter((f) => f.serious);
      expect(serious).toEqual([]);
    } finally {
      server.close();
      await session.close();
    }
  }, 60_000);
});

describe("look check behind sign-in", () => {
  it("reads the prototype's demo account from src/sim", async () => {
    const { demoAccount } = await import("../src/quality/lookCheck.js");
    const fs = await import("node:fs");
    const os = await import("node:os");
    const path = await import("node:path");
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "fc-demo-"));
    fs.mkdirSync(path.join(root, "src/sim"), { recursive: true });
    fs.writeFileSync(path.join(root, "src/sim/auth.ts"), `const users = [\n  { id: "user-alex", email: "alex@example.com", password: "password", name: "Alex" },\n];`);
    expect(demoAccount(root)).toEqual({ email: "alex@example.com", password: "password" });
    expect(demoAccount(path.join(root, "nope"))).toBeUndefined();
  });
});

describe.skipIf(process.env.FLOWCODE_SKIP_BROWSER === "1")("look check signs in", () => {
  it("signs in with the demo account and checks the screens behind it", async () => {
    // Calendar design rebuild: Design polish passed after a look at the sign-in screen alone.
    const html = `<html lang="en"><head><meta name="viewport" content="width=device-width, initial-scale=1"><style>body{font-family:sans-serif}button{background:#4f46e5;color:#fff;border:0;padding:12px}</style></head><body><main id="m"><h1>Sign in</h1><form id="f"><label>Email <input type="email" id="e"></label><label>Password <input type="password" id="p"></label><button>Sign in</button></form></main>
<script>document.getElementById("f").onsubmit=(ev)=>{ev.preventDefault(); if(document.getElementById("e").value==="alex@example.com"&&document.getElementById("p").value==="pw"){document.body.innerHTML='<nav><a href="#c">Calendar</a><a href="#s">Settings</a></nav><main><h1>Calendar</h1>'+Array.from({length:8},()=>'<button>Create</button>').join('')+'</main>';}};</script></body></html>`;
    const { server, url } = await serve(html);
    const session = await BrowserSession.launch("test-look-signin");
    try {
      const result = await lookCheck(session, url, { account: { email: "alex@example.com", password: "pw" } });
      expect(result.screens.map((s) => s.name)).toEqual(expect.arrayContaining(["First screen", "After sign-in", "Calendar"]));
      expect(result.findings.some((f) => f.rule === "repeated-controls")).toBe(true);
    } finally {
      server.close();
      await session.close();
    }
  }, 60_000);
});
