// packages/daemon/src/flowReport/brand.ts
//
// FlowReport's style tokens, now FlowCode's.
//
// ── Why this is an adapter rather than a palette ─────────────────────────────
//
// In FlowAgent this file transcribed FlowAgent's own style guide: the violet
// bolt, the magenta accent, League Spartan and Inter from bundled font files.
// FlowCode already has that file for its printed reports
// (`quality/reportBrand.ts`), transcribed from FlowCode's tokens.css, with the
// app's own faces embedded offline. Two style guides in one daemon is two
// answers to "what colour is a critical finding", and one of them is always the
// one that did not get updated — so FlowReport reads FlowCode's, and this file
// only maps the names FlowReport's renderers already use onto it.
//
// ── The one real difference: `info` ─────────────────────────────────────────
//
// FlowReport calls its lowest severity `info`; FlowCode's reports call it
// `informational`. The colour is the same token either way, so the mapping is
// done once here rather than at every call site.
//
// ── What did not come across ─────────────────────────────────────────────────
//
// FlowReport's teal structural accent. It mostly drew the thick bar down the
// left of quotes, reasons and prompts, which FlowCode's reports do not use
// (they set those apart with a fill and a hairline). Where FlowReport put teal
// on type — the contents icons, the repository map's lane labels — FlowCode's
// one accent on paper is used instead.

import * as FC from '../quality/reportBrand.js'
import type { Severity } from './types.js'

export const CANVAS = FC.CANVAS
export const TEXT_PRIMARY = FC.TEXT_PRIMARY
export const TEXT_SECONDARY = FC.TEXT_SECONDARY
export const TEXT_TERTIARY = FC.TEXT_TERTIARY
export const INK = FC.INK
export const INK_SECONDARY = FC.INK_SECONDARY
export const INK_TERTIARY = FC.INK_TERTIARY
export const BORDER_DARK = FC.BORDER_DARK
export const BORDER_DARK_STRONG = FC.BORDER_DARK_STRONG
export const BORDER_LIGHT = FC.BORDER_LIGHT
export const WASH = FC.WASH
export const ACCENT = FC.ACCENT
export const ACCENT_ON_LIGHT = FC.ACCENT_ON_LIGHT
export const SUCCESS = FC.SUCCESS
export const HEADING_STACK = FC.HEADING_STACK
export const BODY_STACK = FC.BODY_STACK
export const MONO_STACK = FC.MONO_STACK

/** FlowReport's structural accent on paper. FlowCode has one accent on type,
 *  so this is it rather than a second hue. */
export const TEAL_ON_LIGHT = FC.ACCENT_ON_LIGHT

/** Severity colours under FlowReport's names. */
export const SEVERITY_COLOUR: Record<Severity, { dark: string; light: string }> = {
  critical: FC.SEVERITY_COLOUR.critical,
  high: FC.SEVERITY_COLOUR.high,
  medium: FC.SEVERITY_COLOUR.medium,
  low: FC.SEVERITY_COLOUR.low,
  info: FC.SEVERITY_COLOUR.informational,
}

/** One accent for every section: a section is told apart by its number, its
 *  icon and its name, and the colour is left free to mean something. */
export const accentFor = (_category?: string): { dark: string; light: string } =>
  ({ dark: FC.ACCENT, light: FC.ACCENT_ON_LIGHT })

/** FlowCode's embedded faces, and the names of any that were not on disk. */
export const reportFontFace = FC.reportFontFace
