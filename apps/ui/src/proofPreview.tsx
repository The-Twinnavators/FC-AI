/**
 * A design proof, drawn (proof-preview.html, framed by the design review): the proposed home page made of the
 * Component library's own sections, each rendered with the content the designer wrote for it, in the proof's tokens,
 * fonts and surface style. A proposal, not a built app: the build composes the same sections with the same
 * specification once the person approves it.
 */
import { createRoot } from "react-dom/client";
import { Component, type ComponentType, type ReactNode } from "react";
import { PROOF_BLOCKS, type ProofPage } from "@flowcode/contracts";
import { previewBaseCss } from "./libraryStyle";
import baseCss from "../../../templates/library/library.css?raw";

const modules = import.meta.glob<Record<string, unknown>>("../../../templates/library/sections/*.tsx");
const categoryCss = import.meta.glob<string>("../../../templates/library/css/*.css", { query: "?raw", import: "default", eager: true });

interface ProofMessage {
  type: "fl-proof";
  page: ProofPage;
  tokens: Record<string, string>;
}

/** One section that can't be drawn (props the component can't read) doesn't take the page down. */
class Guard extends Component<{ name: string; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? <p style={{ margin: "24px auto", maxWidth: 960, padding: "12px 16px", border: "1px dashed var(--color-border-strong)", borderRadius: 8, color: "var(--color-text-muted)", fontSize: 14 }}>The {this.props.name} section couldn't be drawn from this proposal's content.</p> : this.props.children;
  }
}

async function load(page: ProofPage) {
  return Promise.all(
    page.sections.map(async (s) => {
      const block = PROOF_BLOCKS.find((b) => b.id === s.block);
      const mod = block ? await modules[`../../../templates/library/sections/${block.id}.tsx`]?.() : undefined;
      return { s, C: (block && mod?.[block.component]) as ComponentType<Record<string, unknown>> | undefined };
    }),
  );
}

const root = createRoot(document.getElementById("root")!);
let style: HTMLStyleElement | undefined;
window.addEventListener("message", (e: MessageEvent<ProofMessage>) => {
  if (e.origin !== location.origin || e.data?.type !== "fl-proof") return;
  const m = e.data;
  if (!style) {
    style = document.createElement("style");
    document.head.appendChild(style);
  }
  // FlowCode's bundled fonts and base tokens, the library's styles, then the proof's own tokens on top.
  style.textContent = [
    previewBaseCss("", ""),
    "html,body{margin:0;background:var(--color-bg);background-image:var(--page-backdrop,none);color:var(--color-text);font-family:var(--font-sans);font-size:var(--text-md);-webkit-font-smoothing:antialiased}*,*::before,*::after{box-sizing:border-box}",
    baseCss,
    ...Object.keys(categoryCss).sort().map((k) => categoryCss[k]),
    `:root{${Object.entries(m.tokens).map(([k, v]) => `${k}:${v}`).join(";")}}`,
  ].join("\n\n");
  void load(m.page).then((parts) =>
    root.render(
      <>
        {parts.map(({ s, C }, i) =>
          C ? (
            <Guard key={i} name={s.block}>
              <C {...s.props} />
            </Guard>
          ) : null,
        )}
      </>,
    ),
  );
});
parent.postMessage({ type: "fl-proof-ready" }, location.origin);
