import { act, render, renderHook } from "@testing-library/react";
import { createElement, useRef } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { motionMode, moveItems, setMotionOff, transition, useEnterOnce, useSaveState } from "./motion";

/** The document as these tests drive it: View Transitions present, faked or absent. */
const doc = document as unknown as { startViewTransition?: unknown };

/** A stand-in for the browser's View Transitions: the update runs on the next tick, as in a real browser. */
function fakeViewTransitions() {
  const made: Array<{ skipped: boolean }> = [];
  doc.startViewTransition = (cb: () => void) => {
    const rec = { skipped: false };
    made.push(rec);
    const done = Promise.resolve().then(cb);
    return {
      ready: done,
      updateCallbackDone: done,
      finished: done,
      skipTransition: () => {
        rec.skipped = true;
      },
    };
  };
  return made;
}

const realAnimate = Element.prototype.animate;
afterEach(() => {
  Element.prototype.animate = realAnimate;
  delete doc.startViewTransition;
  setMotionOff(false);
  vi.restoreAllMocks();
});

describe("transition", () => {
  it("without View Transitions, the change happens at once", () => {
    const update = vi.fn();
    transition(update);
    expect(update).toHaveBeenCalledTimes(1);
  });

  it("animation off: the change happens at once and no transition starts", () => {
    const made = fakeViewTransitions();
    setMotionOff(true);
    const update = vi.fn();
    transition(update);
    expect(update).toHaveBeenCalledTimes(1);
    expect(made).toHaveLength(0);
  });

  it("a newer change skips the running one; every update still runs, and the last one wins", async () => {
    const made = fakeViewTransitions();
    let state = "a";
    transition(() => (state = "b"));
    transition(() => (state = "c"));
    await Promise.resolve();
    await Promise.resolve();
    expect(made[0]!.skipped).toBe(true);
    expect(state).toBe("c");
  });

  it("a browser that refuses to start one still makes the change", () => {
    doc.startViewTransition = () => {
      throw new Error("InvalidStateError");
    };
    const update = vi.fn();
    transition(update);
    expect(update).toHaveBeenCalledTimes(1);
  });
});

describe("moveItems", () => {
  const list = () => {
    const ul = document.createElement("ul");
    for (const k of ["a", "b", "c"]) {
      const li = document.createElement("li");
      li.dataset.key = k;
      ul.appendChild(li);
    }
    return ul;
  };
  it("applies the change at once; with animation off nothing is animated", () => {
    setMotionOff(true);
    const ul = list();
    const animate = vi.fn();
    Element.prototype.animate = animate as unknown as Element["animate"];
    moveItems(ul, () => ul.prepend(ul.lastElementChild!));
    expect([...ul.children].map((li) => (li as HTMLElement).dataset.key)).toEqual(["c", "a", "b"]);
    expect(animate).not.toHaveBeenCalled();
  });
  it("new items fade in; the change is already applied when the animation starts", () => {
    const ul = list();
    const seen: string[][] = [];
    Element.prototype.animate = function (this: Element) {
      seen.push([...ul.children].map((li) => (li as HTMLElement).dataset.key!));
      return { cancel() {} } as unknown as Animation;
    } as unknown as Element["animate"];
    moveItems(ul, () => {
      const li = document.createElement("li");
      li.dataset.key = "d";
      ul.appendChild(li);
    });
    expect(seen[0]).toEqual(["a", "b", "c", "d"]);
  });
});

describe("motionMode", () => {
  it("is read live: off, then the system's reduced-motion setting, then full", () => {
    let reduce = false;
    vi.stubGlobal("matchMedia", (q: string) => ({ matches: q.includes("reduce") && reduce, media: q, addEventListener() {}, removeEventListener() {} }));
    expect(motionMode()).toBe("full");
    reduce = true;
    expect(motionMode()).toBe("reduced");
    setMotionOff(true);
    expect(motionMode()).toBe("off");
    vi.unstubAllGlobals();
  });
});

describe("useSaveState", () => {
  it("acknowledges at once, coalesces clicks during a save into one more, and ends saved", async () => {
    vi.useFakeTimers();
    const save = vi.fn(() => new Promise<void>((r) => setTimeout(r, 400)));
    const { result } = renderHook(() => useSaveState(save));
    act(() => result.current.trigger());
    expect(result.current.state).toBe("pending");
    for (let i = 0; i < 4; i++) act(() => result.current.trigger());
    await act(async () => void (await vi.advanceTimersByTimeAsync(200)));
    expect(result.current.state).toBe("saving");
    await act(async () => void (await vi.advanceTimersByTimeAsync(1000)));
    expect(save).toHaveBeenCalledTimes(2);
    expect(result.current.state).toBe("saved");
    vi.useRealTimers();
  });

  it("unmounting during a save leaves no timers or state updates behind", async () => {
    vi.useFakeTimers();
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    const { result, unmount } = renderHook(() => useSaveState(() => new Promise<void>((r) => setTimeout(r, 300))));
    act(() => result.current.trigger());
    unmount();
    await vi.advanceTimersByTimeAsync(5000);
    expect(vi.getTimerCount()).toBe(0);
    expect(err).not.toHaveBeenCalled();
    vi.useRealTimers();
  });
});

describe("useEnterOnce", () => {
  it("stops watching when the element goes away", () => {
    const disconnect = vi.fn();
    vi.stubGlobal(
      "IntersectionObserver",
      class {
        observe() {}
        disconnect = disconnect;
      },
    );
    // Off screen (jsdom puts everything at 0; move it below the window).
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({ top: 5000, bottom: 5100, left: 0, right: 0, width: 0, height: 100, x: 0, y: 5000, toJSON() {} } as DOMRect);
    function Item() {
      const ref = useRef<HTMLDivElement>(null);
      useEnterOnce(ref, "item-1");
      return createElement("div", { ref }, "Oat milk");
    }
    const { unmount, getByText } = render(createElement(Item));
    expect(getByText("Oat milk").classList.contains("fc-enter")).toBe(false);
    unmount();
    expect(disconnect).toHaveBeenCalled();
    vi.unstubAllGlobals();
  });
});
