import { describe, expect, it } from "vitest";
import { pickSections, sectionFile } from "../src/orchestrator/sectionRecipes.js";

const ids = (text: string, seed = "p1") => pickSections(text, seed).map((p) => p.id);

describe("library section picks", () => {
  it("adds nothing to an app whose spec asks for no section (a calculator)", () => {
    expect(ids("A calculator app with a history of past results and keyboard support.")).toEqual([]);
  });

  it("gives a website its frame: header, hero, a closing call to action and a footer", () => {
    const got = ids("A landing page for a booking service for small studios. It explains the service and invites people to sign up.");
    expect(got[0]).toBe("navbar-simple");
    expect(got).toEqual(expect.arrayContaining(["cta-banner", "footer-simple"]));
    expect(got.some((x) => x.startsWith("hero-"))).toBe(true);
  });

  it("chooses variants from the spec's real content", () => {
    expect(ids("Website with pricing: monthly $8 or yearly $80.")).toContain("pricing-toggle");
    expect(ids("Website with pricing: Starter, Studio and Team plans.")).toContain("pricing-tiers");
    expect(ids("A portfolio website for an architecture studio.")[0]).toBe("navbar-centered");
    expect(ids("Landing page. 2,400 bookings a week, 38% fewer no-shows, 4.8 stars from 900 reviews.")).toContain("hero-stats");
  });

  it("never invents testimonials: asked for with no real quotes adds none", () => {
    expect(ids("Website with testimonials from customers.")).not.toEqual(expect.arrayContaining(["testimonials-cards", "testimonial-feature"]));
    expect(ids(`Website with testimonials: "It saved my evenings, honestly the best tool we use." and "No-shows dropped in the first month for us."`)).toContain("testimonials-cards");
  });

  it("always gives the same project the same answer", () => {
    const spec = "A website for a bakery that takes orders.";
    expect(ids(spec, "seed-a")).toEqual(ids(spec, "seed-a"));
  });

  it("gives an app with several sections a side navigation, chosen by what the app is", () => {
    const side = (text: string) => ids(text).filter((x) => x.startsWith("sidebar-"));
    expect(side("An admin dashboard for a studio: bookings, clients, reports and settings.")).toEqual(["sidebar-app"]);
    expect(side("A support dashboard for a help desk: an inbox of customer messages, contacts and reports.")).toEqual(["sidebar-rail"]);
    expect(side("A landing page for a bakery.")).toEqual([]);
  });

  it("names section files as components", () => {
    expect(sectionFile("hero-split")).toBe("src/sections/HeroSplit.tsx");
  });
});

describe("library styles in an app", () => {
  it("are the base, the page backgrounds and only the categories the app's pieces use", async () => {
    const { libraryStyles } = await import("../src/orchestrator/sectionRecipes.js");
    const all = libraryStyles();
    const cart = libraryStyles(`<aside className="fl-shop-drawer"><div className="fl-shop-line" /></aside>`);
    const none = libraryStyles("");
    expect(cart).toContain(".fl-shop-");
    expect(cart).not.toContain(".fl-nb-");
    expect(cart).toContain(".fl-bg-mesh");
    expect(none.length).toBeLessThan(all.length / 3);
    expect(cart.length).toBeLessThan(all.length / 2);
  });
});
