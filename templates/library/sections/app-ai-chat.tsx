/** @flowcode-library app-ai-chat · AI assistant chat (App screens)
 * Use cases: ai chat; chatbot; ai assistant; conversation history; customer support bot; writing assistant; coding assistant; q&a assistant
 * Jobs to be done: ask the assistant a question; pick up a past conversation; copy code from an answer; get started with a suggested prompt
 * Keywords: app, ai, chat, assistant, streaming, composer, history, sidebar, drawer, markdown
 */
/**
 * App screen: AI assistant chat. A history sidebar (new chat, search, rename, delete with undo) beside a centred
 * thread where your messages sit in bubbles and the assistant's replies stream in word by word with a Stop button.
 * Replies understand light formatting (bold, lists, inline code and code blocks with a Copy button) and carry Copy,
 * Regenerate and thumbs up / down. An empty chat offers suggested prompts. The composer has an attach button (shows a
 * file chip; nothing is uploaded), a model picker, Enter to send and Shift+Enter for a new line, and a character
 * limit. The assistant is simulated in the browser: it picks a canned, sensible reply from the prompt's keywords and
 * sends nothing anywhere. A prompt that mentions the newsletter fails once so the error state and Retry can be seen.
 * On phones it folds to one column and the history opens as a drawer. Use it for any app with a built-in assistant.
 * Make it the app's own: replace SAMPLE with the app's own assistant name, prompts and history, and swap pickReply()
 * for a call to the app's real assistant service, streaming its words into the same message.
 */
import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { Icon } from "./icons";

// flowcode:sample
const SAMPLE = {
  product: "Hollow Pine",
  assistantName: "Studio assistant",
  you: "You",
  newChat: "New chat",
  newTitle: "New chat",
  historyLabel: "Chat history",
  searchLabel: "Search chats",
  searchPlaceholder: "Search chats",
  noMatches: "No chats match your search.",
  noChats: "No chats yet. Start one and it will show up here.",
  groups: ["Today", "Previous 7 days", "Earlier"],
  openHistory: "Open chat history",
  closeHistory: "Close chat history",
  deleted: "Chat deleted.",
  undo: "Undo",
  restored: "Chat restored.",
  renameLabel: "Chat name",
  emptyHeading: "What can I help with today?",
  emptyText: "Ask about bookings, customers, your timetable or the numbers. I draft; you decide what gets sent.",
  suggestions: [
    { title: "Reply to a refund request", text: "Draft a friendly reply to a customer who cancelled Saturday's class and wants a refund" },
    { title: "Plan next week's classes", text: "Plan next week's class timetable around our busiest evenings" },
    { title: "Caption for the open day", text: "Write a short social post caption announcing our open day" },
    { title: "A spreadsheet formula", text: "Give me a spreadsheet formula that counts bookings for one month" },
  ],
  composerLabel: "Message the assistant",
  composerPlaceholder: "Ask the assistant anything",
  limit: 1000,
  overLimit: (n: number) => `That's ${n} characters over the limit. Shorten it to send.`,
  attach: "Attach a file",
  attachNote: "Files stay on this device; only the name is shared with the assistant here.",
  removeFile: "Remove attachment",
  modelLabel: "Model",
  models: [
    { id: "quick", label: "Quick" },
    { id: "balanced", label: "Balanced" },
    { id: "thorough", label: "Thorough" },
  ],
  send: "Send message",
  stop: "Stop replying",
  thinking: "Thinking…",
  writing: "Writing…",
  done: "Reply ready.",
  stopped: "You stopped this reply.",
  stoppedEmpty: "Stopped before the assistant replied.",
  errorText: "Something went wrong and the reply didn't finish. Nothing you wrote was lost.",
  retry: "Try again",
  copy: "Copy",
  copied: "Copied",
  copyCode: "Copy code",
  codeLabel: "Formula",
  copyFailed: "Couldn't copy. Select the text and copy it instead.",
  regenerate: "Regenerate",
  good: "Good reply",
  bad: "Not helpful",
  thanks: "Thanks, that helps us improve the replies.",
  disclaimer: "Enter to send, Shift+Enter for a new line. The assistant can get things wrong, so check prices and dates.",
  failWords: ["newsletter"],
  fileReply: (name: string) => `I can see you attached **${name}**. In this preview I only see its name, so I'll answer from what you wrote.\n\n`,
  replies: [
    {
      keywords: ["refund", "cancel", "money back"],
      texts: [
        "Here's a reply you can send. It's warm, clear about the policy, and offers a way to keep the booking:\n\n**Subject:** Your refund for Saturday's class\n\nHi Sam,\nThanks for letting us know. Because you cancelled more than 48 hours ahead, you're due a full refund of **$45**. It's on its way to your original card and usually lands in 3 to 5 working days.\n\nIf you'd rather keep your seat, I can move you to any class in the next 60 days instead.\n\nWarm wishes,\nThe Hollow Pine team\n\nWant it shorter, or a little more formal?",
        "A shorter version:\n\nHi Sam,\nNo problem at all. Your **$45** refund is on its way and should reach your card within 5 working days. If you change your mind, reply to this email and I'll book you into another class instead.\n\nSee you soon,\nThe Hollow Pine team",
      ],
    },
    {
      keywords: ["timetable", "schedule", "week", "classes", "rota"],
      texts: [
        "Here's a week that keeps your busiest slots full and gives instructors a quiet day:\n\n1. **Monday:** Beginners' wheel, 6 to 8pm (8 seats)\n2. **Tuesday:** Hand-building, 10am to 12pm (10 seats)\n3. **Wednesday:** Kiln day, no classes\n4. **Thursday:** Intermediate wheel, 6 to 8pm (8 seats)\n5. **Saturday:** Two taster sessions, 10am and 2pm (12 seats each)\n\nTwo things worth knowing:\n\n- Thursday evenings sold out four weeks running, so a second slot at 8:15pm is worth trying.\n- Keeping Wednesday clear means glazed work is ready for weekend pick-up.\n\nShall I turn this into a booking page?",
        "Another way to lay out the week, with more daytime classes for people who work shifts:\n\n- **Monday and Thursday:** wheel classes, 10am and 6pm\n- **Tuesday:** hand-building, 1 to 3pm\n- **Wednesday:** kiln day\n- **Friday:** open studio for members, 4 to 9pm\n- **Saturday:** tasters at 10am, 12:30pm and 3pm\n\nThat's **11 sessions** and about **104 seats**, up from 86 now.",
      ],
    },
    {
      keywords: ["caption", "post", "social", "open day", "announce"],
      texts: [
        "Three options, from playful to plain:\n\n- **Playful:** Muddy hands, full hearts. Our open day is Saturday 18 October, 11am to 4pm. Drop in, try the wheel, keep what you make.\n- **Warm:** Come and see where the bowls are born. Free taster sessions all day Saturday, no booking needed.\n- **Plain:** Open day this Saturday, 11am to 4pm. Free 20-minute wheel tasters, studio tours and 10% off any course booked on the day.\n\nPair it with a photo of a half-finished pot on the wheel; those get the most saves.",
        "Two more, both under 30 words:\n\n- Open day, Saturday 18 October. Free tasters, studio tours and tea from 11am. Bring a friend and leave with something you made.\n- The kiln's hot and the wheels are free. Come and play this Saturday, 11am to 4pm.",
      ],
    },
    {
      keywords: ["formula", "spreadsheet", "sheet", "count", "sum", "total"],
      texts: [
        "Put this in the cell where you want the month's total. It counts every booking in column B whose date falls in the month typed in E1:\n\n```\n=COUNTIFS(B:B, \">=\"&E1, B:B, \"<\"&EDATE(E1, 1))\n```\n\nHow it works:\n\n- `E1` holds the first day of the month, like 1/10/2026.\n- `EDATE(E1, 1)` gives the first day of the next month, so the count stops before it.\n- To total the money instead, use `SUMIFS` with the amounts in column D:\n\n```\n=SUMIFS(D:D, B:B, \">=\"&E1, B:B, \"<\"&EDATE(E1, 1))\n```",
      ],
    },
    {
      keywords: ["price", "pricing", "charge", "cost"],
      texts: [
        "Here's a simple way to price a six-week course:\n\n- **Clay and firing:** about $38 per person\n- **Instructor time:** 12 hours at $35, split across 8 seats, is $52.50 each\n- **Studio overheads:** about $20 per person\n\nThat's roughly **$110 per person** in costs. Studios of your size usually charge **$240 to $280**, which leaves room for the odd empty seat.\n\nWant me to compare that with your taster price?",
      ],
    },
    {
      keywords: ["newsletter", "email"],
      texts: [
        "Here's an October newsletter outline:\n\n1. **A line from the studio:** the new glaze range and who mixed it\n2. **What's on:** open day on the 18th, two new evening classes\n3. **Member spotlight:** a photo and three sentences from one member\n4. **One offer:** 10% off gift vouchers until the end of the month\n\nKeep it to about 250 words so it reads well on a phone.",
      ],
    },
  ],
  fallback:
    "Happy to help. I'll give you something more useful with a little detail:\n\n- who it's for: customers, staff or just you\n- what you want back: a draft, a list or a plan\n- anything I must include, like dates or prices\n\nOr start a new chat and pick one of the suggestions to see what I can do.",
  chats: [
    {
      id: "c1",
      title: "Refund reply for Sam",
      group: "Today",
      messages: [
        { id: "c1m1", role: "user", text: "Draft a friendly reply to a customer who cancelled Saturday's class and wants a refund" },
        {
          id: "c1m2",
          role: "assistant",
          model: "Balanced",
          text: "Here's a reply you can send. It's warm, clear about the policy, and offers a way to keep the booking:\n\n**Subject:** Your refund for Saturday's class\n\nHi Sam,\nThanks for letting us know. Because you cancelled more than 48 hours ahead, you're due a full refund of **$45**. It's on its way to your original card and usually lands in 3 to 5 working days.\n\nIf you'd rather keep your seat, I can move you to any class in the next 60 days instead.\n\nWarm wishes,\nThe Hollow Pine team\n\nWant it shorter, or a little more formal?",
        },
      ],
    },
    {
      id: "c2",
      title: "October newsletter",
      group: "Today",
      messages: [
        { id: "c2m1", role: "user", text: "Outline our October newsletter for members" },
        { id: "c2m2", role: "assistant", model: "Thorough", text: "", state: "error" },
      ],
    },
    {
      id: "c3",
      title: "Pricing the six-week course",
      group: "Previous 7 days",
      messages: [
        { id: "c3m1", role: "user", text: "How should I price a six-week wheel course?" },
        {
          id: "c3m2",
          role: "assistant",
          model: "Balanced",
          text: "Here's a simple way to price a six-week course:\n\n- **Clay and firing:** about $38 per person\n- **Instructor time:** 12 hours at $35, split across 8 seats, is $52.50 each\n- **Studio overheads:** about $20 per person\n\nThat's roughly **$110 per person** in costs. Studios of your size usually charge **$240 to $280**, which leaves room for the odd empty seat.",
          rating: "up",
        },
      ],
    },
    {
      id: "c4",
      title: "Booking count formula",
      group: "Earlier",
      messages: [
        { id: "c4m1", role: "user", text: "Spreadsheet formula to count bookings in a month?" },
        {
          id: "c4m2",
          role: "assistant",
          model: "Quick",
          text: "Put this in the cell where you want the month's total:\n\n```\n=COUNTIFS(B:B, \">=\"&E1, B:B, \"<\"&EDATE(E1, 1))\n```\n\n- `E1` holds the first day of the month.\n- `EDATE(E1, 1)` is the first day of the next month.",
        },
      ],
    },
  ],
};

type MsgState = "thinking" | "streaming" | "done" | "stopped" | "error";
type Msg = {
  id: string;
  role: "user" | "assistant";
  text: string;
  state?: MsgState;
  rating?: "up" | "down";
  file?: { name: string; size: string };
  model?: string;
  variant?: number;
};
type Chat = { id: string; title: string; group: string; messages: Msg[] };

const P = {
  plus: "M12 5v14M5 12h14",
  search: "M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM20 20l-4-4",
  pencil: "M4 20h4L19 9l-4-4L4 16v4zM14 6l4 4",
  trash: "M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3",
  copy: "M9 9h11v11H9zM5 15H4V4h11v1",
  refresh: "M20 11a8 8 0 1 0-2.3 5.7M20 4v7h-7",
  up: "M7 11v9H4v-9h3zm0 0l4-7a2 2 0 0 1 3 2l-1 4h5a2 2 0 0 1 2 2.3l-1.2 6A2 2 0 0 1 16.8 20H7",
  down: "M7 13V4H4v9h3zm0 0l4 7a2 2 0 0 0 3-2l-1-4h5a2 2 0 0 0 2-2.3l-1.2-6A2 2 0 0 0 16.8 4H7",
  stop: "M7 7h10v10H7z",
  clip: "M21 11l-8.5 8.5a5 5 0 0 1-7-7L14 4a3.5 3.5 0 0 1 5 5l-8.5 8.5a2 2 0 0 1-3-3L15 7",
  x: "M6 6l12 12M18 6L6 18",
  send: "M12 19V5M5 12l7-7 7 7",
  chev: "M6 9l6 6 6-6",
  alert: "M12 8v5M12 16.5v.01M10.3 3.9L2.5 18a2 2 0 0 0 1.7 3h15.6a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z",
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

async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

function pickReply(prompt: string) {
  const p = prompt.toLowerCase();
  const hit = SAMPLE.replies.find((r) => r.keywords.some((k) => p.includes(k)));
  return hit ? hit.texts : [SAMPLE.fallback];
}

function titleFrom(text: string) {
  const t = text.replace(/\s+/g, " ").trim();
  return t.length > 38 ? `${t.slice(0, 38).trimEnd()}…` : t || SAMPLE.newTitle;
}

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/* ── Light formatting: paragraphs, **bold**, `code`, lists, ``` code blocks ``` ── */
function inline(text: string): ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g).map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**") && part.length > 4) return <strong key={i}>{part.slice(2, -2)}</strong>;
    if (part.startsWith("`") && part.endsWith("`") && part.length > 2) return <code key={i}>{part.slice(1, -1)}</code>;
    return part;
  });
}

function CodeBlock({ code, onCopied }: { code: string; onCopied: (ok: boolean) => void }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="fl-aa-code">
      <div className="fl-aa-code__bar">
        <span>{SAMPLE.codeLabel}</span>
        <button
          type="button"
          className="fl-aa-chipbtn"
          onClick={async () => {
            const ok = await copyText(code);
            onCopied(ok);
            if (ok) {
              setCopied(true);
              window.setTimeout(() => setCopied(false), 1600);
            }
          }}
        >
          <Glyph d={copied ? "M5 12l5 5 9-10" : P.copy} />
          {copied ? SAMPLE.copied : SAMPLE.copyCode}
        </button>
      </div>
      <pre>
        <code>{code}</code>
      </pre>
    </div>
  );
}

function Markdown({ text, onCopied }: { text: string; onCopied: (ok: boolean) => void }) {
  const lines = text.split("\n");
  const out: ReactNode[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (line.trim().startsWith("```")) {
      const body: string[] = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith("```")) body.push(lines[i++]);
      i++;
      out.push(<CodeBlock key={out.length} code={body.join("\n")} onCopied={onCopied} />);
    } else if (/^\s*[-*] /.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*[-*] /.test(lines[i])) items.push(lines[i++].replace(/^\s*[-*] /, ""));
      out.push(
        <ul key={out.length}>
          {items.map((t, k) => (
            <li key={k}>{inline(t)}</li>
          ))}
        </ul>,
      );
    } else if (/^\d+\. /.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\d+\. /.test(lines[i])) items.push(lines[i++].replace(/^\d+\. /, ""));
      out.push(
        <ol key={out.length}>
          {items.map((t, k) => (
            <li key={k}>{inline(t)}</li>
          ))}
        </ol>,
      );
    } else if (!line.trim()) {
      i++;
    } else {
      const para: string[] = [];
      while (i < lines.length && lines[i].trim() && !/^\s*([-*] |\d+\. |```)/.test(lines[i])) para.push(lines[i++]);
      out.push(
        <p key={out.length}>
          {para.map((t, k) => (
            <span key={k}>
              {k > 0 && <br />}
              {inline(t)}
            </span>
          ))}
        </p>,
      );
    }
  }
  return <>{out}</>;
}

export default function AppAiChat() {
  const d = SAMPLE;
  const [chats, setChats] = useState<Chat[]>(() => d.chats as unknown as Chat[]);
  const [activeId, setActiveId] = useState<string | null>("c1");
  const [query, setQuery] = useState("");
  const [renaming, setRenaming] = useState<{ id: string; draft: string } | null>(null);
  const [undo, setUndo] = useState<{ chat: Chat; index: number; wasActive: boolean } | null>(null);
  const [draft, setDraft] = useState("");
  const [file, setFile] = useState<{ name: string; size: string } | null>(null);
  const [model, setModel] = useState(d.models[1].id);
  const [busy, setBusy] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [narrow, setNarrow] = useState(false);
  const [drawer, setDrawer] = useState(false);
  const [say, setSay] = useState("");

  const rootRef = useRef<HTMLDivElement>(null);
  const sideRef = useRef<HTMLElement>(null);
  const menuBtn = useRef<HTMLButtonElement>(null);
  const composer = useRef<HTMLTextAreaElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const threadRef = useRef<HTMLDivElement>(null);
  const stick = useRef(true);
  const timer = useRef<number | null>(null);
  const undoTimer = useRef<number | null>(null);
  const stream = useRef<{ chatId: string; msgId: string } | null>(null);
  const itemRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  const active = chats.find((c) => c.id === activeId) ?? null;
  const modelLabel = d.models.find((m) => m.id === model)?.label ?? "";
  const over = draft.length - d.limit;
  const canSend = !busy && over <= 0 && (draft.trim().length > 0 || !!file);

  // Fold to one column when the frame itself is narrow (works inside previews as well as on phones).
  useLayoutEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    setNarrow(el.getBoundingClientRect().width < 760);
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(([entry]) => setNarrow(entry.contentRect.width < 760));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    if (!narrow) setDrawer(false);
  }, [narrow]);

  useEffect(() => {
    if (drawer) sideRef.current?.querySelector<HTMLElement>("button")?.focus();
  }, [drawer]);

  useEffect(
    () => () => {
      if (timer.current) window.clearTimeout(timer.current);
      if (undoTimer.current) window.clearTimeout(undoTimer.current);
    },
    [],
  );

  // Keep the newest words in view unless the reader has scrolled up.
  useEffect(() => {
    const el = threadRef.current;
    if (el && stick.current) el.scrollTop = el.scrollHeight;
  }, [chats, activeId]);

  function announce(text: string) {
    setSay("");
    window.setTimeout(() => setSay(text), 30);
  }

  function patchMsg(chatId: string, msgId: string, patch: Partial<Msg> | ((m: Msg) => Partial<Msg>)) {
    setChats((cs) =>
      cs.map((c) =>
        c.id !== chatId ? c : { ...c, messages: c.messages.map((m) => (m.id !== msgId ? m : { ...m, ...(typeof patch === "function" ? patch(m) : patch) })) },
      ),
    );
  }

  function finish() {
    timer.current = null;
    stream.current = null;
    setBusy(false);
  }

  function generate(chatId: string, prompt: string, opts: { msgId?: string; variant?: number; forceOk?: boolean; fileName?: string }) {
    const texts = pickReply(prompt);
    const variant = opts.variant ?? 0;
    const full = (opts.fileName ? d.fileReply(opts.fileName) : "") + texts[variant % texts.length];
    const fail = !opts.forceOk && d.failWords.some((w) => prompt.toLowerCase().includes(w));
    const msgId = opts.msgId ?? uid("m");
    const fresh: Msg = { id: msgId, role: "assistant", text: "", state: "thinking", model: modelLabel, variant };
    if (opts.msgId) patchMsg(chatId, msgId, { ...fresh, rating: undefined });
    else setChats((cs) => cs.map((c) => (c.id === chatId ? { ...c, messages: [...c.messages, fresh] } : c)));
    stick.current = true;
    stream.current = { chatId, msgId };
    setBusy(true);
    announce(d.thinking);

    timer.current = window.setTimeout(() => {
      if (fail) {
        patchMsg(chatId, msgId, { state: "error" });
        finish();
        announce(d.errorText);
        return;
      }
      if (reducedMotion()) {
        patchMsg(chatId, msgId, { text: full, state: "done" });
        finish();
        announce(d.done);
        return;
      }
      const parts = full.split(/(\s+)/);
      let n = 0;
      const tick = () => {
        n += 2;
        if (n >= parts.length) {
          patchMsg(chatId, msgId, { text: full, state: "done" });
          finish();
          announce(d.done);
          return;
        }
        patchMsg(chatId, msgId, { text: parts.slice(0, n).join(""), state: "streaming" });
        timer.current = window.setTimeout(tick, 24 + Math.random() * 40);
      };
      tick();
    }, 700);
  }

  function stop() {
    if (timer.current) window.clearTimeout(timer.current);
    const s = stream.current;
    if (s) patchMsg(s.chatId, s.msgId, { state: "stopped" });
    finish();
    announce(d.stopped);
    composer.current?.focus();
  }

  function sendText(raw: string) {
    const text = raw.trim();
    if (busy || (!text && !file) || text.length > d.limit) return;
    const prompt = text || (file ? `Here's ${file.name}` : "");
    const userMsg: Msg = { id: uid("m"), role: "user", text: prompt, file: file ?? undefined };
    let chatId = active?.id ?? null;
    if (!chatId) {
      chatId = uid("c");
      const id = chatId;
      setChats((cs) => [{ id, title: titleFrom(prompt), group: d.groups[0], messages: [userMsg] }, ...cs]);
      setActiveId(id);
    } else {
      const id = chatId;
      setChats((cs) =>
        cs.map((c) => (c.id === id ? { ...c, title: c.messages.length === 0 ? titleFrom(prompt) : c.title, messages: [...c.messages, userMsg] } : c)),
      );
    }
    setDraft("");
    setFile(null);
    generate(chatId, prompt, { fileName: file?.name });
  }

  function lastPromptBefore(chat: Chat, msgId: string) {
    const at = chat.messages.findIndex((m) => m.id === msgId);
    for (let i = at - 1; i >= 0; i--) if (chat.messages[i].role === "user") return chat.messages[i];
    return null;
  }

  function regenerate(chat: Chat, m: Msg, retry = false) {
    const prev = lastPromptBefore(chat, m.id);
    if (!prev || busy) return;
    generate(chat.id, prev.text, { msgId: m.id, variant: retry ? m.variant ?? 0 : (m.variant ?? 0) + 1, forceOk: retry, fileName: prev.file?.name });
  }

  function newChat() {
    setDrawer(false);
    setQuery("");
    if (active && active.messages.length === 0) {
      composer.current?.focus();
      return;
    }
    const id = uid("c");
    setChats((cs) => [{ id, title: d.newTitle, group: d.groups[0], messages: [] }, ...cs]);
    setActiveId(id);
    window.setTimeout(() => composer.current?.focus(), 0);
  }

  function openChat(id: string) {
    setActiveId(id);
    stick.current = true;
    if (drawer) {
      setDrawer(false);
      window.setTimeout(() => composer.current?.focus(), 0);
    }
  }

  function closeDrawer() {
    setDrawer(false);
    window.setTimeout(() => menuBtn.current?.focus(), 0);
  }

  function commitRename() {
    if (!renaming) return;
    const title = renaming.draft.trim().slice(0, 60);
    const id = renaming.id;
    if (title) setChats((cs) => cs.map((c) => (c.id === id ? { ...c, title } : c)));
    setRenaming(null);
    window.setTimeout(() => itemRefs.current[id]?.focus(), 0);
  }

  function removeChat(id: string) {
    if (stream.current?.chatId === id) stop();
    const index = chats.findIndex((c) => c.id === id);
    if (index < 0) return;
    const chat = chats[index];
    const rest = chats.filter((c) => c.id !== id);
    setChats(rest);
    if (activeId === id) setActiveId(rest[index]?.id ?? rest[index - 1]?.id ?? null);
    setUndo({ chat, index, wasActive: activeId === id });
    announce(`${d.deleted} “${chat.title}”`);
    if (undoTimer.current) window.clearTimeout(undoTimer.current);
    undoTimer.current = window.setTimeout(() => setUndo(null), 7000);
  }

  function restore() {
    if (!undo) return;
    const { chat, index, wasActive } = undo;
    setChats((cs) => [...cs.slice(0, index), chat, ...cs.slice(index)]);
    if (wasActive) setActiveId(chat.id);
    setUndo(null);
    announce(d.restored);
    window.setTimeout(() => itemRefs.current[chat.id]?.focus(), 0);
  }

  async function copyReply(m: Msg) {
    const ok = await copyText(m.text);
    announce(ok ? d.copied : d.copyFailed);
    if (ok) {
      setCopiedId(m.id);
      window.setTimeout(() => setCopiedId((c) => (c === m.id ? null : c)), 1600);
    }
  }

  function rate(chat: Chat, m: Msg, value: "up" | "down") {
    patchMsg(chat.id, m.id, { rating: m.rating === value ? undefined : value });
    if (m.rating !== value) announce(d.thanks);
  }

  function onComposerKey(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      sendText(draft);
    }
  }

  function onSideKey(e: KeyboardEvent<HTMLElement>) {
    if (!drawer) return;
    if (e.key === "Escape") {
      e.preventDefault();
      closeDrawer();
    } else if (e.key === "Tab" && sideRef.current) {
      const f = sideRef.current.querySelectorAll<HTMLElement>("button, input, [tabindex]:not([tabindex='-1'])");
      if (!f.length) return;
      const first = f[0];
      const last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  }

  const q = query.trim().toLowerCase();
  const found = chats.filter((c) => !q || c.title.toLowerCase().includes(q) || c.messages.some((m) => m.text.toLowerCase().includes(q)));
  const lastAssistantId = active ? [...active.messages].reverse().find((m) => m.role === "assistant")?.id : undefined;

  return (
    <div ref={rootRef} className="fl-aa-frame fl-aa-chat" data-narrow={narrow ? "true" : "false"}>
      {narrow && drawer && <button type="button" className="fl-aa-scrim" aria-label={d.closeHistory} tabIndex={-1} onClick={closeDrawer} />}

      <aside
        ref={sideRef}
        className={`fl-aa-side${drawer ? " is-open" : ""}`}
        aria-label={d.historyLabel}
        role={narrow && drawer ? "dialog" : undefined}
        aria-modal={narrow && drawer ? true : undefined}
        onKeyDown={onSideKey}
      >
        <div className="fl-aa-side__head">
          <span className="fl-aa-brand">
            <span className="fl-aa-bot" aria-hidden="true">
              <Icon name="sparkle" />
            </span>
            {d.product}
          </span>
          {narrow && (
            <button type="button" className="fl-aa-iconbtn" aria-label={d.closeHistory} onClick={closeDrawer}>
              <Glyph d={P.x} />
            </button>
          )}
        </div>
        <button type="button" className="fl-btn fl-btn--primary fl-aa-newchat" onClick={newChat}>
          <Glyph d={P.plus} />
          {d.newChat}
        </button>
        <div className="fl-aa-search">
          <label htmlFor="fl-aa-chat-q" className="fl-sr">
            {d.searchLabel}
          </label>
          <Glyph d={P.search} />
          <input id="fl-aa-chat-q" className="fl-input" type="search" placeholder={d.searchPlaceholder} value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>

        <nav className="fl-aa-hist" aria-label={d.historyLabel}>
          {found.length === 0 ? (
            <p className="fl-aa-hist__empty">{chats.length === 0 ? d.noChats : d.noMatches}</p>
          ) : (
            d.groups.map((g) => {
              const inGroup = found.filter((c) => c.group === g);
              if (!inGroup.length) return null;
              return (
                <div key={g} className="fl-aa-hist__group">
                  <h2 className="fl-aa-hist__label">{g}</h2>
                  <ul>
                    {inGroup.map((c) => (
                      <li key={c.id} className="fl-aa-hist__item" data-current={c.id === activeId ? "true" : undefined}>
                        {renaming?.id === c.id ? (
                          <form
                            className="fl-aa-rename"
                            onSubmit={(e) => {
                              e.preventDefault();
                              commitRename();
                            }}
                          >
                            <label htmlFor={`fl-aa-rn-${c.id}`} className="fl-sr">
                              {d.renameLabel}
                            </label>
                            <input
                              id={`fl-aa-rn-${c.id}`}
                              className="fl-input"
                              autoFocus
                              maxLength={60}
                              value={renaming.draft}
                              onChange={(e) => setRenaming({ id: c.id, draft: e.target.value })}
                              onBlur={commitRename}
                              onKeyDown={(e) => {
                                if (e.key === "Escape") {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  setRenaming(null);
                                  window.setTimeout(() => itemRefs.current[c.id]?.focus(), 0);
                                }
                              }}
                            />
                          </form>
                        ) : (
                          <>
                            <button
                              ref={(el) => {
                                itemRefs.current[c.id] = el;
                              }}
                              type="button"
                              className="fl-aa-hist__open"
                              aria-current={c.id === activeId ? "page" : undefined}
                              onClick={() => openChat(c.id)}
                            >
                              {c.title}
                            </button>
                            <span className="fl-aa-hist__tools">
                              <button type="button" className="fl-aa-iconbtn fl-aa-iconbtn--sm" aria-label={`Rename “${c.title}”`} onClick={() => setRenaming({ id: c.id, draft: c.title })}>
                                <Glyph d={P.pencil} />
                              </button>
                              <button type="button" className="fl-aa-iconbtn fl-aa-iconbtn--sm" aria-label={`Delete “${c.title}”`} onClick={() => removeChat(c.id)}>
                                <Glyph d={P.trash} />
                              </button>
                            </span>
                          </>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })
          )}
        </nav>
      </aside>

      <section className="fl-aa-main" aria-labelledby="fl-aa-chat-title">
        <header className="fl-aa-chathead">
          {narrow && (
            <button ref={menuBtn} type="button" className="fl-aa-iconbtn" aria-label={d.openHistory} aria-expanded={drawer} onClick={() => setDrawer(true)}>
              <Icon name="menu" />
            </button>
          )}
          <h1 id="fl-aa-chat-title" className="fl-aa-chathead__title">
            {active ? active.title : d.newTitle}
          </h1>
          <span className="fl-aa-pill">{modelLabel}</span>
        </header>

        <div
          ref={threadRef}
          className="fl-aa-thread"
          onScroll={(e) => {
            const el = e.currentTarget;
            stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
          }}
        >
          {!active || active.messages.length === 0 ? (
            <div className="fl-aa-welcome">
              <span className="fl-aa-bot fl-aa-bot--lg" aria-hidden="true">
                <Icon name="sparkle" />
              </span>
              <h2 className="fl-title fl-title--md">{d.emptyHeading}</h2>
              <p className="fl-text">{d.emptyText}</p>
              <ul className="fl-aa-suggest">
                {d.suggestions.map((s) => (
                  <li key={s.title}>
                    <button type="button" className="fl-aa-suggest__btn" disabled={busy} onClick={() => sendText(s.text)}>
                      <strong>{s.title}</strong>
                      <span>{s.text}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <ol className="fl-aa-msgs" aria-label="Messages">
              {active.messages.map((m) =>
                m.role === "user" ? (
                  <li key={m.id} className="fl-aa-msg fl-aa-msg--user">
                    <span className="fl-sr">{d.you}:</span>
                    <div className="fl-aa-bubble">
                      {m.file && (
                        <span className="fl-aa-file fl-aa-file--sent">
                          <Glyph d={P.clip} />
                          {m.file.name}
                        </span>
                      )}
                      {m.text}
                    </div>
                  </li>
                ) : (
                  <li key={m.id} className="fl-aa-msg fl-aa-msg--bot">
                    <span className="fl-aa-bot" aria-hidden="true">
                      <Icon name="sparkle" />
                    </span>
                    <div className="fl-aa-msg__body">
                      <p className="fl-aa-msg__who">
                        {d.assistantName}
                        {m.model && <span className="fl-meta"> · {m.model}</span>}
                        {(m.state === "streaming" || m.state === "thinking") && (
                          <span className="fl-aa-live">
                            <span className="fl-aa-dots" aria-hidden="true">
                              <i />
                              <i />
                              <i />
                            </span>
                            {m.state === "thinking" ? d.thinking : d.writing}
                          </span>
                        )}
                      </p>
                      {m.text && (
                        <div className="fl-aa-md">
                          <Markdown text={m.text} onCopied={(ok) => announce(ok ? d.copied : d.copyFailed)} />
                        </div>
                      )}
                      {m.state === "thinking" && (
                        <div className="fl-aa-skeleton" aria-hidden="true">
                          <span />
                          <span />
                          <span />
                        </div>
                      )}
                      {m.state === "error" && (
                        <div className="fl-aa-error">
                          <Glyph d={P.alert} />
                          <p>{d.errorText}</p>
                          <button type="button" className="fl-btn fl-btn--secondary fl-aa-btn-sm" disabled={busy} onClick={() => regenerate(active, m, true)}>
                            <Glyph d={P.refresh} />
                            {d.retry}
                          </button>
                        </div>
                      )}
                      {m.state === "stopped" && <p className="fl-aa-note">{m.text ? d.stopped : d.stoppedEmpty}</p>}
                      {(m.state === undefined || m.state === "done" || m.state === "stopped") && (
                        <div className="fl-aa-actions" role="group" aria-label="Reply actions">
                          {m.text && (
                            <button type="button" className="fl-aa-chipbtn" onClick={() => copyReply(m)}>
                              <Glyph d={copiedId === m.id ? "M5 12l5 5 9-10" : P.copy} />
                              {copiedId === m.id ? d.copied : d.copy}
                            </button>
                          )}
                          {m.id === lastAssistantId && (
                            <button type="button" className="fl-aa-chipbtn" disabled={busy} onClick={() => regenerate(active, m)}>
                              <Glyph d={P.refresh} />
                              {d.regenerate}
                            </button>
                          )}
                          {m.text && (
                            <>
                              <button type="button" className="fl-aa-iconbtn fl-aa-iconbtn--sm" aria-label={d.good} aria-pressed={m.rating === "up"} onClick={() => rate(active, m, "up")}>
                                <Glyph d={P.up} />
                              </button>
                              <button type="button" className="fl-aa-iconbtn fl-aa-iconbtn--sm" aria-label={d.bad} aria-pressed={m.rating === "down"} onClick={() => rate(active, m, "down")}>
                                <Glyph d={P.down} />
                              </button>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  </li>
                ),
              )}
            </ol>
          )}
        </div>

        <form
          className="fl-aa-composer"
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            sendText(draft);
          }}
        >
          <div className="fl-aa-composer__box" data-invalid={over > 0 ? "true" : undefined}>
            {file && (
              <span className="fl-aa-file">
                <Glyph d={P.clip} />
                <span className="fl-aa-file__name">{file.name}</span>
                <span className="fl-meta">{file.size}</span>
                <button type="button" className="fl-aa-iconbtn fl-aa-iconbtn--xs" aria-label={`${d.removeFile} ${file.name}`} onClick={() => setFile(null)}>
                  <Glyph d={P.x} />
                </button>
              </span>
            )}
            <label htmlFor="fl-aa-chat-input" className="fl-sr">
              {d.composerLabel}
            </label>
            <textarea
              ref={composer}
              id="fl-aa-chat-input"
              className="fl-aa-composer__input"
              rows={Math.min(7, Math.max(1, draft.split("\n").length))}
              placeholder={d.composerPlaceholder}
              value={draft}
              aria-invalid={over > 0 || undefined}
              aria-describedby="fl-aa-chat-count fl-aa-chat-hint"
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={onComposerKey}
            />
            <div className="fl-aa-composer__bar">
              <button type="button" className="fl-aa-iconbtn" aria-label={d.attach} title={d.attach} onClick={() => fileInput.current?.click()}>
                <Glyph d={P.clip} />
              </button>
              <input
                ref={fileInput}
                type="file"
                className="fl-sr"
                tabIndex={-1}
                aria-hidden="true"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) setFile({ name: f.name, size: formatSize(f.size) });
                  e.target.value = "";
                  composer.current?.focus();
                }}
              />
              <div className="fl-aa-select">
                <label htmlFor="fl-aa-chat-model" className="fl-sr">
                  {d.modelLabel}
                </label>
                <select id="fl-aa-chat-model" value={model} onChange={(e) => setModel(e.target.value)}>
                  {d.models.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.label}
                    </option>
                  ))}
                </select>
                <Glyph d={P.chev} />
              </div>
              <span id="fl-aa-chat-count" className={`fl-aa-count${over > 0 ? " is-over" : ""}`}>
                <span className="fl-sr">Characters used: </span>
                {draft.length} / {d.limit}
              </span>
              {busy ? (
                <button type="button" className="fl-aa-sendbtn fl-aa-sendbtn--stop" aria-label={d.stop} onClick={stop}>
                  <Glyph d={P.stop} />
                </button>
              ) : (
                <button type="submit" className="fl-aa-sendbtn" aria-label={d.send} disabled={!canSend}>
                  <Glyph d={P.send} />
                </button>
              )}
            </div>
          </div>
          <p id="fl-aa-chat-hint" className={over > 0 ? "fl-aa-hint is-error" : "fl-aa-hint"}>
            {over > 0 ? d.overLimit(over) : file ? d.attachNote : d.disclaimer}
          </p>
        </form>
      </section>

      {undo && (
        <div className="fl-aa-toast">
          <span>
            {d.deleted} <strong>{undo.chat.title}</strong>
          </span>
          <button type="button" className="fl-aa-toast__btn" onClick={restore}>
            {d.undo}
          </button>
        </div>
      )}
      <p className="fl-sr" aria-live="polite">
        {say}
      </p>
    </div>
  );
}
