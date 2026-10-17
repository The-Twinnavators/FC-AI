/**
 * A split step's edits, kept across the split as one provisional set instead of being undone (Clean Cart slice eval 1:
 * the debugger's valid hero rewrite was thrown away when the design step split). The set has a boundary: a checkpoint,
 * the files and their snapshots (the baseline to go back to), the diff and the diagnostics it ended with (an
 * artifact), and the parts that inherit it. It is not accepted because the step split: only when every part is
 * verified. If the parts fail, or a step before it starts over, the whole set goes back through the same coherent undo
 * as any unaccepted step (orchestrator.safeUndo), or waits for the person when that isn't safe.
 */
export interface ProvisionalSet {
  parentId: string;
  parentTitle: string;
  files: string[];
  checkpointId: string;
  artifactId: string;
  /** The parts that inherit it, in order: they own it together until all are verified. */
  children: string[];
  state: "provisional" | "accepted" | "restored" | "reconcile";
  reason?: string;
  at: string;
}

export const provisionalKey = (parentId: string) => `provisional:${parentId}`;
/** On a part: the split step whose provisional set it inherited. */
export const provisionalFromKey = (childId: string) => `provisionalFrom:${childId}`;

/** What a part is told about the work it inherits. */
export function inheritedNote(set: ProvisionalSet): string {
  return `Inherited from "${set.parentTitle}" (split): its changes to ${set.files.join(", ")} are in place but not accepted yet (diff in artifact ${set.artifactId}). Build on what is right in them and correct what isn't; they are accepted only when every part of the split passes its checks.`;
}
