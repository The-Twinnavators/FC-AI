/**
 * Figma links in a request or PRD. When a build names Figma frames, its design steps build from them through the Figma
 * MCP server (the Figma desktop app's Dev Mode server): the frame's structure and values, the file's variables mapped
 * to the Styles page tokens, and a screenshot to compare against.
 */

export interface FigmaLink {
  url: string;
  fileKey: string;
  /** The frame, as Figma's tools want it ("12:345"); absent for a link to the whole file. */
  nodeId?: string;
  name?: string;
}

/** Tools of Figma's server in the order a design step needs them (others come after). */
export const FIGMA_TOOL_ORDER = ["get_design_context", "get_code", "get_variable_defs", "get_screenshot", "get_image", "get_metadata", "get_code_connect_map"];

/** Every Figma design, file, prototype or Make link in the text, once each. */
export function figmaLinks(text: string): FigmaLink[] {
  const out = new Map<string, FigmaLink>();
  for (const m of text.matchAll(/https?:\/\/(?:www\.)?figma\.com\/(?:design|file|proto|make)\/([A-Za-z0-9]{10,64})(?:\/([^\s?#)"'\]]*))?(\?[^\s#)"'\]]*)?/g)) {
    const [url, fileKey, slug, rawQuery] = m;
    // A link at the end of a sentence keeps its full stop out of the frame id.
    const query = rawQuery?.replace(/[.,;:!]+$/, "");
    const raw = new URLSearchParams(query ?? "").get("node-id") ?? undefined;
    const nodeId = raw ? decodeURIComponent(raw).replace(/-/g, ":") : undefined;
    const key = `${fileKey}|${nodeId ?? ""}`;
    if (!out.has(key)) out.set(key, { url: url.replace(/[.,;]+$/, ""), fileKey, nodeId, name: slug ? decodeURIComponent(slug).replace(/[-_]+/g, " ").trim() || undefined : undefined });
  }
  return [...out.values()].slice(0, 12);
}

/** What a design step is told about the Figma frames it builds from. */
export function figmaBrief(links: FigmaLink[], server: { ready: boolean; name?: string; tools?: string[]; error?: string }): string {
  const list = links.map((l) => `- ${l.name ?? "Figma file"}${l.nodeId ? ` (frame ${l.nodeId})` : " (whole file: pick the frames for this step)"}: ${l.url}`).join("\n");
  if (!server.ready)
    return `Figma design: this build links ${links.length === 1 ? "a Figma design" : `${links.length} Figma frames`}, but the Figma server isn't connected${server.error ? ` (${server.error})` : ""}, so the designs can't be read. Build from the PRD and any screenshots in spec/; don't guess what the frames contain.\n${list}`;
  const has = (t: string) => !server.tools || server.tools.includes(t);
  const context = has("get_design_context") ? "get_design_context" : "get_code";
  const shot = has("get_screenshot") ? "get_screenshot" : "get_image";
  return [
    `Figma design: build these screens from the linked Figma frames (they are the design; follow them over the default layouts):`,
    list,
    `How, for each frame this step builds (pass nodeId like "12:345"):`,
    `1. ${context} for the frame: its layout, spacing, sizes, colours, text styles and content. Read it as a spec, then write the screen with this app's React components and CSS, not the code it suggests verbatim (no Tailwind, no absolute positions, no copied class soup).`,
    `2. get_variable_defs: the file's colour, type, spacing and radius variables. Put them in src/styles/tokens.css as the app's tokens (keep the existing token names and change their values; add a token only for a value that has no match), so the Styles page shows the Figma design system. Use tokens in components, never raw hex.`,
    `3. ${shot}: look at the frame and check your screen against it before task_complete (structure, order, spacing, type sizes, colours, imagery).`,
    `Reuse the kit's components (src/components/ui) for buttons, fields, cards and dialogs, styled to match the frame. Icons from lucide-react matching the frame's icons. Real content from the frame, not lorem ipsum. Where a frame is missing a state (empty, loading, error, phone width), design it in the same style.`,
  ].join("\n");
}
