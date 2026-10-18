import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { resetNavigationForTests, screenFromHash, useNavigation, useRoute } from "./screens";

describe("screenFromHash", () => {
  const ids = ["home", "goals", "settings"] as const;
  it("reads the screen from the hash", () => {
    expect(screenFromHash("#/goals", ids)).toBe("goals");
    expect(screenFromHash("#settings", ids)).toBe("settings");
  });
  it("falls back to the first screen", () => {
    expect(screenFromHash("", ids)).toBe("home");
    expect(screenFromHash("#/nope", ids)).toBe("home");
  });
});

const IDS = ["home", "orders", "settings"];
const hashChange = async (hash: string) => {
  await act(async () => {
    window.location.hash = hash;
    await new Promise((r) => setTimeout(r, 0));
  });
};

describe("navigation kinds", () => {
  beforeEach(() => {
    window.history.replaceState(null, "", "#/home");
    resetNavigationForTests();
  });
  afterEach(() => resetNavigationForTests());

  it("a new page, a same-page update (only the query), and Back are told apart", async () => {
    const { result } = renderHook(() => ({ route: useRoute(IDS), nav: useNavigation() }));
    await hashChange("#/orders");
    expect(result.current.route.screen).toBe("orders");
    expect(result.current.nav.kind).toBe("new");
    await hashChange("#/orders?q=late");
    expect(result.current.nav.kind).toBe("same-page");
    expect(result.current.route.query.get("q")).toBe("late");
    await act(async () => {
      window.history.back();
      await new Promise((r) => setTimeout(r, 50));
    });
    expect(result.current.route.query.get("q")).toBeNull();
    expect(result.current.nav.kind).toBe("same-page");
    await act(async () => {
      window.history.back();
      await new Promise((r) => setTimeout(r, 50));
    });
    expect(result.current.route.screen).toBe("home");
    expect(result.current.nav).toMatchObject({ kind: "back-forward", direction: "back" });
  });

  it("going where you already are does nothing", async () => {
    const { result } = renderHook(() => useNavigation());
    const before = result.current.seq;
    await hashChange("#/home");
    expect(result.current.seq).toBe(before);
  });

  it("the last of several quick navigations wins", async () => {
    const { result } = renderHook(() => useRoute(IDS));
    await act(async () => {
      window.location.hash = "#/orders";
      window.location.hash = "#/settings";
      window.location.hash = "#/orders/42";
      await new Promise((r) => setTimeout(r, 20));
    });
    expect(result.current.screen).toBe("orders");
    expect(result.current.id).toBe("42");
  });
});
