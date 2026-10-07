/**
 * App-wide right-click menu. "Explain this feature" answers from the app guide (via Copilot) for the nearest
 * [data-guide] anchor; contextual quick links come from data-ctx-* attributes on the clicked element.
 * Shift+right-click, text inputs and editable content keep the native browser menu.
 */
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { APP_GUIDE } from "@flowcode/contracts";
import { post } from "../api";
import { navigate } from "../router";
import { copilot, type CopilotPart } from "./Copilot";
import { Icon } from "./ui";

interface Item {
  label: string;
  icon: string;
  run: () => void;
  danger?: boolean;
}
interface Menu {
  x: number;
  y: number;
  title?: string;
  groups: Item[][];
  returnFocus: HTMLElement | null;
}

const closestAttr = (el: Element | null, attr: string) => el?.closest(`[${attr}]`)?.getAttribute(attr) ?? undefined;

function copy(text: string) {
  void navigator.clipboard?.writeText(text).catch(() => undefined);
}

function build(target: Element): Omit<Menu, "x" | "y" | "returnFocus"> | null {
  const guideId = closestAttr(target, "data-guide");
  const guide = guideId ? APP_GUIDE.find((g) => g.id === guideId) : undefined;
  const label = closestAttr(target, "data-ctx-label");
  const project = closestAttr(target, "data-ctx-project");
  const run = closestAttr(target, "data-ctx-run");
  const path = closestAttr(target, "data-ctx-path");
  const task = closestAttr(target, "data-ctx-task");
  const status = closestAttr(target, "data-ctx-status");
  const link = target.closest("a[href]")?.getAttribute("href") ?? undefined;
  const selection = window.getSelection()?.toString().trim();
  const here = location.hash.replace(/^#/, "").split("?")[0] || "/";
  const section = here.split("/")[1] ?? "";
  const pageId = section === "projects" ? "ws.work" : `nav.${section || "projects"}`;
  const pageGuide = APP_GUIDE.find((g) => g.id === pageId);

  const explain: Item[] = [];
  // The exact thing that was right-clicked (a button, link, tab, heading, text…), explained on its own.
  const feature = guide ?? pageGuide;
  const part = feature ? partAt(target, guideId ? target.closest(`[data-guide="${guideId}"]`) : null) : null;
  if (feature && part) explain.push({ label: `Explain "${clip(part.name, 28)}"`, icon: "help", run: () => copilot({ kind: "explain", anchor: feature.id, part }) });
  if (guide) explain.push({ label: "Explain this feature", icon: "layers", run: () => copilot({ kind: "explain", anchor: guide.id }) });
  const subject = label ?? part?.name ?? guide?.title;
  if (subject) explain.push({ label: "Ask Copilot about this", icon: "ask", run: () => copilot({ kind: "prefill", text: `About "${subject}": ` }) });

  const links: Item[] = [];
  if (path) {
    links.push({ label: "Open file", icon: "file", run: () => window.dispatchEvent(new CustomEvent("fc:open-file", { detail: path })) });
    links.push({ label: "Copy path", icon: "copy", run: () => copy(path) });
  }
  if (task && run && (status === "blocked" || status === "failed")) links.push({ label: "Retry this task", icon: "refresh", run: () => void post(`/runs/${run}/tasks/${task}/retry`) });
  if (project && !here.startsWith(`/projects/${project}`)) links.push({ label: "Open workspace", icon: "workspace", run: () => navigate(`/projects/${project}`) });
  if (project && !here.startsWith(`/quality/${project}/launch`)) links.push({ label: "Open launch readiness", icon: "checklist", run: () => navigate(`/quality/${project}/launch`) });
  if (run && !task) links.push({ label: "Open report", icon: "reports", run: () => navigate(`/reports/${run}`) });
  if (link && !link.startsWith("#")) links.push({ label: "Copy link", icon: "external", run: () => copy(link) });
  if (selection) links.push({ label: "Copy selection", icon: "copy", run: () => copy(selection) });
  else if (label && !path) links.push({ label: "Copy name", icon: "copy", run: () => copy(label) });

  // Project management on a build row (the row's ProjectActions opens the dialogs).
  if (project && target.closest(".build-item")) {
    links.push({ label: "Rename project", icon: "edit", run: () => window.dispatchEvent(new CustomEvent("fc:project-action", { detail: { id: project, action: "rename" } })) });
    links.push({ label: "Delete project…", icon: "trash", danger: true, run: () => window.dispatchEvent(new CustomEvent("fc:project-action", { detail: { id: project, action: "delete" } })) });
  }

  const page: Item[] = [];
  if (pageGuide && pageGuide.id !== guide?.id) page.push({ label: "Explain this page", icon: "help", run: () => copilot({ kind: "explain", anchor: pageGuide.id }) });

  const groups = [explain, links, page].filter((g) => g.length);
  if (!groups.length) return null;
  return { title: guide?.title ?? label, groups };
}

const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);
const clean = (s: string | null | undefined) => (s ?? "").replace(/\s+/g, " ").trim();

/** The specific part under the pointer, with what kind of thing it is and a little surrounding text for context. */
function partAt(target: Element, anchor: Element | null): CopilotPart | null {
  const KINDS: Array<[string, string]> = [
    ["[data-part]", "part"],
    ["[role=tab]", "tab"],
    ["[role=radio], [role=switch], input[type=checkbox], input[type=radio]", "option"],
    ["button, [role=button]", "button"],
    ["a[href]", "link"],
    ["select", "menu"],
    ["label", "label"],
    ["h1, h2, h3, h4", "heading"],
    ["th", "column"],
    [".chip, .net-chip", "tag"],
    ["img, svg, canvas", "image"],
  ];
  for (const [sel, kind] of KINDS) {
    const el = target.closest(sel);
    // Ignore matches outside the feature's own container, and the container itself (that's the whole feature).
    if (!el || el === anchor || (anchor && !anchor.contains(el))) continue;
    const name = clean(el.getAttribute("data-part") ?? el.getAttribute("aria-label") ?? el.getAttribute("title") ?? (el as HTMLElement).innerText ?? el.textContent).split(" · ")[0];
    if (!name || name.length < 2) continue;
    return { name: clip(name, 80), kind, context: contextOf(el) };
  }
  // Plain content: a paragraph, list item or table cell.
  const text = target.closest("p, li, td, dd, span, strong, em, code");
  if (text && text !== anchor && (!anchor || anchor.contains(text))) {
    const name = clean((text as HTMLElement).innerText);
    if (name.length >= 2) return { name: clip(name, 80), kind: "text", context: contextOf(text) };
  }
  return null;
}

/** The nearest heading or card title around a part, so "Show them" is understood as "Show them (in Research desk)". */
function contextOf(el: Element): string | undefined {
  const box = el.closest("section, article, li, [role=dialog], [role=tabpanel], form");
  const head = box?.querySelector("h1, h2, h3, h4, strong, .section__title");
  const text = clean(head && head !== el && !head.contains(el) ? (head as HTMLElement).innerText : "");
  return text ? clip(text, 200) : undefined;
}

export function ContextMenu() {
  const [menu, setMenu] = useState<Menu | null>(null);
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const on = (e: MouseEvent) => {
      const t = e.target as HTMLElement | null;
      if (!t || e.shiftKey) return;
      if (t.closest("input, textarea, select, [contenteditable=''], [contenteditable='true'], .copilot, .ctx-menu")) return;
      const m = build(t);
      if (!m) return;
      e.preventDefault();
      // Keyboard-invoked (Shift+F10 / Menu key) events carry no pointer position: anchor to the element.
      let { clientX: x, clientY: y } = e;
      if (x === 0 && y === 0) {
        const r = t.getBoundingClientRect();
        x = r.left + 12;
        y = r.bottom - 4;
      }
      setMenu({ ...m, x, y, returnFocus: document.activeElement as HTMLElement | null });
    };
    document.addEventListener("contextmenu", on);
    return () => document.removeEventListener("contextmenu", on);
  }, []);

  useLayoutEffect(() => {
    if (!menu || !ref.current) return setPos(null);
    const r = ref.current.getBoundingClientRect();
    setPos({ x: Math.max(8, Math.min(menu.x, innerWidth - r.width - 8)), y: Math.max(8, Math.min(menu.y, innerHeight - r.height - 8)) });
    ref.current.querySelector<HTMLButtonElement>("[role=menuitem]")?.focus();
  }, [menu]);

  useEffect(() => {
    if (!menu) return;
    const close = () => setMenu(null);
    const onDown = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && close();
    addEventListener("mousedown", onDown, true);
    addEventListener("resize", close);
    addEventListener("blur", close);
    addEventListener("hashchange", close);
    addEventListener("scroll", close, true);
    return () => {
      removeEventListener("mousedown", onDown, true);
      removeEventListener("resize", close);
      removeEventListener("blur", close);
      removeEventListener("hashchange", close);
      removeEventListener("scroll", close, true);
    };
  }, [menu]);

  if (!menu) return null;
  const dismiss = () => {
    const f = menu.returnFocus;
    setMenu(null);
    f?.focus?.();
  };
  const onKey = (e: React.KeyboardEvent) => {
    const items = [...(ref.current?.querySelectorAll<HTMLButtonElement>("[role=menuitem]") ?? [])];
    const i = items.indexOf(document.activeElement as HTMLButtonElement);
    if (e.key === "ArrowDown") items[(i + 1) % items.length]?.focus();
    else if (e.key === "ArrowUp") items[(i - 1 + items.length) % items.length]?.focus();
    else if (e.key === "Home") items[0]?.focus();
    else if (e.key === "End") items.at(-1)?.focus();
    else if (e.key === "Escape" || e.key === "Tab") dismiss();
    else return;
    e.preventDefault();
  };

  return (
    <div ref={ref} className="ctx-menu" role="menu" aria-label={menu.title ? `${menu.title} actions` : "Actions"} style={{ left: pos?.x ?? menu.x, top: pos?.y ?? menu.y, visibility: pos ? "visible" : "hidden" }} onKeyDown={onKey} onContextMenu={(e) => e.preventDefault()}>
      {menu.title ? <div className="ctx-menu__title">{menu.title}</div> : null}
      {menu.groups.map((g, gi) => (
        <div key={gi} role="group" className="ctx-menu__group">
          {g.map((it) => (
            <button
              key={it.label}
              role="menuitem"
              tabIndex={-1}
              className={`ctx-menu__item${it.danger ? " ctx-menu__item--danger" : ""}`}
              onClick={() => {
                setMenu(null);
                it.run();
              }}
            >
              <Icon name={it.icon} size={16} />
              {it.label}
            </button>
          ))}
        </div>
      ))}
      <div className="ctx-menu__hint">Shift + right-click for the browser menu</div>
    </div>
  );
}
