// Each test starts from an empty page: whatever the last test rendered is removed.
import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";
// toBeInTheDocument, toHaveTextContent and the other DOM matchers most tests use.
import "@testing-library/jest-dom/vitest";

afterEach(() => cleanup());

// jsdom has <dialog> but not showModal(), show() or close(), so the kit's Dialog would never open in tests
// (Calendar design rebuild: "no dialog named Planning" after two correct fixes). These do what the browser does.
if (typeof HTMLDialogElement !== "undefined") {
  const proto = HTMLDialogElement.prototype as HTMLDialogElement & Record<string, unknown>;
  if (typeof proto.showModal !== "function")
    proto.showModal = function (this: HTMLDialogElement) {
      this.setAttribute("open", "");
    };
  if (typeof proto.show !== "function")
    proto.show = function (this: HTMLDialogElement) {
      this.setAttribute("open", "");
    };
  if (typeof proto.close !== "function")
    proto.close = function (this: HTMLDialogElement, value?: string) {
      if (!this.hasAttribute("open")) return;
      this.removeAttribute("open");
      if (value !== undefined) this.returnValue = value;
      this.dispatchEvent(new Event("close"));
    };
}
