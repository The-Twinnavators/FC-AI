/** One icon per knowledge kind (source, note, decision…), with the kind as its accessible name. */
import { BookMarked, Boxes, Code2, FileText, Gavel, Lightbulb, MessageSquareQuote, Sparkles, StickyNote, Tag } from "lucide-react";

const ICONS = { source: FileText, note: StickyNote, decision: Gavel, claim: MessageSquareQuote, architecture: Boxes, skill: Sparkles, prompt: Lightbulb, snippet: Code2, glossary: BookMarked, entity: Tag } as const;

export function KnowledgeKindIcon({ kind, size = 14 }: { kind: string; size?: number }) {
  const Ico = ICONS[kind as keyof typeof ICONS] ?? FileText;
  return (
    <span className={`kn-icon kn-icon--${kind}`} role="img" aria-label={kind} title={kind}>
      <Ico size={size} aria-hidden="true" />
    </span>
  );
}
