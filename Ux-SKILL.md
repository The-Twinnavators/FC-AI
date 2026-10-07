---
name: ui-ux-pro-max
description: Design intelligence for building professional, accessible UI/UX in any web, mobile, or desktop stack. Generates a tailored design system (layout pattern, visual style, color palette, typography, effects, anti-patterns) from the product type, then implements and audits the UI against a pre-delivery checklist. Use this skill whenever the task will change how a feature looks, feels, moves, or is interacted with — building, designing, creating, implementing, reviewing, fixing, improving, refactoring, or polishing any page, screen, component, landing page, dashboard, form, app UI, or design system — even if the user never says "design" or "UI/UX".
---

# UI/UX Pro Max — Design Intelligence

Turn a vague UI request into a deliberate, product-appropriate design system, then build it to production quality. Never jump straight to code with default styling; decide the design first, write it down, then implement and verify.

## When to use

**Always use** when building or modifying: landing pages, marketing sites, dashboards, admin panels, forms, onboarding, settings, e-commerce flows, mobile app screens, component libraries, or any visual polish task.

**Also use** when reviewing UI code for UX, accessibility, responsiveness, or consistency problems.

**Skip** for pure backend, data, infrastructure, or logic work with no visible UI change.

---

## Core workflow

Follow these steps in order. Steps 1–3 should be brief and shown to the user before large builds.

### Step 1 — Analyze the request

Extract:
- **Product type** (match to the Industry Rules table below; pick the closest)
- **Audience** (consumer / professional / enterprise / children / older adults)
- **Primary goal** (convert, inform, operate a tool, browse, transact, entertain)
- **Platform & stack** (default: HTML + Tailwind if unspecified)
- **Brand constraints** (existing colors, fonts, logos, design system — these always override recommendations)
- **Mode** (light, dark, or both)

If a `design-system/<project>/MASTER.md` exists, read it first and skip to Step 4 (see Persistence).

### Step 2 — Generate the design system

Produce this block and keep it as the source of truth for the task:

```
DESIGN SYSTEM: <Project name>
PATTERN:     <layout pattern> — sections in order, CTA strategy
STYLE:       <visual style> — 3–5 keywords
COLORS:      Primary / Secondary / CTA / Background / Surface / Text / Muted / Border (hex)
TYPOGRAPHY:  <Heading font> / <Body font> — scale, weights
SPACING:     base unit, scale
RADIUS/SHADOW/MOTION: tokens
KEY EFFECTS: <2–3 interactions>
AVOID:       <anti-patterns for this industry>
```

### Step 3 — Confirm or proceed

For a large build, show the design system in 10–15 lines and proceed unless the user objects. For a small change, apply the existing system silently.

### Step 4 — Implement

- Define tokens first (CSS custom properties, Tailwind theme, or platform theme object). Never scatter raw hex values through components.
- Build mobile-first, then layer breakpoints.
- Use real semantic elements and native controls before custom ones.
- Use one icon library consistently (Lucide, Heroicons, Phosphor, or the platform's native set). **Never use emoji as UI icons.**
- Use realistic placeholder content, not "Lorem ipsum," so layout problems show up.

### Step 5 — Verify with the pre-delivery checklist

Run the checklist at the end of this file. Fix failures before delivering. Report anything you couldn't verify.

---

## Industry rules

Match the product, then apply its row. Combine rows when a product spans categories (e.g., "AI fintech" → Fintech colors + AI Platform effects).

| Product type | Pattern | Style priority | Color mood | Type mood | Avoid |
|---|---|---|---|---|---|
| SaaS (B2B) | Hero + features + social proof + pricing | Minimal, Bento grid, Soft UI | Confident blue/indigo, neutral surfaces | Clean geometric sans | Clutter, stock-photo handshakes, vague headlines |
| Micro SaaS / indie tool | Hero with live demo + single CTA | Minimal, Neo-brutalist | One bold accent on neutral | Friendly sans or mono accents | Enterprise jargon, long feature grids |
| Developer tool / API | Code-first hero + docs links | Dark mode, Minimal, Terminal | Dark slate + one vivid accent | Sans + monospace | Marketing fluff, hiding code samples |
| AI / chatbot platform | Demo-led hero + use cases | AI-native, Minimal, subtle glass | Neutral base + restrained accent | Modern sans | Purple-pink gradient clichés, sparkle overload, glowing orbs |
| Cybersecurity | Trust hero + proof metrics | Dark, Precise, Data-dense | Deep navy/charcoal + green or cyan | Technical sans | Hacker clichés, Matrix rain, fear tactics |
| Fintech / crypto | Value prop + security + app preview | Clean, Glass (light), Data | Trust blue/teal, green for gains | Precise sans, tabular numbers | Neon casino vibes, unclear fees |
| Banking / insurance | Reassurance hero + tasks first | Conservative minimal | Navy, deep green, warm neutrals | Highly legible humanist sans | Trendy gradients, playful motion, small text |
| Healthcare / clinic | Find care / book CTA first | Soft UI, Accessible minimal | Calm blue/teal, white, soft green | Humanist sans, large sizes | Red as primary, dense jargon, low contrast |
| Mental health / wellness | Gentle hero + how it works | Soft UI, Organic | Muted sage, lavender, warm sand | Rounded sans or soft serif | Urgency timers, aggressive CTAs, harsh contrast blocks |
| E-commerce (general) | Hero offer + categories + products | Clean, Card-based | Brand accent + high-contrast CTA | Readable sans | Hidden prices, surprise fees, carousels as sole nav |
| Luxury e-commerce | Full-bleed imagery + editorial | Editorial minimal | Black, ivory, gold/champagne | High-contrast serif + refined sans | Discount badges everywhere, busy UI |
| Food delivery / restaurant | Location + menu + order CTA | Vibrant, Photo-led | Warm red/orange, appetite tones | Bold friendly sans | Cold blue palettes, tiny food photos |
| Beauty / spa | Emotional hero + services + booking | Soft UI, Organic | Blush, sage, warm white, gold accent | Elegant serif + clean sans | Neon, harsh motion, dark mode default |
| Hotel / travel | Search-first hero + destinations | Photo-led, Glass overlays | Ocean blues, sand, sunset accent | Elegant serif + sans | Booking widgets below the fold |
| Legal / professional services | Credibility hero + practice areas | Conservative, Editorial | Navy, burgundy, warm gray | Classic serif + sans | Gimmicky animation, stock gavels |
| Education / e-learning | Outcome hero + courses + progress | Friendly, Card-based | Bright but balanced primaries | Rounded readable sans | Walls of text, unclear progress |
| Kids / family | Playful hero, big targets | Claymorphism, Playful | Saturated cheerful colors | Rounded display font | Small targets, dark palettes, dark patterns |
| Portfolio / agency | Work-first grid + case studies | Brutalist, Editorial, Bento | Monochrome + one signature color | Expressive display + sans | Generic templates, slow intros |
| Gaming | Trailer/hero media + CTA | Dark, Cyber, Neon accents | Dark base + electric accents | Bold display | Low contrast on neon, autoplay sound |
| Music / streaming | Content-first browse | Dark mode, Immersive | Dark + album-art-driven accents | Bold sans | Tiny controls, hidden playback state |
| Habit / productivity tracker | Dashboard + quick add | Minimal, Soft UI | Calm neutral + success green | Friendly sans | Shame-based messaging, guilt streaks |
| Nonprofit / charity | Mission hero + impact + donate | Warm editorial | Warm, hopeful accent on neutral | Humanist sans/serif | Guilt imagery overload, buried donate button |
| Real estate | Search + featured listings | Clean, Photo-led | Trust navy/green + neutral | Clean sans | Low-res photos, hidden filters |
| Web3 / NFT | Product hero + clear utility | Dark, Glass, Gradient (restrained) | Dark + vivid gradient accents | Geometric sans | Jargon without explanation, scam-like hype |
| Dashboard / analytics (any) | Sidebar + KPI row + charts + table | Data-dense minimal | Neutral UI, color reserved for data | Sans with tabular numerals | Decorative color, 3D charts, pie charts with 8+ slices |

---

## Visual style catalog

Pick one primary style. Mixing more than two styles in one product almost always looks incoherent.

| Style | Keywords | Best for | Watch out for |
|---|---|---|---|
| **Minimalism** | Whitespace, restraint, one accent | SaaS, tools, portfolios | Becoming bland; keep strong hierarchy |
| **Soft UI** | Gentle shadows, rounded, calm | Wellness, beauty, consumer apps | Low contrast borders; add a 1px border if surfaces blend |
| **Glassmorphism** | Frosted blur, translucency, layered | Overlays, hero cards, fintech | Text contrast on blur; heavy `backdrop-filter` cost; always provide a solid fallback |
| **Neumorphism** | Extruded, same-color shadows | Small accent controls only | Fails contrast and affordance; never for primary UI |
| **Claymorphism** | Puffy 3D, inner shadows, pastel | Kids, playful, onboarding | Childish in professional products |
| **Neo-brutalism** | Thick borders, hard shadows, flat bold color | Indie tools, creative, portfolios | Can feel chaotic; keep grid strict |
| **Brutalism** | Raw, system fonts, unconventional | Art, editorial, agencies | Usability; keep navigation conventional |
| **Bento grid** | Modular tiles of varied size | Feature showcases, dashboards | Mobile collapse order must make sense |
| **Editorial** | Big serif type, columns, imagery | Luxury, publishing, legal | Line length; keep body ≤ 75ch |
| **Dark mode / OLED** | Near-black, vivid accents | Dev tools, media, gaming | Pure #000 with pure #FFF text causes halation; use #0B0B0F-ish and #E8E8EC-ish |
| **Data-dense** | Compact, tabular, low decoration | Admin, analytics, trading | Density without hierarchy; use weight and spacing, not color |
| **AI-native** | Conversational surfaces, streaming states, subtle motion | AI products | Clichéd gradients and sparkles; focus on clarity of state |
| **Organic** | Curves, natural tones, texture | Wellness, food, sustainability | Performance of large textures |
| **Retro / Y2K / Vaporwave** | Chrome, gradients, pixel, nostalgia | Entertainment, fashion | Readability; use sparingly |
| **Platform native** | Follows Apple HIG / Material 3 / Fluent 2 | Native apps | Don't fight platform conventions |

---

## Color system

### Rules
1. Define **semantic tokens**, not just brand colors: `primary`, `primary-foreground`, `secondary`, `accent/cta`, `background`, `surface`, `surface-raised`, `text`, `text-muted`, `border`, `ring`, `success`, `warning`, `danger`, `info`.
2. Body text contrast ≥ **4.5:1**; large text (≥ 24px, or ≥ 18.66px bold) and UI component boundaries ≥ **3:1** (WCAG 2.2 AA).
3. The CTA color should be used *only* for primary actions so it stays meaningful.
4. Never convey meaning with color alone — pair with icon, text, or pattern.
5. Dark mode is its own palette, not an inversion: lower saturation, raise surfaces with lighter tints instead of shadows.
6. Limit to 1 primary + 1 accent + neutrals for most products. Data visualization gets its own categorical palette.

### Starter palettes

Verify contrast for your exact combinations; adjust lightness as needed.

| Mood | Primary | Secondary | CTA | Background | Text |
|---|---|---|---|---|---|
| Trust (SaaS/finance) | #2563EB | #0F172A | #2563EB | #FFFFFF | #0F172A |
| Calm care (health) | #0E7490 | #CCFBF1 | #0F766E | #F8FAFC | #1E293B |
| Wellness / spa | #B5838D | #A3B18A | #9C6B2F | #FFF8F5 | #2D2A2E |
| Luxury | #111111 | #F5F1E8 | #8C6A2B | #FBFAF7 | #111111 |
| Appetite (food) | #DC2626 | #FDE68A | #EA580C | #FFFBF5 | #1C1917 |
| Developer dark | #22D3EE | #1E293B | #22D3EE | #0B1120 | #E2E8F0 |
| Eco / sustainability | #15803D | #D9F99D | #166534 | #FAFAF5 | #1A2E1A |
| Playful / kids | #7C3AED | #FDE047 | #F97316 | #FFFDF7 | #1E1B4B |
| Editorial neutral | #1F2937 | #E5E7EB | #B91C1C | #FFFFFF | #111827 |
| Cyber security | #10B981 | #0F172A | #10B981 | #020617 | #E2E8F0 |

On dark backgrounds, text on a bright CTA (e.g., cyan or green) should be dark, not white.

---

## Typography

### Rules
- Max **2 families** (heading + body); a monospace is a permitted third for code/data.
- Body size: **16px minimum on web**, 17pt iOS, 16sp Android. Never smaller than 14px for secondary text.
- Line height: 1.5–1.7 body, 1.1–1.3 headings. Line length 45–75 characters.
- Use a modular scale (e.g., 1.25): 12 / 14 / 16 / 20 / 25 / 31 / 39 / 49.
- Use `font-variant-numeric: tabular-nums` for tables, prices, timers, and metrics.
- Load fonts with `font-display: swap`, preconnect to the font host, and subset when possible. Always include a fallback stack.
- Use `text-wrap: balance` on headings as a progressive enhancement only; the layout must still work without it.

### Pairings (all on Google Fonts)

| Mood | Heading | Body | Good for |
|---|---|---|---|
| Modern professional | Inter | Inter | SaaS, dashboards |
| Geometric confident | Plus Jakarta Sans | Inter | SaaS, startups |
| Elegant calm | Cormorant Garamond | Montserrat | Spa, beauty, luxury |
| Editorial classic | Playfair Display | Source Sans 3 | Publishing, legal, luxury |
| Friendly rounded | Nunito | Nunito Sans | Education, kids, wellness |
| Technical | Space Grotesk | IBM Plex Sans (+ IBM Plex Mono) | Dev tools, AI, cybersecurity |
| Bold expressive | Syne | Manrope | Agencies, portfolios |
| Warm humanist | Fraunces | Work Sans | Food, nonprofits, lifestyle |
| Trustworthy | Merriweather | Open Sans | Finance, government, health |
| Neutral utility | DM Sans | DM Sans (+ DM Mono) | Productivity tools |

---

## Layout, spacing, and shape

- **Spacing:** 4px base unit; scale 4 / 8 / 12 / 16 / 24 / 32 / 48 / 64 / 96. Section padding on landing pages: 64–128px desktop, 48–64px mobile.
- **Containers:** max-width 1200–1280px for marketing, fluid for apps; consistent horizontal gutters (16px mobile, 24–32px desktop).
- **Breakpoints to test:** 375, 768, 1024, 1440px (plus 320px for the narrowest phones).
- **Radius:** pick one scale and stick to it (e.g., 6 / 10 / 16 / full). Nested radius = outer radius − padding.
- **Elevation:** 2–3 shadow levels maximum. In dark mode, express elevation with lighter surfaces.
- **Hierarchy:** one clear primary action per view. Group related items with proximity before using borders or boxes.

---

## Landing page patterns

| Pattern | Section order | Use when |
|---|---|---|
| Hero-centric + social proof | Hero → logos → benefits → testimonials → CTA | Emotion/trust-driven consumer offers |
| Feature-led | Hero → feature grid/bento → deep dives → pricing → FAQ → CTA | SaaS with multiple capabilities |
| Demo-first | Hero with live/interactive demo → how it works → use cases → CTA | Tools and AI products |
| Problem → solution | Pain → agitation → solution → proof → CTA | New categories needing education |
| Search-first | Search hero → featured results → categories → trust | Travel, real estate, marketplaces |
| Waitlist / launch | Hero + email capture → teaser features → FAQ | Pre-launch |
| Long-form sales | Story → benefits → objections → guarantee → repeated CTAs | High-consideration purchases |

**CTA rules:** primary CTA visible above the fold on desktop, repeated after major proof sections; verb-first, specific labels ("Start free trial," not "Submit"); only one visually primary CTA per section.

---

## UX guidelines by priority

### P0 — Critical (never ship without)
- **Keyboard access:** every interactive element reachable and operable by keyboard in a logical order; no keyboard traps.
- **Visible focus:** `:focus-visible` ring with ≥ 3:1 contrast; never `outline: none` without a replacement.
- **Semantics:** use `<button>` for actions and `<a href>` for navigation; one `<h1>`; heading levels don't skip; landmarks (`header`, `nav`, `main`, `footer`).
- **Labels:** every input has a visible `<label>`; placeholders are not labels. Icon-only buttons have `aria-label`; decorative icons have `aria-hidden="true"`.
- **Contrast:** meets the ratios in the Color section in both light and dark modes.
- **Touch targets:** ≥ 44×44px (iOS) / 48×48dp (Android); ≥ 24×24px with spacing minimum on web.
- **Images:** meaningful `alt` text; empty `alt=""` for decorative images.
- **No horizontal scroll** at 320px width; wide tables/code scroll inside their own container.

### P1 — High
- **Forms:** validate on blur or submit, not on every keystroke; errors appear next to the field in text (not only red) and link from an error summary on long forms; preserve user input on error; mark required fields; use correct `type`, `inputmode`, and `autocomplete`.
- **States:** design every component's default, hover, active, focus, disabled, loading, empty, error, and success states.
- **Loading:** skeletons for content > 300ms; spinners only for short actions; disable and label buttons while submitting to prevent double submission.
- **Feedback:** confirm actions with toasts or inline messages; destructive actions need confirmation or undo.
- **Motion:** respect `prefers-reduced-motion`; durations 150–300ms for UI, ≤ 500ms for larger transitions; animate `transform` and `opacity`, not layout properties. Interrupted animations must still land in the correct final state.
- **Cursor:** `cursor: pointer` on all clickable non-link elements on web.
- **Text resilience:** content reflows at 200% zoom and with user text-spacing overrides; long words/URLs wrap (`overflow-wrap: anywhere`); chips and badges wrap or use a `+N` disclosure, and truncated text has an accessible way to see the full value.

### P2 — Medium
- **Navigation:** current page clearly indicated; ≤ 7 top-level items; mobile nav reachable with one thumb.
- **Content:** front-load key info; scannable headings; short paragraphs; plain language.
- **Performance:** lazy-load below-the-fold images; specify `width`/`height` or `aspect-ratio` to prevent layout shift; use modern formats (AVIF/WebP); avoid heavy blur and shadow stacks on large areas.
- **Empty states:** explain what goes here and give the next action.
- **Dark patterns:** none — no confirmshaming, hidden costs, forced continuity, pre-checked upsells, or fake urgency.

### P3 — Polish
- Optical alignment of icons with text; consistent icon stroke width.
- Hover effects that hint at function (lift, underline, color shift), not decoration.
- Micro-interactions on success moments (subtle, skippable).
- Favicon, page titles, and social preview images.

---

## Data visualization

| Need | Use | Avoid |
|---|---|---|
| Trend over time | Line / area | Pie, 3D |
| Compare categories | Horizontal or vertical bar | Pie with many slices |
| Part of whole (≤ 5 parts) | Stacked bar, donut | 3D pie |
| Distribution | Histogram, box plot | Line |
| Correlation | Scatter | Dual-axis lines without labels |
| Single KPI | Big number + sparkline + delta | Gauge for everything |
| Many rows | Table with sorting, filtering, sticky header | Charts for precise lookup |

Rules: label axes and units; start bar charts at zero; use direct labels over legends where possible; use a colorblind-safe categorical palette; give charts a text summary or accessible table equivalent.

---

## Stack-specific notes

- **HTML + Tailwind (default):** put tokens in `tailwind.config` / `@theme` or CSS variables; use `focus-visible:` variants; `motion-safe:`/`motion-reduce:` for animation; avoid arbitrary values outside the scale.
- **React / Next.js:** components own their states (loading, empty, error); use `next/font` and `next/image`; keep server components for static content; manage focus on route changes and modal open/close.
- **shadcn/ui / Radix:** prefer the primitives (they handle accessibility); theme via CSS variables; don't rebuild Dialog, Popover, or Select by hand.
- **Vue / Nuxt:** tokens in a global CSS file or Nuxt UI app config; use `<Transition>` with reduced-motion checks.
- **Svelte / Astro:** ship minimal JS; hydrate only interactive islands.
- **Angular:** use CDK a11y (FocusTrap, LiveAnnouncer); Angular Material theming via tokens.
- **SwiftUI:** follow Apple HIG; use Dynamic Type text styles, SF Symbols, semantic system colors, and `.accessibilityLabel`.
- **Jetpack Compose:** Material 3 color scheme and typography; `contentDescription` on icons; 48dp touch targets.
- **React Native / Flutter:** respect platform conventions per OS; support font scaling; test with the screen reader on both platforms.
- **Desktop (WPF, WinUI, JavaFX, etc.):** follow the platform design language (e.g., Fluent 2 on Windows); full keyboard navigation and accelerators; high-contrast theme support.

---

## Persistence: master + page overrides

For multi-page projects, save the design system so future sessions stay consistent:

```
design-system/
└── <project-slug>/
    ├── MASTER.md          # Global source of truth: tokens, type, components, rules
    └── pages/
        └── <page>.md      # Only the deviations for that page
```

When building a page:
1. Read `design-system/<project-slug>/MASTER.md`.
2. If `pages/<page>.md` exists, its rules override the master.
3. Otherwise use the master exclusively.
4. If you introduce a new reusable pattern, add it to MASTER.md.

---

## Pre-delivery checklist

Run before declaring the work done. Report any item you could not verify.

**Visual**
- [ ] Design system tokens used everywhere; no stray hard-coded colors or sizes
- [ ] Max 2 font families; body text ≥ 16px
- [ ] One clear primary action per view; CTA color reserved for primary actions
- [ ] No emoji used as icons; one consistent icon set
- [ ] Industry anti-patterns from the "Avoid" column are absent

**Accessibility**
- [ ] Text contrast ≥ 4.5:1 (≥ 3:1 for large text and UI boundaries) in light and dark modes
- [ ] All interactive elements keyboard-reachable with visible focus
- [ ] Labels on all inputs; `aria-label` on icon-only buttons; decorative icons hidden
- [ ] Meaning never conveyed by color alone
- [ ] `prefers-reduced-motion` respected
- [ ] Touch targets meet platform minimums

**Responsive & resilient**
- [ ] Tested at 320, 375, 768, 1024, 1440px; no horizontal page scroll
- [ ] Text reflows at 200% zoom without clipping; long strings wrap
- [ ] Chips, badges, and buttons don't break or truncate essential labels

**Interaction**
- [ ] `cursor: pointer` on clickable elements (web)
- [ ] Hover, focus, active, disabled, loading, empty, error, and success states exist
- [ ] Forms validate helpfully, preserve input, and prevent double submission
- [ ] Destructive actions have confirmation or undo

**Performance**
- [ ] Images sized, lazy-loaded below the fold, modern formats
- [ ] No layout shift from fonts or media
- [ ] Animations use `transform`/`opacity` only
