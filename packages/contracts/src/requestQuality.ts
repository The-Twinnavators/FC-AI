/**
 * Request quality scoring (§5.1 "system classifies scope"). Deterministic and shared by UI and daemon:
 * a request that names who uses the product, what they do, and what data is involved produces a
 * specific plan; a one-liner produces a generic one. Attached PRDs/references raise the score.
 */
export interface RequestQuality {
  score: number;
  verdict: "specific" | "workable" | "generic";
  signals: { users: boolean; actions: boolean; data: boolean; constraints: boolean; references: boolean; length: number };
  suggestions: string[];
}

const USERS = /\b(users?|members?|staff|admins?|customers?|clients?|visitors?|students?|teachers?|patients?|owners?|managers?|team|guests?|instructors?|employees?|buyers?|sellers?|parents?|players?|readers?|developers?|i|we|people|someone)\b/i;
const ACTIONS = /\b(book|schedule|create|edit|delete|add|remove|track|search|filter|sort|view|see|list|manage|log|record|export|import|share|invite|pay|checkout|review|approve|assign|upload|download|compare|plan|organi[sz]e|browse|save|sign ?up|register|notify|remind|message|rate|vote)\w*\b/i;
const DATA = /\b(sessions?|events?|tasks?|bookings?|orders?|products?|items?|notes?|appointments?|members?|accounts?|profiles?|records?|entries|posts?|messages?|invoices?|reports?|tickets?|courses?|lessons?|recipes?|expenses?|contacts?|projects?|inventory|schedules?|reservations?|tests?|results?|scores?)\b/i;
const CONSTRAINTS = /\b(offline|local|mobile|desktop|responsive|accessible|privacy|without (an )?account|no login|fast|dark mode|print|keyboard|wcag|persist|sync|export|must|should|only)\b/i;

export function scoreRequest(text: string, referenceRoles: string[] = []): RequestQuality {
  const t = text.trim();
  const words = t.split(/\s+/).filter(Boolean).length;
  const signals = {
    users: USERS.test(t),
    actions: ACTIONS.test(t),
    data: DATA.test(t),
    constraints: CONSTRAINTS.test(t),
    references: referenceRoles.length > 0,
    length: words,
  };
  let score = Math.min(30, words * 1.2);
  if (signals.users) score += 15;
  if (signals.actions) score += 15;
  if (signals.data) score += 15;
  if (signals.constraints) score += 10;
  if (referenceRoles.includes("prd")) score += 25;
  else if (signals.references) score += 10;
  score = Math.round(Math.min(100, score));
  const suggestions: string[] = [];
  if (!signals.users) suggestions.push("Say who uses it (e.g. members, staff, a solo freelancer).");
  if (!signals.actions) suggestions.push("Say what they are trying to do (book, track, compare, approve…).");
  if (!signals.data) suggestions.push("Name the things it manages (sessions, orders, notes…).");
  if (!signals.constraints) suggestions.push("Add constraints that matter (works offline, mobile-first, no accounts…).");
  if (words < 12 && !referenceRoles.includes("prd")) suggestions.push("A one-line request usually produces a generic result — add a sentence or attach a PRD.");
  const verdict = score >= 70 ? "specific" : score >= 45 ? "workable" : "generic";
  return { score, verdict, signals, suggestions };
}

/** Suggests a short project name from a description ("A booking tool for a climbing gym…" → "Climbing gym bookings"). */
export function suggestName(text: string): string {
  const t = text.trim().replace(/\s+/g, " ");
  if (!t) return "";
  const m = /\b(?:for|to)\s+(?:an?|the|my|our)?\s*([\w-]+(?:\s+[\w-]+){0,2})/i.exec(t);
  const noun = /\b(booking|tracker|planner|scheduler|dashboard|store|shop|journal|portal|tool|app|site|catalog(?:ue)?|directory|manager|companion|guide|calculator)s?\b/i.exec(t)?.[1];
  const base = m ? m[1].replace(/\b(independent|small|local|simple|new)\b\s*/gi, "") : t.split(" ").slice(0, 3).join(" ");
  const name = noun && !new RegExp(noun, "i").test(base) ? `${base} ${noun.toLowerCase()}` : base;
  return (name.charAt(0).toUpperCase() + name.slice(1)).slice(0, 48);
}
