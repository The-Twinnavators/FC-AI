/** CSSVibes style capture: CSS, HTML, images and websites become colours, fonts, corners and a surface style. */
import http from "node:http";
import { describe, expect, it } from "vitest";
import { colorsFromImage, mergeStyles, partFromImageColors, styleFromCss, styleFromHtml, styleFromUrl, toHex } from "../src/workspace/styleCapture.js";
import { BrowserSession } from "../src/quality/preview.js";

describe("style capture from CSS and HTML", () => {
  it("reads CSS colours in any notation", () => {
    expect(toHex("#0af")).toBe("#00aaff");
    expect(toHex("rgb(20, 183, 218)")).toBe("#14b7da");
    expect(toHex("rgba(0,0,0,0.1)")).toBeUndefined();
    expect(toHex("hsl(0, 100%, 50%)")).toBe("#ff0000");
    expect(toHex("transparent")).toBeUndefined();
  });

  it("takes declared brand colours first, then fonts, button corners and the surface style", () => {
    const css = `
      @import url("https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700&family=DM+Sans&display=swap");
      :root { --brand-primary: #042935; --accent: #14b7da; --bg: #f7f7f2; }
      body { background: var(--bg); color: #1a1a1a; font-family: "DM Sans", system-ui, sans-serif; }
      h1, h2 { font-family: "Playfair Display", Georgia, serif; }
      .btn { background: var(--brand-primary); border-radius: 12px; }
      .card { backdrop-filter: blur(12px); border-radius: 16px; }
      .panel { -webkit-backdrop-filter: blur(8px); }
      a { color: #57445e; }`;
    const p = styleFromCss(css, "site.css");
    const m = mergeStyles([p]);
    expect(m.brand.slice(0, 2)).toEqual(["#042935", "#14b7da"]);
    expect(m.brand).toContain("#57445e");
    expect(p.background).toBe("#f7f7f2");
    expect(p.text).toBe("#1a1a1a");
    expect(p.fonts).toEqual({ display: "Playfair Display", body: "DM Sans" });
    expect(p.radiusPx).toBe(16);
    expect(p.vibe).toBe("glass");
  });

  it("never takes status colours (danger, success, warning) as brand colours", () => {
    const css = `:root { --color-accent: #4f46e5; --color-danger: #c52f43; --color-success: #16845b; }
      .button-primary { background: var(--color-accent); }
      .button-danger { background: var(--color-danger); }
      .notice { color: var(--color-success); }
      .alert-warning { background: #b7791f; }`;
    expect(mergeStyles([styleFromCss(css, "theme.css")]).brand).toEqual(["#4f46e5"]);
  });

  it("reads an HTML page's style blocks, inline styles and font links", () => {
    const html = `<html><head><link href="https://fonts.googleapis.com/css2?family=Inter&amp;display=swap" rel="stylesheet">
      <style>body{background:#ffffff} button{background:#e4572e;border-radius:999px}</style></head>
      <body><a style="color:#29335c">Docs</a><button>Go</button></body></html>`;
    const p = styleFromHtml(html, "page.html");
    expect(mergeStyles([p]).brand[0]).toBe("#e4572e");
    expect(p.fonts.display).toBe("Inter");
    expect(p.radiusPx).toBe(999);
  });

  it("splits an image's colours into background, text and brand, favouring saturated accents", () => {
    const p = partFromImageColors("shot.png", [
      { hex: "#fafafa", weight: 6000 },
      { hex: "#202020", weight: 900 },
      { hex: "#8a8f99", weight: 700 },
      { hex: "#ff5a1f", weight: 300 },
      { hex: "#5b6b7a", weight: 600 },
    ]);
    expect(p.background).toBe("#fafafa");
    expect(p.text).toBe("#202020");
    expect(mergeStyles([p]).brand[0]).toBe("#ff5a1f");
  });

  it("merges sources, the most exact first, and keeps distinct colours only", () => {
    const site = { source: "https://example.com", colors: [{ hex: "#042935", weight: 10 }, { hex: "#05293a", weight: 5 }], fonts: { body: "Inter" }, radiusPx: 8 };
    const img = { source: "mock.png", colors: [{ hex: "#14b7da", weight: 3 }], fonts: { body: "Roboto Slab" }, radiusPx: 20 };
    const m = mergeStyles([site, img]);
    expect(m.brand).toEqual(["#042935", "#14b7da"]);
    expect(m.fonts.body).toBe("Inter");
    expect(m.radiusPx).toBe(8);
    expect(m.sources).toEqual(["https://example.com", "mock.png"]);
  });
});

describe.skipIf(process.env.FLOWCODE_SKIP_BROWSER === "1")("style capture in the browser", () => {
  it("counts an image's colours and reads a page's computed styles", async () => {
    const session = await BrowserSession.launch("test-style-capture");
    try {
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect width="100" height="100" fill="#ffffff"/><rect width="40" height="20" fill="#e4572e"/></svg>`;
      const counted = await colorsFromImage(session, Buffer.from(svg).toString("base64"), "image/svg+xml");
      const part = partFromImageColors("logo.svg", counted);
      expect(part.background).toBe("#ffffff");
      expect(mergeStyles([part]).brand[0]).toBe("#e4572e");

      const page = `<html><body style="background:#f4f1ea;color:#222;font-family:'Lora',serif"><h1 style="font-family:'Playfair Display'">Hi</h1><button style="background:#2a9d8f;border-radius:10px;color:#fff">Buy</button></body></html>`;
      const server = http.createServer((_req, res) => res.writeHead(200, { "content-type": "text/html" }).end(page));
      await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
      try {
        const { part: site } = await styleFromUrl(session, `http://127.0.0.1:${(server.address() as { port: number }).port}/`);
        expect(site.background).toBe("#f4f1ea");
        expect(site.fonts).toEqual({ display: "Playfair Display", body: "Lora" });
        expect(site.radiusPx).toBe(10);
        expect(mergeStyles([site]).brand[0]).toBe("#2a9d8f");
      } finally {
        server.close();
      }
    } finally {
      await session.close();
    }
  }, 60_000);
});

describe("captured fonts the app can load", () => {
  it("keeps Google fonts, strips variable-font suffixes, and swaps proprietary fonts for open lookalikes with a note", async () => {
    // No BIO & GMO build: "Square Sans Display VF" went into a Google Fonts link Google answered with an error.
    const { googleFonts } = await import("../src/workspace/styleCapture.js");
    const onGoogle = new Set(["DM Serif Display", "Manrope"]);
    const real = globalThis.fetch;
    globalThis.fetch = (async (url: string) => {
      const fam = decodeURIComponent(new URL(url).searchParams.get("family")!.split(":")[0]).replace(/\+/g, " ");
      return { ok: onGoogle.has(fam) } as Response;
    }) as typeof fetch;
    try {
      const notes: string[] = [];
      expect(await googleFonts({ display: "DM Serif Display", body: "Square Sans Text VF" }, notes)).toEqual({ display: "DM Serif Display", body: "DM Sans" });
      expect(notes[0]).toMatch(/Square Sans Text VF isn't on Google Fonts, so the app uses DM Sans/);
      expect(await googleFonts({ display: "Manrope Variable", body: "Helvetica Neue" }, [])).toEqual({ display: "Manrope", body: "Inter" });
    } finally {
      globalThis.fetch = real;
    }
  });
});
