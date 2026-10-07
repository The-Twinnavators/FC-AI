/**
 * unDraw illustrations (https://undraw.co, free under the unDraw license). Drop downloaded SVGs into
 * src/assets/illustrations/<slug>.svg; they are bundled at build time (no network at runtime) and recoloured:
 * unDraw's accent (#6c63ff) follows the brand accent, its dark ink (#090814, #3f3d56, #2f2e41) and light greys follow the theme,
 * so every illustration works in light and dark mode. Missing files render a labelled placeholder.
 */
const FILES = import.meta.glob("../assets/illustrations/*.svg", { query: "?raw", import: "default", eager: true }) as Record<string, string>;

const SVGS: Record<string, string> = Object.fromEntries(Object.entries(FILES).map(([path, svg]) => [path.split("/").pop()!.replace(/\.svg$/, ""), prepare(svg)]));

/** Local files only, but still strip anything executable before inlining. Then bind unDraw's palette to tokens. */
function prepare(svg: string): string {
  return svg
    .replace(/<\?xml[^>]*>/i, "")
    .replace(/<!DOCTYPE[^>]*>/i, "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<foreignObject[\s\S]*?<\/foreignObject>/gi, "")
    .replace(/\son[a-z]+\s*=\s*("[^"]*"|'[^']*')/gi, "")
    .replace(/(href|xlink:href)\s*=\s*("|')\s*javascript:[^"']*\2/gi, "")
    .replace(/fill="#6c63ff"/gi, 'fill="currentColor"')
    .replace(/fill="#(3f3d56|2f2e41|090814)"/gi, 'style="fill:var(--ill-ink)"')
    .replace(/fill="#(e6e6e6|f2f2f2|ccc|cccccc|e4e4e4|d6d6e3|b3b3b3)"/gi, 'style="fill:var(--ill-surface)"')
    // Size comes from the container: drop the root element's fixed width and height (the viewBox keeps the ratio).
    .replace(/<svg\b[^>]*>/, (tag) => tag.replace(/\s(width|height)="[^"]*"/g, "").replace(/^<svg\b/, '<svg preserveAspectRatio="xMidYMid meet" role="presentation"'));
}

export const ILLUSTRATIONS_AVAILABLE = Object.keys(SVGS);

export function Illustration({ slug, label, maxWidth = 320 }: { slug: string; label: string; maxWidth?: number }) {
  const svg = SVGS[slug];
  if (!svg)
    return (
      <div className="illus illus--missing" style={{ maxWidth }} role="img" aria-label={`${label} (illustration not added yet)`}>
        <span className="mono">{slug}.svg</span>
        <span>Download from undraw.co and add to src/assets/illustrations/</span>
      </div>
    );
  // Local, sanitised SVG markup bundled from the project's own assets folder.
  return <div className="illus" style={{ maxWidth }} role="img" aria-label={label} dangerouslySetInnerHTML={{ __html: svg }} />;
}
