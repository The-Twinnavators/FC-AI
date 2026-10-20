/** @flowcode-library app-ai-writer · AI writing workspace (App screens)
 * Catalog ID: t.app-ai-writer (template)
 * Function: An app screen: an AI writing workspace with a document list, an editable page with formatting and word count, and an assistant that improves, shortens, changes tone or continues the text as a suggestion you insert, replace or discard, with undo, assembled from catalog buttons, text fields, a select and AI indicators.
 * Use it as: Copy app-ai-writer.tsx (FlowCode brings the components it uses); replace SAMPLE with the app's own documents, folders and assistant name, and swap compose() for a call to the app's real writing model, keeping the suggestion card so people still choose Insert or Replace.
 * Built from: c.button.primary, c.button.secondary, c.button.tertiary, c.text-field.outlined, c.select.filled, c.ai-indicator.working, c.ai-indicator.generated
 * Look: A document list with folders and recents beside a page-style editor with a formatting toolbar and word count, and a writing assistant panel with quick actions, an example suggestion card and a history of applied changes.
 * Use cases: ai writing assistant; document editor; copywriting tool; content drafting; blog post writer; email drafting; notes app with ai; marketing copy editor
 * Jobs to be done: improve a paragraph; shorten a draft; change the tone of a message; keep writing when stuck; find and open a document; undo an ai change
 * Keywords: app, ai, writing, editor, documents, assistant, rewrite, tone, suggestions, sidebar
 */
/**
 * App screen: AI writing workspace. A document list on the left (new document, search, folders with counts, recently
 * opened), a page in the middle with an editable title and body, a formatting toolbar (bold, italic, underline,
 * heading, bulleted and numbered lists, clear formatting) and a live word count, and a writing assistant on the right.
 * The assistant works on the selected text, or on the paragraph holding the cursor: Improve, Shorten, Change tone (with
 * a choice of tone), Continue writing, or a short request typed in your own words. Its answer types itself into an
 * "Example suggestion" card first; nothing in the document changes until you choose Insert or Replace, and Discard
 * throws it away. Every applied suggestion is listed with Undo, which takes exactly that change back out. Selecting
 * text shows a floating "Ask AI" button (Ctrl+J or Cmd+J from the keyboard). The assistant is simulated in the
 * browser: it answers from the rewrites in SAMPLE, or from simple wording rules when you have edited the text, and
 * sends nothing anywhere. Reduced motion skips the typing. On narrower screens the assistant moves under the editor,
 * and on phones the document list opens from a Documents button.
 * Make it the app's own: replace SAMPLE with the app's own documents, folders and assistant name, and swap compose()
 * for a call to the app's real writing model, keeping the suggestion card so people still decide what goes in.
 */
/**
 * Assembled from: document list (inline: brand, c.button.primary new document, c.text-field search, folder and
 * recent lists) > editor (inline toolbar, editable title and page, word count) > writing assistant (c.button.secondary
 * quick actions, c.select.filled tone picker, c.text-field ask field, c.ai-indicator.working while it writes,
 * c.ai-indicator.generated on the example suggestion, c.button.primary Insert, c.button.secondary Replace,
 * c.button.tertiary Discard and Undo).
 */
import { useEffect, useLayoutEffect, useRef, useState, type ClipboardEvent, type KeyboardEvent } from "react";
import { Icon } from "./icons";
import { Button } from "./buttons-variants";
import { TextField } from "./text-fields-states";
import { Select } from "./dropdowns-states";
import { AiIndicator } from "./ai-indicators";

// flowcode:sample
const SAMPLE = {
  product: "Fernhill Writer",
  assistantName: "Writing assistant",
  docsLabel: "Documents",
  openDocs: "Show documents",
  closeDocs: "Hide documents",
  newDoc: "New document",
  untitled: "Untitled document",
  searchLabel: "Search documents",
  searchPlaceholder: "Search documents",
  noMatches: "No documents match your search.",
  emptyFolder: "Nothing in this folder yet.",
  recentLabel: "Recent",
  foldersLabel: "Folders",
  allDocs: "All documents",
  results: "Search results",
  folders: [
    { id: "newsletter", name: "Newsletter" },
    { id: "website", name: "Website" },
    { id: "sales", name: "Sales" },
    { id: "drafts", name: "Drafts" },
  ],
  titleLabel: "Document title",
  bodyLabel: "Document text",
  bodyPlaceholder: "Start writing, or pick Continue writing to get going.",
  toolbarLabel: "Formatting",
  tools: { bold: "Bold", italic: "Italic", underline: "Underline", heading: "Heading", bullets: "Bulleted list", numbers: "Numbered list", clear: "Clear formatting" },
  edited: "Edited",
  justNow: "just now",
  words: (n: number) => `${n.toLocaleString()} ${n === 1 ? "word" : "words"}`,
  chars: (n: number) => `${n.toLocaleString()} characters`,
  readTime: (n: number) => `${Math.max(1, Math.round(n / 220))} min read`,
  selected: (n: number) => `${n.toLocaleString()} selected`,
  askAi: "Ask AI",
  askAiHint: "Ask AI about the selection (Ctrl+J)",
  assistLabel: "Writing assistant",
  workingOn: "Working on",
  targetSelection: "Selected text",
  targetParagraph: "This paragraph",
  targetFirst: "First paragraph",
  pickHint: "Select some text or click into a paragraph, then pick an action.",
  actions: { improve: "Improve", shorten: "Shorten", tone: "Change tone", continue: "Continue writing" },
  done: { improve: "Improved", shorten: "Shortened", tone: "Tone", continue: "Continued" },
  toneLabel: "Tone",
  tones: [
    {
      id: "friendly",
      label: "Friendly",
      swaps: [["we are", "we're"], ["you are", "you're"], ["it is", "it's"], ["do not", "don't"], ["cannot", "can't"], ["Dear ", "Hi "], ["purchase", "pick up"], ["pleased", "really happy"], ["regards", "thanks"]],
    },
    {
      id: "professional",
      label: "Professional",
      swaps: [["we're", "we are"], ["you're", "you are"], ["it's", "it is"], ["can't", "cannot"], ["don't", "do not"], ["won't", "will not"], ["really ", ""], ["a lot of", "plenty of"], ["just ", ""], ["actually ", ""], ["thank you so much", "thank you"], ["Hi ", "Dear "], ["excited", "pleased"], ["love", "enjoy"], ["!", "."]],
    },
    {
      id: "confident",
      label: "Confident",
      swaps: [["we think ", ""], ["we hope", "we know"], ["really ", ""], ["just ", ""], ["actually ", ""], ["I wanted to", "I'm writing to"], ["could be", "is"], ["might", "will"], ["a lot of", "plenty of"], ["try to", ""]],
    },
    {
      id: "playful",
      label: "Playful",
      swaps: [["we are", "we're"], ["you are", "you're"], ["it is", "it's"], ["excited", "over the moon"], ["looking for", "on the hunt for"], ["very well", "beautifully"], ["closed", "taking a breather"], ["love", "fall for"], ["new things", "new treats"]],
    },
  ],
  askLabel: "Ask the assistant",
  askPlaceholder: "e.g. make it more formal",
  askSend: "Ask",
  asked: "You asked",
  thinking: "Writing…",
  exampleBadge: "Example suggestion",
  exampleNote: "Written in this preview from the app's examples, not by a live model. Read it before you use it.",
  insert: "Insert",
  insertBelow: "Insert below",
  replace: "Replace",
  discard: "Discard",
  ready: "Suggestion ready. Choose Insert, Replace or Discard.",
  discarded: "Suggestion discarded.",
  inserted: "Suggestion inserted into the document.",
  replaced: "Text replaced with the suggestion.",
  stale: "That text has changed since you asked. Select it again and ask once more.",
  nothing: "There's no text to work on yet. Write a sentence first.",
  alreadyGood: "This already reads clearly, so there's nothing to change. Try Shorten or another tone.",
  alreadyShort: "This is already about as short as it can be without losing meaning.",
  alreadyTone: (tone: string) => `This already sounds ${tone.toLowerCase()}. Try another tone.`,
  historyLabel: "Applied suggestions",
  historyEmpty: "Suggestions you insert or replace show up here, each with its own Undo.",
  undo: "Undo",
  undone: "Undone",
  undoDone: "Change undone.",
  undoGone: "That change was already edited away, so there's nothing to undo.",
  modeInsert: "Inserted",
  modeReplace: "Replaced",
  tidy: [
    ["in order to", "to"],
    ["a lot of", "plenty of"],
    ["really ", ""],
    ["very ", ""],
    ["just ", ""],
    ["actually ", ""],
    ["that is grown", "grown"],
    ["at this point in time", "now"],
    ["due to the fact that", "because"],
  ],
  genericNext: ["If you have any questions, reply to this message and someone from the team will get back to you the same day."],
  docs: [
    {
      id: "d1",
      folder: "newsletter",
      title: "Spring menu announcement",
      edited: "Today, 9:40 AM",
      blocks: [
        { h: "Spring is on the menu" },
        {
          p: "We are really excited to tell you that our spring menu is finally here, and it has a lot of new things on it that we think you are going to love. From Monday 14 April, every one of our three cafés will be pouring it.",
          improve: "Our spring menu arrives on Monday 14 April, and it's full of new drinks we think you'll love. All three of our cafés will be pouring it from opening time.",
          shorten: "Our spring menu lands in all three cafés on Monday 14 April.",
        },
        {
          p: "The star of the menu is a honey lavender latte made with lavender that is grown just outside of town by the Okafor family, who have actually been growing it for over twenty years. It is sweet but not too sweet, and it works very well iced.",
          improve: "The star is a honey lavender latte, made with lavender the Okafor family has grown just outside town for more than twenty years. It's gently sweet, and even better iced.",
          shorten: "The star is a honey lavender latte made with lavender from the Okafor family farm. It's gently sweet and great iced.",
        },
        {
          p: "We have also brought back the cardamom bun, which a lot of you asked for, and there is a new oat milk cold brew for anyone who wants something lighter in the afternoon.",
          improve: "The cardamom bun is back by popular demand, and there's a new oat milk cold brew for a lighter afternoon pick-me-up.",
          shorten: "The cardamom bun is back, joined by a new oat milk cold brew.",
        },
      ],
      next: [
        "Come in during the first week and your first spring drink is on us: show this email at the counter. We can't wait to hear what you think.",
        "Prefer to order ahead? The whole spring menu is in the app from Monday morning, so your drink can be waiting when you arrive.",
      ],
    },
    {
      id: "d2",
      folder: "website",
      title: "About us page",
      edited: "Yesterday, 4:15 PM",
      blocks: [
        { h: "Who we are" },
        {
          p: "Fernhill started in 2016 as a single roaster in a borrowed garage on Mill Lane. Today we roast around 400 kilograms of coffee every week, and we sell it in our three cafés and to about forty other cafés in the region.",
          improve: "Fernhill began in 2016 with one roaster in a borrowed garage on Mill Lane. Today we roast about 400 kilograms of coffee a week for our three cafés and around forty more across the region.",
          shorten: "Fernhill began in 2016 in a garage on Mill Lane. Now we roast 400 kilograms a week for our cafés and forty others.",
        },
        {
          p: "We buy directly from eleven farms in Colombia, Ethiopia and Guatemala and we pay well above the market price, because we think the people who grow the coffee should be able to make a good living from it.",
          improve: "We buy directly from eleven farms in Colombia, Ethiopia and Guatemala and pay well above the market price, because the people who grow coffee should make a good living from it.",
          shorten: "We buy direct from eleven farms and pay well above market price, so growers earn a fair living.",
        },
      ],
      next: [
        "Every bag we sell carries the name of the farm it came from, and the price we paid for it. If you're ever passing Mill Lane, the roastery door is open on Saturday mornings.",
      ],
    },
    {
      id: "d3",
      folder: "sales",
      title: "Wholesale pitch to cafés",
      edited: "Mon, 11:02 AM",
      blocks: [
        {
          p: "Hi Priya, thank you so much for taking the time to chat with me at the market on Saturday. I just wanted to follow up on what we talked about in order to see if Fernhill could be a good fit for Little Fern Bakery.",
          improve: "Hi Priya, thanks again for chatting with me at the market on Saturday. I'm following up to see whether Fernhill could be a good fit for Little Fern Bakery.",
          shorten: "Hi Priya, great to meet you on Saturday. Could Fernhill be a fit for Little Fern Bakery?",
        },
        {
          p: "We can deliver fresh coffee every Tuesday, we train your team for free, and we can lend you a grinder for as long as you stock our beans. Most of our wholesale partners start with two blends and then add a single origin later on.",
          improve: "We deliver fresh coffee every Tuesday, train your team for free, and lend you a grinder for as long as you stock our beans. Most partners start with two blends and add a single origin later.",
          shorten: "Weekly Tuesday delivery, free training and a loaned grinder. Most partners start with two blends.",
        },
      ],
      next: ["Would a tasting at the bakery next week work? I can bring both blends and a grinder, and it takes about thirty minutes."],
    },
    {
      id: "d4",
      folder: "drafts",
      title: "Barista hiring post",
      edited: "Oct 3",
      blocks: [
        {
          p: "We are looking for a part-time barista to join the team at our Station Road café. You don't need a lot of experience, but you do need to really enjoy talking to people and be happy to work some weekend shifts.",
          improve: "We're hiring a part-time barista for our Station Road café. Experience matters less than enjoying people and being happy to work some weekend shifts.",
          shorten: "We're hiring a part-time barista for Station Road. You'll need to enjoy people and work some weekends.",
        },
        {
          p: "The pay is $19 an hour plus tips, and you get free coffee, a bag of beans every month and paid training with our head roaster.",
          improve: "Pay is $19 an hour plus tips, with free coffee, a monthly bag of beans and paid training with our head roaster.",
          shorten: "$19 an hour plus tips, free coffee and paid training.",
        },
      ],
      next: ["To apply, send us a few lines about yourself and the shifts you can work. We read every message and reply within a week."],
    },
    {
      id: "d5",
      folder: "drafts",
      title: "Holiday hours notice",
      edited: "Sep 28",
      blocks: [
        {
          p: "Just a quick note to let you know that all of our cafés will be closed on Monday 26 May for the holiday. Our online shop will stay open as normal, and orders placed over the weekend will be shipped on Tuesday.",
          improve: "All of our cafés will be closed on Monday 26 May for the holiday. The online shop stays open, and weekend orders will ship on Tuesday.",
          shorten: "Our cafés close on Monday 26 May. Online orders ship Tuesday.",
        },
      ],
      next: ["We'll be back to our usual hours on Tuesday 27 May, with fresh cardamom buns from 7 AM."],
    },
  ],
};

type ActionId = "improve" | "shorten" | "tone" | "continue";
type Doc = { id: string; folder: string; title: string; edited: string; html: string; opened: number };
type Target = { kind: "selection"; range: Range; text: string } | { kind: "paragraph"; el: Element; text: string; first?: boolean };
type Suggestion = {
  id: string;
  action: ActionId;
  label: string;
  asked?: string;
  source: string;
  text: string;
  shown: number;
  typing: boolean;
  target: Target;
  note?: string;
};
type Entry = { id: string; docId: string; label: string; mode: "insert" | "replace"; excerpt: string; before: string; time: string; undone?: boolean };

const P = {
  menu: "M4 6h16M4 12h16M4 18h16",
  shorten: "M4 7h16M4 12h10M4 17h6",
  tone: "M3 12h3l3-7 4 14 3-7h5",
  bullets: "M9 6h11M9 12h11M9 18h11M4.5 6h.01M4.5 12h.01M4.5 18h.01",
  numbers: "M10 6h10M10 12h10M10 18h10M4 4.5h1.5V9M3.5 9h3M3.5 15.5a1.5 1.5 0 0 1 3 .3c0 1-3 2.2-3 3.2h3",
  clear: "M4 7V5h12v2M10 5l-3 14M5 19h6M15 14l5 5M20 14l-5 5",
  undo: "M9 14 4 9l5-5M4 9h11a5 5 0 0 1 0 10h-3",
};

function Glyph({ d }: { d: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={d} />
    </svg>
  );
}

let seq = 0;
const uid = (p: string) => `${p}${Date.now().toString(36)}${(seq++).toString(36)}`;

function reducedMotion() {
  try {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return false;
  }
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const norm = (s: string) => s.replace(/\s+/g, " ").trim();
const countWords = (s: string) => (norm(s) ? norm(s).split(" ").length : 0);
const excerpt = (s: string, n = 64) => (norm(s).length > n ? `${norm(s).slice(0, n).trimEnd()}…` : norm(s));
const plain = (html: string) => html.replace(/<(br|\/p|\/h2|\/li)[^>]*>/gi, " ").replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
const now = () => new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });

type Block = (typeof SAMPLE.docs)[number]["blocks"][number];
const htmlOf = (blocks: readonly Block[]) =>
  blocks.map((b) => ("h" in b && b.h ? `<h2>${esc(b.h)}</h2>` : "p" in b && b.p ? `<p>${esc(b.p)}</p>` : "")).join("") || "<p><br></p>";

// The rewrites SAMPLE knows, found by a paragraph's original wording.
const CANNED = new Map<string, { improve: string; shorten: string }>();
for (const doc of SAMPLE.docs) for (const b of doc.blocks) if ("p" in b && b.p && b.improve && b.shorten) CANNED.set(norm(b.p), { improve: b.improve, shorten: b.shorten });

/** Swap words and phrases, keeping a capital at the start of a match and fixing sentence starts after. */
function swap(text: string, pairs: readonly (readonly string[])[]) {
  let out = text;
  for (const [from, to] of pairs) {
    if (!from) continue;
    const e = from.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const re = new RegExp(`${/^\w/.test(from) ? "\\b" : ""}${e}${/\w$/.test(from) ? "\\b" : ""}`, "gi");
    out = out.replace(re, (m) => (to && /^[A-Z]/.test(m) ? to[0]!.toUpperCase() + to.slice(1) : (to ?? "")));
  }
  return out
    .replace(/\s{2,}/g, " ")
    .replace(/\s+([,.!?])/g, "$1")
    .replace(/(^|[.!?]\s+)([a-z])/g, (_m, a: string, b: string) => a + b.toUpperCase())
    .trim();
}

function shorten(text: string) {
  const tidy = swap(text, SAMPLE.tidy);
  const sentences = tidy.split(/(?<=[.!?])\s+/).filter(Boolean);
  if (sentences.length > 1) return sentences.slice(0, Math.ceil(sentences.length / 2)).join(" ");
  // One sentence: drop the trailing clause after the last comma, when what's left still says something.
  const at = tidy.lastIndexOf(", ");
  return at > 30 ? `${tidy.slice(0, at)}.` : tidy;
}

/** The simulated assistant: rewrites from SAMPLE for the original wording, simple rules for anything edited. */
function compose(action: ActionId, source: string, toneId: string, docId: string, turn: number): { text: string; note?: string } {
  const canned = CANNED.get(norm(source));
  if (action === "continue") {
    const list = SAMPLE.docs.find((d) => d.id === docId)?.next ?? SAMPLE.genericNext;
    return { text: list[turn % list.length] ?? SAMPLE.genericNext[0]! };
  }
  if (action === "improve") {
    const text = canned?.improve ?? swap(source, SAMPLE.tidy);
    return norm(text) === norm(source) ? { text: "", note: SAMPLE.alreadyGood } : { text };
  }
  if (action === "shorten") {
    const text = canned?.shorten ?? shorten(source);
    return norm(text) === norm(source) ? { text: "", note: SAMPLE.alreadyShort } : { text };
  }
  const tone = SAMPLE.tones.find((t) => t.id === toneId) ?? SAMPLE.tones[0]!;
  const text = swap(source, tone.swaps);
  return norm(text) === norm(source) ? { text: "", note: SAMPLE.alreadyTone(tone.label) } : { text };
}

/** Which action a typed request means. */
function readAsk(q: string): { action: ActionId; tone?: string } {
  const s = q.toLowerCase();
  if (/short|trim|concise|cut|tighten|brief/.test(s)) return { action: "shorten" };
  if (/continue|keep going|next|finish|more text|add a/.test(s)) return { action: "continue" };
  if (/formal|professional|business/.test(s)) return { action: "tone", tone: "professional" };
  if (/friend|warm|casual|relaxed/.test(s)) return { action: "tone", tone: "friendly" };
  if (/confiden|bold|assertive|sure/.test(s)) return { action: "tone", tone: "confident" };
  if (/fun|playful|cheeky|light/.test(s)) return { action: "tone", tone: "playful" };
  return { action: "improve" };
}

const BLOCKS = "p, h2, h3, li, blockquote";

export default function AppAiWriter() {
  const d = SAMPLE;
  const [docs, setDocs] = useState<Doc[]>(() => d.docs.map((x, i) => ({ id: x.id, folder: x.folder, title: x.title, edited: x.edited, html: htmlOf(x.blocks), opened: d.docs.length - i })));
  const [activeId, setActiveId] = useState(d.docs[0]!.id);
  const [folder, setFolder] = useState("all");
  const [query, setQuery] = useState("");
  const [docsOpen, setDocsOpen] = useState(false);
  const [stats, setStats] = useState({ words: 0, chars: 0, selected: 0 });
  const [formats, setFormats] = useState({ bold: false, italic: false, underline: false, heading: false, bullets: false, numbers: false });
  const [target, setTarget] = useState<{ kind: "selection" | "paragraph"; text: string } | null>(null);
  const [bubble, setBubble] = useState<{ top: number; left: number } | null>(null);
  const [tone, setTone] = useState(d.tones[1]!.id);
  const [ask, setAsk] = useState("");
  const [sugg, setSugg] = useState<Suggestion | null>(null);
  const [history, setHistory] = useState<Entry[]>([]);
  const [say, setSay] = useState("");

  const editorRef = useRef<HTMLDivElement>(null);
  const pageRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLInputElement>(null);
  const assistRef = useRef<HTMLElement>(null);
  const docsBtn = useRef<HTMLSpanElement>(null);
  const sideRef = useRef<HTMLElement>(null);
  const targetRef = useRef<Target | null>(null);
  const lastRange = useRef<Range | null>(null);
  const typer = useRef<number | null>(null);
  const turns = useRef<Record<string, number>>({});
  const activeRef = useRef(activeId);
  const docsRef = useRef(docs);
  activeRef.current = activeId;
  docsRef.current = docs;

  const active = docs.find((x) => x.id === activeId) ?? docs[0]!;
  const busy = !!sugg?.typing;

  function announce(text: string) {
    setSay("");
    window.setTimeout(() => setSay(text), 30);
  }

  function stopTyping() {
    if (typer.current) window.clearInterval(typer.current);
    typer.current = null;
  }

  // Pressing Enter makes a new paragraph rather than a div.
  useEffect(() => {
    try {
      document.execCommand("defaultParagraphSeparator", false, "p");
    } catch {
      /* older engines: their default is fine */
    }
    return stopTyping;
  }, []);

  // Load the open document into the page (the page is not re-rendered by React while you type).
  useLayoutEffect(() => {
    const ed = editorRef.current;
    const doc = docsRef.current.find((x) => x.id === activeId);
    if (!ed || !doc) return;
    ed.innerHTML = doc.html;
    targetRef.current = null;
    lastRange.current = null;
    setTarget(null);
    setBubble(null);
    stopTyping();
    setSugg(null);
    recount();
    pageRef.current?.scrollTo?.({ top: 0 });
  }, [activeId]);

  function recount(selected = 0) {
    const text = editorRef.current?.innerText ?? "";
    setStats({ words: countWords(text), chars: norm(text).length, selected });
  }

  /** Save the page's HTML to the open document after any change. */
  function sync() {
    const ed = editorRef.current;
    if (!ed) return;
    const html = ed.innerHTML;
    const id = activeRef.current;
    setDocs((ds) => ds.map((x) => (x.id === id ? { ...x, html, edited: `${d.edited} ${d.justNow}` } : x)));
    recount();
  }

  function blockOf(node: Node | null): Element | null {
    const ed = editorRef.current;
    let el: Node | null = node;
    while (el && el !== ed) {
      if (el instanceof Element && el.matches(BLOCKS)) return el;
      el = el.parentNode;
    }
    return null;
  }

  // Follow the selection inside the page: what the assistant works on, the Ask AI button, the toolbar's pressed states.
  useEffect(() => {
    const onSel = () => {
      const ed = editorRef.current;
      const sel = document.getSelection();
      if (!ed || !sel || !sel.rangeCount) return;
      const range = sel.getRangeAt(0);
      if (!ed.contains(range.commonAncestorContainer)) {
        // Selecting elsewhere (the assistant, the list) keeps what the assistant is working on, but hides the button.
        if (document.activeElement !== ed && !sel.isCollapsed) setBubble(null);
        return;
      }
      lastRange.current = range.cloneRange();
      const text = range.toString();
      if (!range.collapsed && text.trim()) {
        targetRef.current = { kind: "selection", range: range.cloneRange(), text };
        setTarget({ kind: "selection", text });
        const r = range.getBoundingClientRect();
        const page = pageRef.current;
        if (page && (r.width || r.height)) {
          const box = page.getBoundingClientRect();
          setBubble({
            top: Math.max(4, r.top - box.top + page.scrollTop - 44),
            left: Math.min(Math.max(8, r.left - box.left + r.width / 2 - 48), Math.max(8, box.width - 112)),
          });
        }
        recount(countWords(text));
      } else {
        const el = blockOf(range.startContainer);
        if (el && el.textContent?.trim()) {
          targetRef.current = { kind: "paragraph", el, text: el.textContent ?? "" };
          setTarget({ kind: "paragraph", text: el.textContent ?? "" });
        }
        setBubble(null);
        setStats((s) => (s.selected ? { ...s, selected: 0 } : s));
      }
      try {
        const block = String(document.queryCommandValue("formatBlock") || "").toLowerCase();
        setFormats({
          bold: document.queryCommandState("bold"),
          italic: document.queryCommandState("italic"),
          underline: document.queryCommandState("underline"),
          heading: block === "h2",
          bullets: document.queryCommandState("insertUnorderedList"),
          numbers: document.queryCommandState("insertOrderedList"),
        });
      } catch {
        /* not available: the buttons still work, they just don't show as pressed */
      }
    };
    document.addEventListener("selectionchange", onSel);
    return () => document.removeEventListener("selectionchange", onSel);
  }, []);

  function format(cmd: "bold" | "italic" | "underline" | "heading" | "bullets" | "numbers" | "clear") {
    const ed = editorRef.current;
    if (!ed) return;
    ed.focus();
    const sel = document.getSelection();
    if (sel && lastRange.current && ed.contains(lastRange.current.commonAncestorContainer)) {
      sel.removeAllRanges();
      sel.addRange(lastRange.current);
    }
    if (cmd === "heading") document.execCommand("formatBlock", false, formats.heading ? "p" : "h2");
    else if (cmd === "bullets") document.execCommand("insertUnorderedList");
    else if (cmd === "numbers") document.execCommand("insertOrderedList");
    else if (cmd === "clear") document.execCommand("removeFormat");
    else document.execCommand(cmd);
    sync();
  }

  function onToolbarKey(e: KeyboardEvent<HTMLDivElement>) {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(e.key)) return;
    const items = [...e.currentTarget.querySelectorAll<HTMLButtonElement>("button")];
    const at = items.indexOf(document.activeElement as HTMLButtonElement);
    const next = e.key === "Home" ? 0 : e.key === "End" ? items.length - 1 : (at + (e.key === "ArrowRight" ? 1 : -1) + items.length) % items.length;
    e.preventDefault();
    items.forEach((b, i) => (b.tabIndex = i === next ? 0 : -1));
    items[next]?.focus();
  }

  function onPaste(e: ClipboardEvent<HTMLDivElement>) {
    // Pasted text comes in plain, so another app's styling doesn't follow it into the document.
    e.preventDefault();
    document.execCommand("insertText", false, e.clipboardData.getData("text/plain"));
  }

  function onEditorKey(e: KeyboardEvent<HTMLDivElement>) {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "j") {
      e.preventDefault();
      askAi();
    }
  }

  function askAi() {
    setBubble(null);
    window.setTimeout(() => {
      const panel = assistRef.current;
      panel?.scrollIntoView?.({ block: "nearest" });
      panel?.querySelector<HTMLButtonElement>(".fl-aiw-quick button")?.focus();
    }, 0);
  }

  /** What an action works on: the selection, the paragraph holding the cursor, or the first paragraph. */
  function resolveTarget(): Target | null {
    const ed = editorRef.current;
    if (!ed) return null;
    const t = targetRef.current;
    if (t?.kind === "selection" && ed.contains(t.range.commonAncestorContainer) && t.range.toString().trim()) return { ...t, text: t.range.toString() };
    if (t?.kind === "paragraph" && ed.contains(t.el) && t.el.textContent?.trim()) return { ...t, text: t.el.textContent ?? "" };
    const first = [...ed.querySelectorAll("p, li")].find((p) => p.textContent?.trim());
    return first ? { kind: "paragraph", el: first, text: first.textContent ?? "", first: true } : null;
  }

  function run(action: ActionId, toneId = tone, asked?: string) {
    if (busy) return;
    const t = resolveTarget();
    if (!t) {
      announce(d.nothing);
      return;
    }
    const turn = turns.current[`${activeId}:${action}`] ?? 0;
    if (action === "continue") turns.current[`${activeId}:${action}`] = turn + 1;
    const out = compose(action, t.text, toneId, activeId, turn);
    const toneLabel = d.tones.find((x) => x.id === toneId)?.label ?? "";
    const label = action === "tone" ? `${d.done.tone}: ${toneLabel}` : d.done[action];
    const s: Suggestion = { id: uid("s"), action, label, asked, source: t.text, text: out.text, shown: 0, typing: !out.note, target: t, note: out.note };
    stopTyping();
    setSugg(s);
    if (out.note) {
      announce(out.note);
      return;
    }
    if (reducedMotion()) {
      setSugg({ ...s, shown: out.text.length, typing: false });
      announce(`${d.ready} ${out.text}`);
      return;
    }
    // A short wait, then the words type themselves in.
    const step = Math.max(2, Math.ceil(out.text.length / 55));
    let shown = 0;
    typer.current = window.setTimeout(() => {
      typer.current = window.setInterval(() => {
        shown = Math.min(out.text.length, shown + step);
        const finished = shown >= out.text.length;
        setSugg((cur) => (cur && cur.id === s.id ? { ...cur, shown, typing: !finished } : cur));
        if (finished) {
          stopTyping();
          announce(`${d.ready} ${out.text}`);
        }
      }, 22);
    }, 450) as unknown as number;
  }

  function finishNow() {
    stopTyping();
    setSugg((cur) => (cur ? { ...cur, shown: cur.text.length, typing: false } : cur));
  }

  function discard() {
    stopTyping();
    setSugg(null);
    announce(d.discarded);
    editorRef.current?.focus();
  }

  function mark(id: string, text: string) {
    const span = document.createElement("span");
    span.dataset.aiw = id;
    span.className = "fl-aiw-new";
    span.textContent = text;
    return span;
  }

  function apply(mode: "insert" | "replace") {
    const s = sugg;
    const ed = editorRef.current;
    if (!s || s.typing || !s.text || !ed) return;
    const id = uid("h");
    let before = "";
    let placed: Element | null = null;
    if (mode === "replace") {
      if (s.target.kind === "selection") {
        const r = s.target.range;
        if (!ed.contains(r.commonAncestorContainer) || r.toString() !== s.source) return announce(d.stale);
        const holder = document.createElement("div");
        holder.appendChild(r.cloneContents());
        before = holder.innerHTML;
        r.deleteContents();
        placed = mark(id, s.text);
        r.insertNode(placed);
      } else {
        const el = s.target.el;
        if (!ed.contains(el) || norm(el.textContent ?? "") !== norm(s.source)) return announce(d.stale);
        before = el.innerHTML;
        el.textContent = "";
        placed = mark(id, s.text);
        el.appendChild(placed);
      }
    } else {
      const anchor = s.target.kind === "selection" ? blockOf(s.target.range.endContainer) : s.target.el;
      let top: Element | null = anchor && ed.contains(anchor) ? anchor : null;
      while (top && top.parentElement && top.parentElement !== ed) top = top.parentElement;
      const p = document.createElement("p");
      p.dataset.aiw = id;
      p.className = "fl-aiw-new";
      p.textContent = s.text;
      if (top) top.after(p);
      else ed.appendChild(p);
      placed = p;
    }
    window.setTimeout(() => {
      placed?.classList.remove("fl-aiw-new");
      if (placed?.isConnected && !placed.className) placed.removeAttribute("class");
      sync();
    }, 1600);
    sync();
    setHistory((h) => [{ id, docId: activeId, label: s.label, mode, excerpt: excerpt(s.text, 80), before, time: now() }, ...h]);
    setSugg(null);
    targetRef.current = null;
    setTarget(null);
    announce(mode === "insert" ? d.inserted : d.replaced);
    placed?.scrollIntoView?.({ block: "nearest" });
  }

  function undo(entry: Entry) {
    const ed = editorRef.current;
    if (!ed || entry.undone) return;
    const el = ed.querySelector(`[data-aiw="${entry.id}"]`);
    if (!el) {
      announce(d.undoGone);
      return;
    }
    if (entry.mode === "insert") el.remove();
    else {
      const tpl = document.createElement("template");
      tpl.innerHTML = entry.before;
      el.replaceWith(tpl.content);
    }
    sync();
    setHistory((h) => h.map((x) => (x.id === entry.id ? { ...x, undone: true } : x)));
    announce(d.undoDone);
  }

  function openDoc(id: string) {
    setActiveId(id);
    setDocs((ds) => ds.map((x) => (x.id === id ? { ...x, opened: Date.now() } : x)));
    if (docsOpen) closeDocs(false);
  }

  function newDoc() {
    const id = uid("d");
    const where = folder === "all" ? "drafts" : folder;
    setDocs((ds) => [{ id, folder: where, title: "", edited: `${d.edited} ${d.justNow}`, html: "<p><br></p>", opened: Date.now() }, ...ds]);
    setActiveId(id);
    setQuery("");
    if (docsOpen) setDocsOpen(false);
    window.setTimeout(() => titleRef.current?.focus(), 0);
  }

  function closeDocs(refocus = true) {
    setDocsOpen(false);
    if (refocus) window.setTimeout(() => docsBtn.current?.querySelector("button")?.focus(), 0);
  }

  useEffect(() => {
    if (docsOpen) sideRef.current?.querySelector<HTMLElement>("button, input")?.focus();
  }, [docsOpen]);

  const q = query.trim().toLowerCase();
  const listed = docs.filter((x) => (q ? `${x.title} ${plain(x.html)}`.toLowerCase().includes(q) : folder === "all" || x.folder === folder));
  const recent = [...docs].sort((a, b) => b.opened - a.opened).slice(0, 3);
  const folderName = d.folders.find((f) => f.id === active.folder)?.name ?? d.allDocs;
  const docHistory = history.filter((h) => h.docId === activeId);
  const typed = sugg ? sugg.text.slice(0, sugg.shown) : "";
  const targetText = target?.text ?? "";
  const toneLabel = d.tones.find((t) => t.id === tone)?.label ?? "";

  const tools: { id: "bold" | "italic" | "underline" | "heading" | "bullets" | "numbers" | "clear"; label: string; glyph: string | null; letter?: string }[] = [
    { id: "bold", label: d.tools.bold, glyph: null, letter: "B" },
    { id: "italic", label: d.tools.italic, glyph: null, letter: "I" },
    { id: "underline", label: d.tools.underline, glyph: null, letter: "U" },
    { id: "heading", label: d.tools.heading, glyph: null, letter: "H" },
    { id: "bullets", label: d.tools.bullets, glyph: P.bullets },
    { id: "numbers", label: d.tools.numbers, glyph: P.numbers },
    { id: "clear", label: d.tools.clear, glyph: P.clear },
  ];

  const docRow = (x: Doc, where: string) => (
    <li key={`${where}-${x.id}`}>
      <button type="button" className="fl-aiw-doc" aria-current={x.id === activeId ? "page" : undefined} onClick={() => openDoc(x.id)}>
        <span className="fl-aiw-doc__title">{x.title || d.untitled}</span>
        {where === "list" && <span className="fl-aiw-doc__snip">{excerpt(plain(x.html), 70) || d.bodyPlaceholder}</span>}
        <span className="fl-aiw-doc__meta">{x.edited}</span>
      </button>
    </li>
  );

  return (
    <div className="fl-aiw">
      <div className="fl-aiw-app" data-docs={docsOpen ? "open" : undefined}>
        {docsOpen && <button type="button" className="fl-aiw-scrim" aria-label={d.closeDocs} tabIndex={-1} onClick={() => closeDocs()} />}

        <aside
          ref={sideRef}
          id="fl-aiw-docs"
          className="fl-aiw-side"
          aria-label={d.docsLabel}
          onKeyDown={(e) => {
            if (e.key === "Escape" && docsOpen) {
              e.preventDefault();
              closeDocs();
            }
          }}
        >
          <div className="fl-aiw-side__head">
            <span className="fl-aiw-brand">
              <span className="fl-aiw-bot" aria-hidden="true">
                <Icon name="sparkle" />
              </span>
              {d.product}
            </span>
            <span className="fl-aiw-side__close">
              <Button variant="tertiary" size={32} icon="close" iconOnly onClick={() => closeDocs()}>
                {d.closeDocs}
              </Button>
            </span>
          </div>
          <Button variant="primary" size={40} icon="plus" block onClick={newDoc}>
            {d.newDoc}
          </Button>
          <div className="fl-aiw-search">
            <label htmlFor="fl-aiw-q" className="fl-sr">
              {d.searchLabel}
            </label>
            <Icon name="search" />
            <TextField id="fl-aiw-q" type="search" size={40} placeholder={d.searchPlaceholder} value={query} onChange={(e) => setQuery(e.target.value)} />
          </div>

          <div className="fl-aiw-side__scroll">
            {!q && (
              <nav className="fl-aiw-group" aria-labelledby="fl-aiw-folders-h">
                <h2 id="fl-aiw-folders-h" className="fl-aiw-label">
                  {d.foldersLabel}
                </h2>
                <ul>
                  {[{ id: "all", name: d.allDocs }, ...d.folders].map((f) => (
                    <li key={f.id}>
                      <button type="button" className="fl-aiw-folder" aria-pressed={folder === f.id} onClick={() => setFolder(f.id)}>
                        <Icon name={f.id === "all" ? "layers" : "folder"} />
                        <span>{f.name}</span>
                        <span className="fl-aiw-folder__n">{f.id === "all" ? docs.length : docs.filter((x) => x.folder === f.id).length}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </nav>
            )}

            {!q && (
              <section className="fl-aiw-group" aria-labelledby="fl-aiw-recent-h">
                <h2 id="fl-aiw-recent-h" className="fl-aiw-label">
                  <Icon name="clock" />
                  {d.recentLabel}
                </h2>
                <ul>{recent.map((x) => docRow(x, "recent"))}</ul>
              </section>
            )}

            <section className="fl-aiw-group" aria-labelledby="fl-aiw-list-h">
              <h2 id="fl-aiw-list-h" className="fl-aiw-label">
                {q ? d.results : folder === "all" ? d.allDocs : (d.folders.find((f) => f.id === folder)?.name ?? d.allDocs)}
              </h2>
              {listed.length ? <ul>{listed.map((x) => docRow(x, "list"))}</ul> : <p className="fl-aiw-empty">{q ? d.noMatches : d.emptyFolder}</p>}
            </section>
          </div>
        </aside>

        <section className="fl-aiw-main" aria-label={active.title || d.untitled}>
          <header className="fl-aiw-bar">
            <span ref={docsBtn} className="fl-aiw-docsbtn">
              <Button variant="tertiary" size={32} icon="menu" iconOnly aria-expanded={docsOpen} aria-controls="fl-aiw-docs" onClick={() => setDocsOpen(true)}>
                {d.openDocs}
              </Button>
            </span>
            <p className="fl-aiw-crumb">
              <span>{folderName}</span>
              <span aria-hidden="true">/</span>
              <strong>{active.title || d.untitled}</strong>
            </p>
            <span className="fl-aiw-edited">{active.edited}</span>
          </header>

          <div className="fl-aiw-tools" role="toolbar" aria-label={d.toolbarLabel} onKeyDown={onToolbarKey}>
            {tools.map((t, i) => (
              <button
                key={t.id}
                type="button"
                className={`fl-aiw-tool${i === 3 || i === 6 ? " fl-aiw-tool--gap" : ""}`}
                tabIndex={i === 0 ? 0 : -1}
                aria-label={t.label}
                title={t.label}
                aria-pressed={t.id === "clear" ? undefined : formats[t.id]}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => format(t.id)}
              >
                {t.glyph ? <Glyph d={t.glyph} /> : <span className={`fl-aiw-tool__l fl-aiw-tool__l--${t.id}`}>{t.letter}</span>}
              </button>
            ))}
          </div>

          <div ref={pageRef} className="fl-aiw-scroll">
            <article className="fl-aiw-page">
              <label htmlFor="fl-aiw-title" className="fl-sr">
                {d.titleLabel}
              </label>
              <input
                ref={titleRef}
                id="fl-aiw-title"
                className="fl-aiw-title"
                value={active.title}
                placeholder={d.untitled}
                maxLength={120}
                onChange={(e) => {
                  const title = e.target.value;
                  setDocs((ds) => ds.map((x) => (x.id === activeId ? { ...x, title, edited: `${d.edited} ${d.justNow}` } : x)));
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    editorRef.current?.focus();
                  }
                }}
              />
              <div
                ref={editorRef}
                className="fl-aiw-body"
                contentEditable
                suppressContentEditableWarning
                role="textbox"
                aria-multiline="true"
                aria-label={d.bodyLabel}
                aria-describedby="fl-aiw-count"
                data-empty={stats.words === 0 ? "true" : undefined}
                data-placeholder={d.bodyPlaceholder}
                spellCheck
                onInput={sync}
                onPaste={onPaste}
                onKeyDown={onEditorKey}
              />
            </article>
            {bubble && (
              <button
                type="button"
                className="fl-aiw-askbubble"
                style={{ top: bubble.top, left: bubble.left }}
                title={d.askAiHint}
                onMouseDown={(e) => e.preventDefault()}
                onClick={askAi}
              >
                <Icon name="sparkle" />
                {d.askAi}
              </button>
            )}
          </div>

          <footer className="fl-aiw-status" id="fl-aiw-count">
            <span>{d.words(stats.words)}</span>
            <span>{d.chars(stats.chars)}</span>
            <span>{d.readTime(stats.words)}</span>
            {stats.selected > 0 && <span className="fl-aiw-status__sel">{d.selected(stats.selected)}</span>}
          </footer>
        </section>

        <aside ref={assistRef} className="fl-aiw-assist" aria-labelledby="fl-aiw-assist-h">
          <header className="fl-aiw-assist__head">
            <span className="fl-aiw-bot" aria-hidden="true">
              <Icon name="sparkle" />
            </span>
            <h2 id="fl-aiw-assist-h" className="fl-aiw-h2">
              {d.assistantName}
            </h2>
          </header>

          <div className="fl-aiw-target">
            <span className="fl-aiw-label">{d.workingOn}</span>
            {target ? (
              <p>
                <strong>{target.kind === "selection" ? d.targetSelection : d.targetParagraph}: </strong>
                <span className="fl-aiw-target__text">“{excerpt(targetText, 90)}”</span>
              </p>
            ) : (
              <p className="fl-aiw-muted">
                <strong>{d.targetFirst}. </strong>
                {d.pickHint}
              </p>
            )}
          </div>

          <div className="fl-aiw-quick">
            <Button variant="secondary" size={40} icon="sparkle" disabled={busy} onClick={() => run("improve")}>
              {d.actions.improve}
            </Button>
            <Button variant="secondary" size={40} disabled={busy} onClick={() => run("shorten")} className="fl-aiw-glyphbtn">
              <Glyph d={P.shorten} />
              {d.actions.shorten}
            </Button>
            <div className="fl-aiw-tone">
              <label htmlFor="fl-aiw-tone" className="fl-sr">
                {d.toneLabel}
              </label>
              <Select id="fl-aiw-tone" variant="filled" value={tone} disabled={busy} onChange={(e) => setTone(e.target.value)} options={d.tones.map((t) => ({ value: t.id, label: t.label }))} />
              <Button variant="secondary" size={40} disabled={busy} onClick={() => run("tone")} className="fl-aiw-glyphbtn" aria-label={`${d.actions.tone}: ${toneLabel}`}>
                <Glyph d={P.tone} />
                {d.actions.tone}
              </Button>
            </div>
            <Button variant="secondary" size={40} icon="arrow" disabled={busy} onClick={() => run("continue")} className="fl-aiw-quick__wide">
              {d.actions.continue}
            </Button>
          </div>

          <form
            className="fl-aiw-ask"
            onSubmit={(e) => {
              e.preventDefault();
              const text = ask.trim();
              if (!text || busy) return;
              const r = readAsk(text);
              if (r.tone) setTone(r.tone);
              run(r.action, r.tone ?? tone, text);
              setAsk("");
            }}
          >
            <label htmlFor="fl-aiw-ask" className="fl-sr">
              {d.askLabel}
            </label>
            <TextField id="fl-aiw-ask" size={40} placeholder={d.askPlaceholder} value={ask} maxLength={200} onChange={(e) => setAsk(e.target.value)} />
            <Button type="submit" variant="primary" size={40} icon="send" iconOnly disabled={busy || !ask.trim()}>
              {d.askSend}
            </Button>
          </form>

          {sugg && (
            <div className="fl-aiw-sugg" aria-busy={sugg.typing || undefined}>
              <div className="fl-aiw-sugg__head">
                {sugg.typing && sugg.shown === 0 ? <AiIndicator variant="working" label={d.thinking} /> : <AiIndicator variant="generated" label={d.exampleBadge} />}
                <span className="fl-aiw-sugg__what">{sugg.label}</span>
              </div>
              {sugg.asked && (
                <p className="fl-aiw-sugg__asked">
                  {d.asked}: “{sugg.asked}”
                </p>
              )}
              {sugg.note ? (
                <p className="fl-aiw-sugg__note">{sugg.note}</p>
              ) : (
                <p className="fl-aiw-sugg__text" onClick={sugg.typing ? finishNow : undefined}>
                  {typed}
                  {sugg.typing && <span className="fl-aiw-caret" aria-hidden="true" />}
                </p>
              )}
              {!sugg.note && <p className="fl-aiw-sugg__fine">{d.exampleNote}</p>}
              <div className="fl-aiw-sugg__actions">
                {!sugg.note && (
                  <>
                    <Button variant="primary" size={32} icon="plus" disabled={sugg.typing} onClick={() => apply("insert")}>
                      {sugg.action === "continue" ? d.insert : d.insertBelow}
                    </Button>
                    {sugg.action !== "continue" && (
                      <Button variant="secondary" size={32} icon="refresh" disabled={sugg.typing} onClick={() => apply("replace")}>
                        {d.replace}
                      </Button>
                    )}
                  </>
                )}
                <Button variant="tertiary" size={32} icon="close" onClick={discard}>
                  {d.discard}
                </Button>
              </div>
            </div>
          )}

          <section className="fl-aiw-history" aria-labelledby="fl-aiw-hist-h">
            <h3 id="fl-aiw-hist-h" className="fl-aiw-label">
              {d.historyLabel}
            </h3>
            {docHistory.length === 0 ? (
              <p className="fl-aiw-muted fl-aiw-small">{d.historyEmpty}</p>
            ) : (
              <ol>
                {docHistory.map((h) => (
                  <li key={h.id} className="fl-aiw-hist" data-undone={h.undone ? "true" : undefined}>
                    <div>
                      <p className="fl-aiw-hist__top">
                        <strong>{h.label}</strong>
                        <span>
                          {h.mode === "insert" ? d.modeInsert : d.modeReplace} · {h.time}
                        </span>
                      </p>
                      <p className="fl-aiw-hist__text">{h.excerpt}</p>
                    </div>
                    {h.undone ? (
                      <span className="fl-aiw-hist__undone">{d.undone}</span>
                    ) : (
                      <button type="button" className="fl-aiw-undo" onClick={() => undo(h)} aria-label={`${d.undo}: ${h.label}, ${h.excerpt}`}>
                        <Glyph d={P.undo} />
                        {d.undo}
                      </button>
                    )}
                  </li>
                ))}
              </ol>
            )}
          </section>
        </aside>
      </div>
      <p className="fl-sr" aria-live="polite">
        {say}
      </p>
    </div>
  );
}
