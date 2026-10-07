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
  request_approval: "Ask the user for approval of a consequential action you cannot perform yet.",
  report_blocked: "Report that the task cannot proceed, with reason and suggested next action.",
  task_complete: "Declare that you believe the task's acceptance criteria are met. The runtime verifies independently.",
};

/** Tools each role may use (PRD §10.1 default permissions). */
export const ROLE_TOOLS: Record<string, ToolName[]> = {
  planner: ["list_files", "search_code", "read_file"],
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
    "request_approval",
    "report_blocked",
    "task_complete",
  ],
  debugger: ["list_files", "search_code", "read_file", "create_file", "apply_patch", "replace_file", "copy_file", "edit_json", "edit_package_manifest", "run_script", "run_command", "request_approval", "report_blocked", "task_complete"],
  reviewer: ["list_files", "search_code", "read_file"],
  designer: ["list_files", "search_code", "read_file"],
  critic: ["read_file"],
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
