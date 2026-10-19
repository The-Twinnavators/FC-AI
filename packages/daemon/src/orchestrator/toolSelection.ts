/**
 * The tools a step is shown (8GB GPU profile): what its work and its recovery need, not every tool its role may use.
 * The definitions cost 12,600 characters a request with all 23 coder tools (about 3,000 tokens of a 12k-16k window).
 * The controls are always there (finish, report a blocker, ask for approval), and so are reading, searching, patching,
 * creating and running the project's scripts. Tools a step isn't shown still run if it calls them (the role allows
 * them). A retry on a local model, which runs as the debugger, is shown the same set: with all of them (13,378
 * characters) the retries of Frameproof's Gallery and the calculator's screen were too big to send.
 */
import type { ToolName } from "@flowcode/contracts";

const ALWAYS: ToolName[] = ["read_file", "list_files", "search_code", "apply_patch", "replace_file", "create_file", "run_script", "task_complete", "report_blocked", "request_approval"];

export function stepTools(roleTools: readonly ToolName[], step: { title: string; objective: string; expectedPaths: string[] }, opts: { catalog: boolean; designStep: boolean }): ToolName[] {
  const text = `${step.title}\n${step.objective}`.toLowerCase();
  const paths = step.expectedPaths.join(" ").toLowerCase();
  const want = new Set<ToolName>(ALWAYS);
  if (/\.json\b/.test(paths) || /\b(package\.json|dependenc|json|manifest)\b/.test(text)) want.add("edit_json"), want.add("edit_package_manifest");
  if (/\.ya?ml\b/.test(paths) || /\byaml\b/.test(text)) want.add("edit_yaml");
  if (/\.toml\b/.test(paths) || /\btoml\b/.test(text)) want.add("edit_toml");
  if (/\b(copy|move|rename|delete|remove (the )?files?|leftover|duplicate|reference file|attached)\b/.test(text) || /^clean up/.test(text)) for (const t of ["copy_file", "move_file", "delete_file"] as ToolName[]) want.add(t);
  if (/\b(run a command|command line|npx|npm (?!run)|git |install)\b/.test(text)) want.add("run_command");
  if (opts.designStep || /\b(images?|imagery|photos?|pictures?|hero)\b/.test(text)) want.add("find_image");
  if (opts.catalog) for (const t of ["add_library_piece", "search_catalog", "get_catalog_contract", "propose_layout_change"] as ToolName[]) want.add(t);
  return roleTools.filter((t) => want.has(t));
}
