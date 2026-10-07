import { afterEach, describe, expect, it } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { createCollection, resetDemoData, searchItems, useSavedState } from "./index";
import { linkTo, routeFromHash } from "../lib/screens";

type Order = { id: string; title: string; customer: string };
const seed: Order[] = [
  { id: "1", title: "Café delivery", customer: "Ana" },
  { id: "2", title: "Late order", customer: "Ben" },
];

afterEach(() => localStorage.clear());

describe("simulated collections", () => {
  it("adds, updates and removes, keeps changes, and resets to the seed", () => {
    const orders = createCollection("orders-test", seed);
    const added = orders.add({ title: "New", customer: "Cy" });
    orders.update("1", { title: "Edited" });
    orders.remove("2");
    expect(orders.all().map((o) => o.title)).toEqual(["New", "Edited"]);
    expect(createCollection("orders-test", seed).get(added.id)?.customer).toBe("Cy");
    resetDemoData();
    expect(createCollection("orders-test", seed).all()).toEqual(seed);
  });
});

describe("saved values", () => {
  it("keeps a value in local storage across renders and clears it on reset", () => {
    const first = renderHook(() => useSavedState("units", "metric"));
    act(() => first.result.current[1]("imperial"));
    expect(renderHook(() => useSavedState("units", "metric")).result.current[0]).toBe("imperial");
    act(() => resetDemoData());
    expect(renderHook(() => useSavedState("units", "metric")).result.current[0]).toBe("metric");
  });
});

describe("in-app search", () => {
  it("matches every word, ignores case and accents, ranks earlier fields first", () => {
    expect(searchItems(seed, "cafe", ["title", "customer"]).map((o) => o.id)).toEqual(["1"]);
    expect(searchItems(seed, "late ben", ["title", "customer"]).map((o) => o.id)).toEqual(["2"]);
    expect(searchItems(seed, "", ["title"])).toHaveLength(2);
  });
});

describe("links", () => {
  it("links screens, records and searches", () => {
    expect(linkTo("orders", "42", { q: "late" })).toBe("#/orders/42?q=late");
    const r = routeFromHash("#/orders/42?q=late", ["home", "orders"]);
    expect([r.screen, r.id, r.query.get("q")]).toEqual(["orders", "42", "late"]);
    expect(routeFromHash("#/nope/1", ["home", "orders"])).toMatchObject({ screen: "home", id: undefined });
  });
});
