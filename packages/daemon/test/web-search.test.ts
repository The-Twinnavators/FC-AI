import { describe, expect, it } from "vitest";
import { blockReason, chunkText, uploadDocument } from "../src/web/webSearch.js";
import { makeApp } from "./helpers.js";

const s = { searxUrl: "http://127.0.0.1:8888", blockDarkWeb: true as const, blocklist: ["badsite.com", "*.spam.net"], safeSearch: 1 as const };

describe("web search safety", () => {
  it("always blocks dark web hosts and gateways", () => {
    expect(blockReason("http://abcdefghijklmnop.onion/", s)).toBe("dark web");
    expect(blockReason("https://site.i2p/x", s)).toBe("dark web");
    expect(blockReason("https://xyz.onion.ly/page", s)).toBe("dark web");
    expect(blockReason("https://tor2web.org/", s)).toBe("dark web");
  });
  it("applies the user blocklist to subdomains", () => {
    expect(blockReason("https://www.badsite.com/a", s)).toMatch(/blocklisted/);
    expect(blockReason("https://x.spam.net/", s)).toMatch(/blocklisted/);
    expect(blockReason("https://notbadsite.com/", s)).toBeUndefined();
    expect(blockReason("https://example.com/", s)).toBeUndefined();
  });
  it("rejects non-web links", () => {
    expect(blockReason("javascript:alert(1)", s)).toBe("not a web link");
    expect(blockReason("file:///etc/passwd", s)).toBe("not a web link");
  });
});

describe("knowledge uploads", () => {
  it("chunks long documents on paragraph boundaries", () => {
    const text = Array.from({ length: 30 }, (_, i) => `Paragraph ${i} `.repeat(40)).join("\n\n");
    const chunks = chunkText(text, 2000);
    expect(chunks.length).toBeGreaterThan(5);
    expect(chunks.every((c) => c.length <= 2000)).toBe(true);
    expect(chunks.join("\n\n").replace(/\s+/g, "")).toBe(text.replace(/\s+/g, ""));
  });
  it("stores text documents (including text extracted from PDFs) as user-confirmed sources and rejects other binaries", async () => {
    const { app } = makeApp();
    const items = uploadDocument(app, { name: "brand-guide.md", content: "# Brand\n\nUse the violet logo.\n\nNever stretch it." });
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ kind: "source", title: "brand-guide", confirmedByUser: true, durability: "durable" });
    expect(app.knowledge.search("violet logo").some((r) => r.id === items[0].id)).toBe(true);
    expect(uploadDocument(app, { name: "spec.pdf (part 1 of 2)", content: "## Page 1\n\nExtracted text" })[0].tags).toContain("pdf");
    expect(() => uploadDocument(app, { name: "tool.exe", content: "MZ" })).toThrow(/Unsupported file type/);
  });
});
