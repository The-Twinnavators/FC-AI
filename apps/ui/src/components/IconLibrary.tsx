/** Primitives page demos: the Lucide icon matrix and the unDraw illustration states (design system spec). */
import { useState } from "react";
import {
  Compass, LayoutDashboard, Menu, Search, ChevronRight, ChevronDown, ArrowLeft,
  Plus, Trash2, PenLine, Copy, Download, Upload, Filter, Share2, EllipsisVertical,
  CircleCheck, TriangleAlert, OctagonAlert, Info, CircleHelp, Clock, LoaderCircle,
  CreditCard, Receipt, Wallet, DollarSign, TrendingUp, Coins,
  Bell, Mail, MessageSquare, Send, Share, AtSign,
  Lock, LockOpen, Key, ShieldCheck, Eye, EyeOff, UserCheck,
  Monitor, Smartphone, Laptop, Camera, FileText, Image, Folder,
  type LucideIcon,
} from "lucide-react";
import { Illustration, ILLUSTRATIONS_AVAILABLE } from "./Illustration";

type Entry = [LucideIcon, string, string?];
const MATRIX: Array<{ category: string; use: string; rule: string; tone?: Record<string, string>; icons: Entry[] }> = [
  { category: "Navigation & wayfinding", use: "App bars, sidebar, breadcrumbs, search", rule: "20 or 24px; keep a 40px touch target.", icons: [[Compass, "Compass"], [LayoutDashboard, "LayoutDashboard"], [Menu, "Menu"], [Search, "Search"], [ChevronRight, "ChevronRight"], [ChevronDown, "ChevronDown"], [ArrowLeft, "ArrowLeft"]] },
  { category: "Object & entity actions", use: "Create, edit, delete, share, export", rule: "16px inline (tables, badges), 20px on buttons.", icons: [[Plus, "Plus"], [Trash2, "Trash2"], [PenLine, "PenLine", "Edit3"], [Copy, "Copy"], [Download, "Download"], [Upload, "Upload"], [Filter, "Filter"], [Share2, "Share2"], [EllipsisVertical, "EllipsisVertical", "MoreVertical"]] },
  {
    category: "Status, feedback & alerts",
    use: "Badges, banners, toasts, callouts",
    rule: "Always paired with the matching signal colour.",
    tone: { CircleCheck: "var(--sig-ok)", TriangleAlert: "var(--sig-warn)", OctagonAlert: "var(--sig-bad)", Info: "var(--brand-ink)" },
    icons: [[CircleCheck, "CircleCheck", "CheckCircle2"], [TriangleAlert, "TriangleAlert", "AlertTriangle"], [OctagonAlert, "OctagonAlert", "AlertOctagon"], [Info, "Info"], [CircleHelp, "CircleHelp", "HelpCircle"], [Clock, "Clock"], [LoaderCircle, "LoaderCircle", "Loader2"]],
  },
  { category: "Commerce & financials", use: "Billing, invoices, checkout", rule: "Pair with tabular numerals.", icons: [[CreditCard, "CreditCard"], [Receipt, "Receipt"], [Wallet, "Wallet"], [DollarSign, "DollarSign"], [TrendingUp, "TrendingUp"], [Coins, "Coins"]] },
  { category: "Communication & social", use: "Notifications, inbox, chat, sharing", rule: "Unread counts use an 8px dot overlay.", icons: [[Bell, "Bell"], [Mail, "Mail"], [MessageSquare, "MessageSquare"], [Send, "Send"], [Share, "Share"], [AtSign, "AtSign"]] },
  { category: "Security & permissions", use: "Auth flows, roles, privacy", rule: "Subtle pill background on sensitive forms.", icons: [[Lock, "Lock"], [LockOpen, "LockOpen", "Unlock"], [Key, "Key"], [ShieldCheck, "ShieldCheck"], [Eye, "Eye"], [EyeOff, "EyeOff"], [UserCheck, "UserCheck"]] },
  { category: "Devices, files & media", use: "Exports, uploads, responsive toggles", rule: "Neutral outlines only.", icons: [[Monitor, "Monitor"], [Smartphone, "Smartphone"], [Laptop, "Laptop"], [Camera, "Camera"], [FileText, "FileText"], [Image, "Image"], [Folder, "Folder"]] },
];

const SIZES = [16, 20, 24, 32] as const;

export function IconMatrix() {
  const [size, setSize] = useState<(typeof SIZES)[number]>(20);
  return (
    <div className="iconlib">
      <div className="iconlib__bar">
        <span className="muted">Lucide · 24px grid · round caps and joins · inherits currentColor</span>
        <div className="seg seg--sm" role="radiogroup" aria-label="Icon size">
          {SIZES.map((s) => (
            <button key={s} role="radio" aria-checked={size === s} onClick={() => setSize(s)}>
              {s}px
            </button>
          ))}
        </div>
      </div>
      {MATRIX.map((row) => (
        <div key={row.category} className="iconlib__row">
          <div className="iconlib__meta">
            <strong>{row.category}</strong>
            <span>{row.use}</span>
            <span className="iconlib__rule">{row.rule}</span>
          </div>
          <ul className="iconlib__icons">
            {row.icons.map(([I, name, was]) => (
              <li key={name} title={was ? `${name} (formerly ${was})` : name}>
                <span className="iconlib__glyph" style={{ color: row.tone?.[name] }}>
                  <I size={size} strokeWidth={size <= 16 ? 1.5 : 2} aria-hidden="true" className={name === "LoaderCircle" ? "iconlib__spin" : undefined} />
                </span>
                <code>{name}</code>
                {was ? <span className="iconlib__was">was {was}</span> : null}
              </li>
            ))}
          </ul>
        </div>
      ))}
      <ul className="iconlib__rules">
        <li><b>Grid.</b> 16, 20, 24 or 32px, centred in a fixed box.</li>
        <li><b>Stroke.</b> 2px at 20px and up; 1.5px at 16px to avoid ink traps.</li>
        <li><b>Interaction.</b> Icon buttons show a hover background pill, not a colour change alone.</li>
        <li><b>Accessibility.</b> Decorative icons are aria-hidden; icon-only buttons need an aria-label.</li>
      </ul>
    </div>
  );
}

const STATES: Array<{ slug: string; state: string; archetype: string; intent: string; size: string; width: number }> = [
  { slug: "welcome", state: "Onboarding & welcome", archetype: "Welcome · Personal goals", intent: "Sets an inviting tone and the product's main value.", size: "Hero, max 480px, above the onboarding steps", width: 260 },
  { slug: "empty", state: "Empty state (first run)", archetype: "Empty · Blank canvas · Add content", intent: "Zero data is expected; points at the first action.", size: "240–320px, with the primary button", width: 240 },
  { slug: "no-results", state: "Search / filter: no results", archetype: "Searching · Not found", intent: "Explains the mismatch without blaming the user.", size: "Max 240px, with “Reset filters”", width: 220 },
  { slug: "security", state: "Authentication & verification", archetype: "Secure login · Two-factor", intent: "Projects trust and protection.", size: "Half-width side panel, or 180px on mobile", width: 220 },
  { slug: "success", state: "Success & celebration", archetype: "Celebrating · Completed", intent: "Positive reinforcement when work is done.", size: "220px, low contrast", width: 220 },
  { slug: "not-found", state: "Error: 404 not found", archetype: "Page not found", intent: "Friendly way back when a page or record is gone.", size: "320–400px, with “Back to projects”", width: 260 },
  { slug: "server-down", state: "Error: offline / 500", archetype: "Server down · Maintenance", intent: "Data is safe; the service is recovering.", size: "280px, neutral with a soft warning tint", width: 240 },
  { slug: "access-denied", state: "Permissions / access denied", archetype: "Vault · Secure files", intent: "Explains the limit and who can grant access.", size: "240px, with an admin contact path", width: 220 },
];

export function IllustrationGallery() {
  return (
    <div className="illuslib">
      <p className="muted" style={{ margin: 0 }}>
        {ILLUSTRATIONS_AVAILABLE.length} of {STATES.length} added. The accent follows the brand colour and people and shapes follow the theme, so each works in light and dark mode. See src/assets/illustrations/README.md.
      </p>
      <div className="illuslib__grid">
        {STATES.map((s) => (
          <figure key={s.slug} className="illuslib__item">
            <Illustration slug={s.slug} label={s.state} maxWidth={s.width} />
            <figcaption>
              <strong>{s.state}</strong>
              <span>{s.intent}</span>
              <span className="iconlib__rule">unDraw: {s.archetype} · {s.size}</span>
            </figcaption>
          </figure>
        ))}
      </div>
    </div>
  );
}
