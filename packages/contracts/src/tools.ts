/**
 * Governed tool schemas (FR-F1, FR-A4). Model tool calls are validated against these before dispatch;
 * the same definitions are converted to JSON Schema and offered to providers as native tools.
 */
import { z } from "zod";

const relPath = z.string().min(1).max(1024).describe("Workspace-relative path using forward slashes");

export const ToolArgs = {
  list_files: z.object({ path: z.string().default(".").describe("Workspace-relative directory"), depth: z.number().int().min(1).max(6).default(3) }),
  search_code: z.object({ query: z.string().min(1).max(500), glob: z.string().optional() }),
  read_file: z.object({
    path: relPath,
    from: z.number().int().min(1).optional().describe("First line to read (1-based); with \"to\", reads only those lines, numbered"),
    to: z.number().int().min(1).optional().describe("Last line to read (inclusive)"),
  }),
  create_file: z.object({ path: relPath, content: z.string().max(1_000_000) }),
  apply_patch: z.object({
    path: relPath,
    edits: z
      .array(
        z.object({
          find: z.string().min(1).describe("Exact existing text, copied from the file"),
          replace: z.string(),
          line: z.number().int().min(1).optional().describe("Line number where this find text starts (from read_file); picks the right one when the text occurs more than once"),
        }),
      )
      .min(1)
      .max(50),
  }),
  edit_json: z.object({
    path: relPath,
    operations: z
      .array(
        z.object({
          op: z.enum(["set", "delete"]),
          pointer: z.string().describe("JSON pointer such as /compilerOptions/strict"),
          value: z.unknown().optional(),
        }),
      )
      .min(1),
  }),
  edit_yaml: z.object({
    path: relPath,
    operations: z.array(z.object({ op: z.enum(["set", "delete"]), pointer: z.string(), value: z.unknown().optional() })).min(1),
  }),
  edit_toml: z.object({
    path: relPath,
    operations: z.array(z.object({ op: z.enum(["set", "delete"]), pointer: z.string(), value: z.unknown().optional() })).min(1),
  }),
  edit_package_manifest: z.object({
    operations: z
      .array(
        z.discriminatedUnion("op", [
          z.object({ op: z.literal("add_dependency"), name: z.string(), version: z.string(), dev: z.boolean().default(false) }),
          z.object({ op: z.literal("remove_dependency"), name: z.string() }),
          z.object({ op: z.literal("set_script"), name: z.string(), command: z.string() }),
          z.object({ op: z.literal("remove_script"), name: z.string() }),
          z.object({ op: z.literal("set_field"), field: z.enum(["name", "version", "description", "private", "type"]), value: z.unknown() }),
        ]),
      )
      .min(1),
  }),
  replace_file: z.object({ path: relPath, content: z.string().max(1_000_000), reason: z.string().min(1) }),
  copy_file: z.object({ from: relPath, to: relPath }),
  move_file: z.object({ from: relPath, to: relPath }),
  delete_file: z.object({ path: relPath, reason: z.string().min(1) }),
  run_command: z.object({
    argv: z.array(z.string().max(4000)).min(1).max(64).describe("Program and arguments; no shell syntax"),
    reason: z.string().min(1),
  }),
  run_script: z.object({ script: z.string().min(1), reason: z.string().min(1) }),
  find_image: z.object({
    query: z.string().min(2).max(120).describe("What the photo shows, in plain words (e.g. \"fresh vegetables at a market\")"),
    name: z.string().max(60).optional().describe("File name to save it as, e.g. hero-market"),
    orientation: z.enum(["landscape", "portrait", "square"]).optional(),
  }),
  add_library_piece: z.object({
    piece: z.string().min(2).max(80).describe("A catalog ID from the FlowCode catalog in your instructions (c.button, p.data-table, b.hero-split, t.home-saas), or a library piece's id (hero-split)"),
    page: z.string().max(60).optional().describe("The screen it is for, as the plan names it (e.g. Home)"),
    section: z.string().max(80).optional().describe("The section of that screen it builds, as the brief names it"),
    mode: z.enum(["whole", "adapt", "compose"]).optional().describe("whole: used as it is; adapt: reshaped for this page; compose: a component put together with others"),
    why: z.string().max(240).optional().describe("Why this part fits that section"),
  }),
  search_catalog: z.object({
    query: z.string().min(2).max(200).describe("The goal, page responsibility or behaviour to find a part for (e.g. \"compare plans before choosing\")"),
    level: z.enum(["component", "pattern", "block", "template"]).optional(),
    limit: z.number().int().min(1).max(20).optional(),
  }),
  get_catalog_contract: z.object({
    id: z.string().min(2).max(80).describe("A catalog ID (c.button, c.button.secondary, c.tabs@folder, p.data-table)"),
  }),
  propose_layout_change: z.object({
    page: z.string().min(1).max(60).describe("The page, as the plan names it"),
    section: z.string().min(1).max(80).describe("The planned section, as the page plan names it (or a new one, for add)"),
    change: z.enum(["remove", "replace", "add"]),
    replacement: z.string().max(80).optional().describe("replace/add: the catalog ID used instead"),
    why: z.string().min(12).max(400).describe("Why the planned structure doesn't work here, and what it means for the person using the page"),
  }),
  request_approval: z.object({ action: z.string(), reason: z.string(), risk: z.enum(["low", "medium", "high"]) }),
  report_blocked: z.object({ reason: z.string(), nextAction: z.string() }),
  task_complete: z.object({ summary: z.string(), changedPaths: z.array(z.string()).default([]) }),
} as const;

export type ToolName = keyof typeof ToolArgs;
export const TOOL_NAMES = Object.keys(ToolArgs) as ToolName[];

export const TOOL_DESCRIPTIONS: Record<ToolName, string> = {
  list_files: "List files under a workspace directory.",
  search_code: "Full-text search the workspace. Returns matching lines with paths.",
  read_file: "Read a workspace file. Secret files are denied. To read part of a long file with line numbers, give \"from\" and \"to\" (line numbers): use this instead of sed, head or a script.",
  create_file: "Create a NEW file. Fails if the path already exists.",
  apply_patch: "Edit an existing file by find/replace pairs copied from read_file. If a find text occurs more than once, add its starting line number as \"line\". The whole patch fails atomically if any edit can't be placed.",
  edit_json: "Structured JSON edit via JSON pointers. Result must parse.",
  edit_yaml: "Structured YAML edit via JSON pointers. Result must parse.",
  edit_toml: "Structured TOML edit via JSON pointers. Result must parse.",
  edit_package_manifest: "Semantic package.json edits (dependencies/scripts/fields only). Validated before write.",
  replace_file: "Replace an entire existing file with complete new content (give a reason). Use after apply_patch misses twice or when a file is structurally broken. Never for protected files such as package.json.",
  copy_file: "Copy a file to another path, creating or overwriting the destination. Use this to put an attached file (spec/attachments/...) into the project instead of retyping its content.",
  move_file: "Move/rename a workspace file.",
  delete_file: "Delete a workspace file (snapshot kept). Requires approval.",
  run_command: "Run a program inside the workspace with argv (no shell). Governed by policy; may require approval.",
  run_script: "Run a package.json script that preflight classified.",
  find_image: "Find a real, openly licensed photo (CC0, public domain or CC BY, from Openverse) and save it into the app as public/images/<name>.jpg, with its credit in src/content/image-credits.json. Use it for hero images, cards and product shots instead of grey boxes; use lucide-react for icons and inline SVG for illustrations.",
  search_catalog: "Search FlowCode's catalog of page templates, page blocks, patterns and components by a goal, a page's responsibility or a behaviour. Answers with the best catalog IDs; read one's contract with get_catalog_contract before using it.",
  propose_layout_change: "The page plans are locked: every planned section is built with its planned part. When one truly doesn't fit, record the change here (remove a section, replace its part with another catalog ID, or add one) with the reason; the person sees it at review. Leaving a planned section out without this sends the step back.",
  get_catalog_contract: "A catalog part's full contract: what it is for, how to use it (props and slots), its variants and versions with their looks, what it is built from and what uses it, the tokens that style it, the file that implements it and its import line. Read it before placing or adapting a part. An ID that isn't in the catalog is an error, never a guess.",
  add_library_piece: "Put a piece of FlowCode's catalog into the app: copies it and the pieces it is built from into src/sections/ and wires their styles. It answers with the import line to use (e.g. import { Button } from \"../sections/ButtonsVariants\"). Use it before writing a button, field, card, table, dialog or page section by hand. Name the page and section it builds (and why it fits) so the build's composition manifest records it.",
  request_approval: "Ask the user for approval of a consequential action you cannot perform yet.",
  report_blocked: "Report that the task cannot proceed, with reason and suggested next action.",
  task_complete: "Declare that you believe the task's acceptance criteria are met. The runtime verifies independently.",
};

/** Tools each role may use (PRD §10.1 default permissions). */
export const ROLE_TOOLS: Record<string, ToolName[]> = {
  planner: ["list_files", "search_code", "read_file", "search_catalog", "get_catalog_contract"],
  repository_analyst: ["list_files", "search_code", "read_file"],
  researcher: ["list_files", "search_code", "read_file"],
  coder: [
    "list_files",
    "search_code",
    "read_file",
    "create_file",
    "apply_patch",
    "edit_json",
    "edit_yaml",
    "edit_toml",
    "edit_package_manifest",
    "replace_file",
    "copy_file",
    "move_file",
    "delete_file",
    "run_command",
    "run_script",
    "find_image",
    "add_library_piece",
    "search_catalog",
    "get_catalog_contract",
    "propose_layout_change",
    "request_approval",
    "report_blocked",
    "task_complete",
  ],
  debugger: ["list_files", "search_code", "read_file", "create_file", "apply_patch", "replace_file", "copy_file", "add_library_piece", "search_catalog", "get_catalog_contract", "propose_layout_change", "edit_json", "edit_package_manifest", "run_script", "run_command", "request_approval", "report_blocked", "task_complete"],
  reviewer: ["list_files", "search_code", "read_file", "search_catalog", "get_catalog_contract"],
  designer: ["list_files", "search_code", "read_file", "search_catalog", "get_catalog_contract"],
  critic: ["read_file", "search_catalog", "get_catalog_contract"],
  security_qa: ["list_files", "search_code", "read_file"],
  accessibility_qa: ["list_files", "search_code", "read_file"],
  compliance_triage: ["list_files", "search_code", "read_file"],
  documenter: ["list_files", "search_code", "read_file", "create_file"],
};

export const MUTATING_TOOLS: ReadonlySet<ToolName> = new Set([
  "create_file",
  "apply_patch",
  "edit_json",
  "edit_yaml",
  "edit_toml",
  "edit_package_manifest",
  "replace_file",
  "copy_file",
  "move_file",
  "delete_file",
]);
