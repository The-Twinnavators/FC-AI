// packages/daemon/src/flowReport/report/figures.ts
//
// The icon set. One glyph per section.
//
// The glyphs themselves now live with FlowCode's other report icons
// (`quality/reportPdf/figures.ts`), keyed by Repo Report's category ids, because
// the document shell that draws the contents page and the section dividers is
// FlowCode's and looks them up there. This keeps Repo Report's name for the call.
//
// Icons are hand-drawn rather than fetched because these documents render in a
// headless browser with no network, where an icon font from a CDN prints as an
// empty box.

import { sectionIcon } from '../../quality/reportPdf/figures.js'
import { ACCENT_ON_LIGHT } from '../brand.js'

/** Empty string for an unknown name, so a caller can interpolate it without
 *  checking and get nothing rather than a broken glyph. */
export function icon(name: string, sizeMm = 4.6, colour = ACCENT_ON_LIGHT): string {
  return sectionIcon(name, sizeMm, colour)
}
