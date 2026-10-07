/**
 * Design direction: the product's industry, read from the PRD, picks a pattern, a visual style, a colour mood with a
 * starter palette, a Google font pairing and the industry's anti-patterns. From the UI/UX Pro Max design intelligence
 * (docs/design/ui-ux-pro-max.md, MIT, nextlevelbuilder/ui-ux-pro-max-skill), as data FlowCode can apply:
 *  - "Capture the style" applies the palette and fonts when the person gave no website, CSS or images, so a grocery
 *    app starts from fresh, natural colours instead of the starter's default blue (No BIO & GMO build);
 *  - the design steps and the design crit get the direction and its anti-patterns.
 * The person's own style always wins: with a captured style the direction is advice only.
 */

export interface Palette {
  primary: string;
  secondary: string;
  cta: string;
  background: string;
  text: string;
}

export interface FontPairing {
  heading: string;
  body: string;
  mono?: string;
}

export interface DesignDirection {
  industry: string;
  pattern: string;
  style: string;
  colorMood: string;
  typeMood: string;
  avoid: string;
  palette: Palette;
  fonts: FontPairing;
}

const PALETTES = {
  trust: { primary: "#2563EB", secondary: "#0F172A", cta: "#2563EB", background: "#FFFFFF", text: "#0F172A" },
  care: { primary: "#0E7490", secondary: "#CCFBF1", cta: "#0F766E", background: "#F8FAFC", text: "#1E293B" },
  wellness: { primary: "#B5838D", secondary: "#A3B18A", cta: "#9C6B2F", background: "#FFF8F5", text: "#2D2A2E" },
  luxury: { primary: "#111111", secondary: "#F5F1E8", cta: "#8C6A2B", background: "#FBFAF7", text: "#111111" },
  appetite: { primary: "#DC2626", secondary: "#FDE68A", cta: "#EA580C", background: "#FFFBF5", text: "#1C1917" },
  devDark: { primary: "#22D3EE", secondary: "#1E293B", cta: "#22D3EE", background: "#0B1120", text: "#E2E8F0" },
  eco: { primary: "#15803D", secondary: "#D9F99D", cta: "#166534", background: "#FAFAF5", text: "#1A2E1A" },
  playful: { primary: "#7C3AED", secondary: "#FDE047", cta: "#F97316", background: "#FFFDF7", text: "#1E1B4B" },
  editorial: { primary: "#1F2937", secondary: "#E5E7EB", cta: "#B91C1C", background: "#FFFFFF", text: "#111827" },
  cyber: { primary: "#10B981", secondary: "#0F172A", cta: "#10B981", background: "#020617", text: "#E2E8F0" },
} satisfies Record<string, Palette>;

const FONTS = {
  professional: { heading: "Inter", body: "Inter" },
  geometric: { heading: "Plus Jakarta Sans", body: "Inter" },
  elegant: { heading: "Cormorant Garamond", body: "Montserrat" },
  editorial: { heading: "Playfair Display", body: "Source Sans 3" },
  rounded: { heading: "Nunito", body: "Nunito Sans" },
  technical: { heading: "Space Grotesk", body: "IBM Plex Sans", mono: "IBM Plex Mono" },
  expressive: { heading: "Syne", body: "Manrope" },
  humanist: { heading: "Fraunces", body: "Work Sans" },
  trustworthy: { heading: "Merriweather", body: "Open Sans" },
  utility: { heading: "DM Sans", body: "DM Sans", mono: "DM Mono" },
} satisfies Record<string, FontPairing>;

type Row = [industry: string, keywords: RegExp, pattern: string, style: string, colorMood: string, typeMood: string, avoid: string, palette: keyof typeof PALETTES, fonts: keyof typeof FONTS];

/** Most specific first: the first row whose keywords match the PRD wins (a "food delivery" app isn't general e-commerce). */
const ROWS: Row[] = [
  ["Food / grocery / restaurant", /\b(food|grocer(y|ies)|restaurant|recipe|meal|menu|kitchen|ingredient|nutrition|non-?gmo|organic|diet|cafe|bakery|delivery app)\b/i, "Search or browse first, then the product or menu, with the main action close", "Vibrant, photo-led, organic", "Warm appetite tones or fresh natural greens; cream backgrounds", "Bold friendly sans or warm humanist serif", "Cold blue palettes, tiny food photos, clinical layouts", "eco", "humanist"],
  ["Healthcare / clinic", /\b(health ?care|clinic|patient|doctor|appointment|medical|hospital|pharmacy|symptom)\b/i, "Find care or book first", "Soft UI, accessible minimal", "Calm blue/teal, white, soft green", "Humanist sans, large sizes", "Red as primary, dense jargon, low contrast", "care", "trustworthy"],
  ["Mental health / wellness", /\b(wellness|meditat\w*|mindful\w*|mental health|therapy|mood|sleep|yoga|breath\w*)\b/i, "Gentle hero, then how it works", "Soft UI, organic", "Muted sage, lavender, warm sand", "Rounded sans or soft serif", "Urgency timers, aggressive CTAs, harsh contrast blocks", "wellness", "rounded"],
  ["Beauty / spa", /\b(beauty|spa|salon|skincare|cosmetic|nail|massage)\b/i, "Emotional hero, services, booking", "Soft UI, organic", "Blush, sage, warm white, gold accent", "Elegant serif + clean sans", "Neon, harsh motion, dark mode by default", "wellness", "elegant"],
  ["Habit / productivity / calendar", /\b(habit|productivity|to-?do|task list|planner|calendar|schedul\w*|reminder|notes?)\b/i, "Today's view with quick add; details on demand", "Minimal, soft UI", "Calm neutral with a success green", "Friendly sans", "Shame-based messaging, guilt streaks, clutter", "care", "utility"],
  ["Fintech / banking", /\b(fintech|bank\w*|payment|wallet|invoice|budget\w*|expense|loan|insurance|invest\w*|trading|crypto)\b/i, "Value and security first, then the app's main task", "Clean, data, light glass", "Trust blue/teal, green for gains", "Precise sans with tabular numbers", "Neon casino vibes, unclear fees, trendy gradients", "trust", "geometric"],
  ["Education / e-learning", /\b(education|learn\w*|course|lesson|student|teacher|quiz|school|tutor)\b/i, "Outcome first, courses, visible progress", "Friendly, card-based", "Bright but balanced primaries", "Rounded readable sans", "Walls of text, unclear progress", "playful", "rounded"],
  ["Kids / family", /\b(kids?|children|child|family|parent\w*|toddler)\b/i, "Playful hero, big targets", "Claymorphism, playful", "Saturated cheerful colours", "Rounded display font", "Small targets, dark palettes, dark patterns", "playful", "rounded"],
  ["Luxury / fashion", /\b(luxury|fashion|jewel\w*|boutique|couture|premium brand)\b/i, "Full-bleed imagery, editorial", "Editorial minimal", "Black, ivory, gold/champagne", "High-contrast serif + refined sans", "Discount badges everywhere, busy UI", "luxury", "editorial"],
  ["E-commerce", /\b(e-?commerce|shop\w*|store|cart|checkout|product catalog|marketplace|retail)\b/i, "Offer, categories, products", "Clean, card-based", "Brand accent with a high-contrast CTA", "Readable sans", "Hidden prices, surprise fees, carousels as the only navigation", "trust", "geometric"],
  ["Hotel / travel", /\b(travel|hotel|trip|booking|flight|destination|tour)\b/i, "Search first, then destinations", "Photo-led, glass overlays", "Ocean blues, sand, sunset accent", "Elegant serif + sans", "Booking widgets below the fold", "care", "editorial"],
  ["Real estate", /\b(real estate|property|listing|rent\w*|apartment|house|mortgage)\b/i, "Search and featured listings", "Clean, photo-led", "Trust navy/green with neutrals", "Clean sans", "Low-res photos, hidden filters", "trust", "professional"],
  ["Legal / professional services", /\b(legal|law ?firm|lawyer|attorney|consult\w*|accounting)\b/i, "Credibility first, then practice areas", "Conservative, editorial", "Navy, burgundy, warm gray", "Classic serif + sans", "Gimmicky animation, stock gavels", "editorial", "trustworthy"],
  ["Nonprofit / charity", /\b(nonprofit|non-profit|charity|donat\w*|volunteer|cause)\b/i, "Mission, impact, donate", "Warm editorial", "Warm hopeful accent on neutral", "Humanist sans or serif", "Guilt imagery overload, a buried donate button", "eco", "humanist"],
  ["Developer tool / API", /\b(developer|api|sdk|cli|code editor|devops|repository)\b/i, "Code first, then docs", "Dark mode, minimal, terminal", "Dark slate with one vivid accent", "Sans + monospace", "Marketing fluff, hidden code samples", "devDark", "technical"],
  ["Cybersecurity", /\b(security|cyber\w*|threat|vulnerab\w*|firewall|compliance)\b/i, "Trust first, proof metrics", "Dark, precise, data-dense", "Deep navy/charcoal with green or cyan", "Technical sans", "Hacker clichés, Matrix rain, fear tactics", "cyber", "technical"],
  ["AI / chatbot", /\b(ai|chatbot|assistant|llm|gpt|copilot|prompt)\b/i, "Demo-led, then use cases", "AI-native, minimal", "Neutral base with a restrained accent", "Modern sans", "Purple-pink gradient clichés, sparkle overload, glowing orbs", "editorial", "geometric"],
  ["Music / streaming / media", /\b(music|stream\w*|podcast|video|playlist|movie|media)\b/i, "Content-first browsing", "Dark mode, immersive", "Dark with artwork-driven accents", "Bold sans", "Tiny controls, hidden playback state", "devDark", "expressive"],
  ["Gaming", /\b(game|gaming|esports|player)\b/i, "Trailer or hero media, then CTA", "Dark, neon accents", "Dark base with electric accents", "Bold display", "Low contrast on neon, autoplay sound", "devDark", "expressive"],
  ["Portfolio / agency", /\b(portfolio|agency|studio|case stud\w*|creative)\b/i, "Work first, then case studies", "Editorial, bento", "Monochrome with one signature colour", "Expressive display + sans", "Generic templates, slow intros", "editorial", "expressive"],
  ["Dashboard / analytics", /\b(dashboard|analytics|admin|metrics|reporting|kpi|crm)\b/i, "Sidebar, KPI row, charts, table", "Data-dense minimal", "Neutral UI; colour reserved for data", "Sans with tabular numerals", "Decorative colour, 3D charts, pie charts with 8+ slices", "trust", "professional"],
  ["SaaS (B2B)", /\b(saas|b2b|platform|workflow|team|subscription)\b/i, "Hero, features, social proof, pricing", "Minimal, bento grid, soft UI", "Confident blue/indigo, neutral surfaces", "Clean geometric sans", "Clutter, stock-photo handshakes, vague headlines", "trust", "geometric"],
];

const FALLBACK: Row = ["General product", /./, "One clear job per screen, with the primary action obvious", "Minimal with strong hierarchy", "Neutral ground with one confident accent", "Clean sans", "Clutter, generic templates, decorative gradients", "editorial", "utility"];

/** The product's design direction, from the PRD and the request (the first matching industry row). */
export function designDirection(text: string): DesignDirection {
  const row = ROWS.find((r) => r[1].test(text)) ?? FALLBACK;
  const [industry, , pattern, style, colorMood, typeMood, avoid, palette, fonts] = row;
  return { industry, pattern, style, colorMood, typeMood, avoid, palette: PALETTES[palette], fonts: FONTS[fonts] };
}

const toHsl = (hex: string): [number, number, number] => {
  const n = parseInt(hex.replace("#", ""), 16);
  const r = ((n >> 16) & 255) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  const h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [h * 60, s, l];
};
const toHex = (h: number, s: number, l: number) => {
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const c = l - s * Math.min(l, 1 - l) * Math.max(-1, Math.min(k - 3, 9 - k, 1));
    return Math.round(c * 255).toString(16).padStart(2, "0");
  };
  return `#${f(0)}${f(8)}${f(4)}`;
};

/**
 * Up to three brand colours: the person's captured colours first; when there are fewer, companions of the main colour
 * (a deeper analogous shade and a complementary accent); with nothing captured, the design direction's palette.
 * The user asked for up to 3 brand colours on the Styles page instead of a single captured blue.
 */
export function brandTrio(captured: string[], d: DesignDirection): string[] {
  const valid = [...new Set(captured.filter((c) => /^#[0-9a-f]{6}$/i.test(c)).map((c) => c.toLowerCase()))];
  if (!valid.length) return [...new Set([d.palette.primary, d.palette.cta, d.palette.secondary].map((c) => c.toLowerCase()))].slice(0, 3);
  if (valid.length >= 3) return valid.slice(0, 3);
  const [h, s, l] = toHsl(valid[0]);
  const deep = toHex((h + 25) % 360, Math.min(1, s * 0.85), Math.max(0.18, l - 0.25));
  const accent = toHex((h + 180) % 360, Math.min(1, Math.max(0.55, s)), Math.min(0.6, Math.max(0.45, l)));
  return [...valid, deep, accent].slice(0, 3);
}

/** The direction as a short brief for the design steps and the design crit. */
export function directionBrief(d: DesignDirection): string {
  return [
    `Design direction for this product (${d.industry}, from FlowCode's design intelligence):`,
    `- Pattern: ${d.pattern}.`,
    `- Style: ${d.style}.`,
    `- Colour mood: ${d.colorMood} (on the Styles page: primary ${d.palette.primary}, accent ${d.palette.cta}, background ${d.palette.background}).`,
    `- Type: ${d.typeMood} (${d.fonts.heading}${d.fonts.body !== d.fonts.heading ? ` for headings, ${d.fonts.body} for text` : ""}).`,
    `- Avoid for this kind of product: ${d.avoid}.`,
    // Photos make a prototype look like a real product; a photo-led industry needs them (find_image fetches openly
    // licensed ones into public/images). No BIO & GMO build: one skill bullet mentioned photos and none were used.
    /photo|imagery|editorial/i.test(d.style)
      ? `- Imagery: this kind of product is photo-led. Use real photos from find_image: one for the hero or main feature, and one per card or product where the design shows items (crop with object-fit: cover, real alt text). Icons from lucide-react; illustrations as inline SVG.`
      : `- Imagery: use a real photo from find_image where the design has a hero, people or products; otherwise lucide-react icons and inline SVG illustrations. Never grey placeholder boxes.`,
  ].join("\n");
}
