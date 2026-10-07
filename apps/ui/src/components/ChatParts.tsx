/**
 * Shared pieces for FlowCode's chats (the builder chat and the Copilot), following common AI-chat practice:
 *  - ChatText: an answer's plain text shown with structure: paragraphs, "Heading:" lines, bullet and numbered lists,
 *    `code`. No HTML is ever interpreted.
 *  - useStickyScroll: follow new messages only while you're at the bottom; scrolled up, you stay put and get a
 *    "Jump to latest" button instead of being pulled down.
 *  - ChatAuthor: who is speaking (avatar, name, a detail such as the model) and when.
 */
import { useCallback, useEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import { ArrowDown } from "lucide-react";

/** Inline `code` inside a line. */
function inline(text: string): ReactNode[] {
  return text.split(/(`[^`]+`)/g).map((part, i) => (part.startsWith("`") && part.endsWith("`") && part.length > 2 ? <code key={i}>{part.slice(1, -1)}</code> : <span key={i}>{part}</span>));
}

export function ChatText({ text }: { text: string }) {
  const blocks: ReactNode[] = [];
  const lines = text.replace(/\r/g, "").split("\n");
  let i = 0;
  let k = 0;
  while (i < lines.length) {
    const line = lines[i]!;
    if (!line.trim()) {
      i++;
      continue;
    }
    // Bullet list.
    if (/^\s*[-*•]\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*[-*•]\s+/.test(lines[i]!)) items.push(lines[i++]!.replace(/^\s*[-*•]\s+/, ""));
      blocks.push(
        <ul key={k++} className="ctext__ul">
          {items.map((t, j) => (
            <li key={j}>{inline(t)}</li>
          ))}
        </ul>,
      );
      continue;
    }
    // Numbered list.
    if (/^\s*\d+[.)]\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*\d+[.)]\s+/.test(lines[i]!)) items.push(lines[i++]!.replace(/^\s*\d+[.)]\s+/, ""));
      blocks.push(
        <ol key={k++} className="ctext__ol">
          {items.map((t, j) => (
            <li key={j}>{inline(t)}</li>
          ))}
        </ol>,
      );
      continue;
    }
    // A short line ending in ":" before a list or more text reads as a small heading ("What changed:").
    if (/^[^.!?]{2,48}:$/.test(line.trim())) {
      blocks.push(
        <h5 key={k++} className="ctext__h">
          {line.trim().slice(0, -1)}
        </h5>,
      );
      i++;
      continue;
    }
    // A paragraph: consecutive plain lines.
    const para: string[] = [];
    while (i < lines.length && lines[i]!.trim() && !/^\s*([-*•]|\d+[.)])\s+/.test(lines[i]!) && !/^[^.!?]{2,48}:$/.test(lines[i]!.trim())) para.push(lines[i++]!);
    blocks.push(
      <p key={k++} className="ctext__p">
        {para.map((p, j) => (
          <span key={j}>
            {j ? <br /> : null}
            {inline(p)}
          </span>
        ))}
      </p>,
    );
  }
  return <div className="ctext">{blocks}</div>;
}

/** Follows new content only while the list is scrolled to (near) the bottom. */
export function useStickyScroll(ref: RefObject<HTMLElement | null>, deps: unknown[]) {
  const atBottom = useRef(true);
  const [away, setAway] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const onScroll = () => {
      const near = el.scrollHeight - el.scrollTop - el.clientHeight < 100;
      atBottom.current = near;
      setAway(!near);
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, [ref]);
  const jump = useCallback(() => {
    const el = ref.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [ref]);
  useEffect(() => {
    if (atBottom.current) jump();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return { away, jump };
}

export function JumpToLatest({ show, onClick }: { show: boolean; onClick: () => void }) {
  if (!show) return null;
  return (
    <button type="button" className="chat-jump" onClick={onClick}>
      <ArrowDown size={14} aria-hidden="true" /> Jump to latest
    </button>
  );
}

/** Who is speaking, with an optional detail (the model, the build's status) and when. */
export function ChatAuthor({ avatar, name, detail, when }: { avatar: ReactNode; name: string; detail?: ReactNode; when?: string }) {
  return (
    <div className="chat-author">
      <span className="chat-author__avatar" aria-hidden="true">
        {avatar}
      </span>
      <strong className="chat-author__name">{name}</strong>
      {detail ? <span className="chat-author__detail">{detail}</span> : null}
      {when ? <span className="chat-author__when">{when}</span> : null}
    </div>
  );
}
