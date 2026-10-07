/**
 * Protected-file registry and validators (FR-F3). Protected files are validated before and after
 * every change; invalid package manifests are rejected before they reach disk.
 */
import YAML from "yaml";
import { parse as parseToml } from "smol-toml";

export interface ProtectedPolicy {
  id: string;
  match: RegExp;
  description: string;
  /** Tools allowed to modify the file. Whole-file replace is never allowed for these. */
  allowedTools: string[];
  /** Mutations always require explicit approval. */
  requiresApproval: boolean;
  validate?: (content: string, relPath: string) => string[];
}

export function validateJson(content: string): string[] {
  try {
    JSON.parse(stripJsonComments(content));
    return [];
  } catch (e) {
    return [`Invalid JSON: ${(e as Error).message}`];
  }
}

/** tsconfig-style JSONC: strip comments and trailing commas before parsing. */
export function stripJsonComments(s: string): string {
  let out = "";
  let inStr = false;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (inStr) {
      out += ch;
      if (ch === "\\") {
        out += s[++i] ?? "";
      } else if (ch === '"') inStr = false;
      continue;
    }
    if (ch === '"') {
      inStr = true;
      out += ch;
    } else if (ch === "/" && s[i + 1] === "/") {
      while (i < s.length && s[i] !== "\n") i++;
      out += "\n";
    } else if (ch === "/" && s[i + 1] === "*") {
      i += 2;
      while (i < s.length && !(s[i] === "*" && s[i + 1] === "/")) i++;
      i++;
    } else out += ch;
  }
  return out.replace(/,(\s*[}\]])/g, "$1");
}

const NPM_NAME = /^(?:@[a-z0-9-~][a-z0-9-._~]*\/)?[a-z0-9-~][a-z0-9-._~]*$/;
const VERSION_SPEC =
  /^(?:\*|latest|next|beta|alpha|canary|x|[~^<>=]*\s*v?\d+(?:\.(?:\d+|x|\*))?(?:\.(?:\d+|x|\*))?(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?(?:\s*(?:\|\||-|\s)\s*[~^<>=]*\s*v?\d+(?:\.(?:\d+|x|\*))?(?:\.(?:\d+|x|\*))?(?:-[0-9A-Za-z.-]+)?)*|workspace:.+|file:.+|link:.+|npm:(?:@[a-z0-9-~][a-z0-9-._~]*\/)?[a-z0-9-~][a-z0-9-._~]*@.+|(?:git\+)?(?:https?|ssh|git):\/\/.+|github:.+|[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+(?:#.+)?)$/;

/** Validates a package.json document (structure, names, version specs, scripts). */
export function validatePackageManifest(content: string): string[] {
  const errors: string[] = [];
  let pkg: unknown;
  try {
    pkg = JSON.parse(content);
  } catch (e) {
    return [`package.json is not valid JSON: ${(e as Error).message}`];
  }
  if (!pkg || typeof pkg !== "object" || Array.isArray(pkg)) return ["package.json must be a JSON object"];
  const o = pkg as Record<string, unknown>;
  if (o.name !== undefined && (typeof o.name !== "string" || !NPM_NAME.test(o.name) || o.name.length > 214)) errors.push(`Invalid package name: ${String(o.name)}`);
  if (o.version !== undefined && (typeof o.version !== "string" || !/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/.test(o.version)))
    errors.push(`Invalid version: ${String(o.version)}`);
  if (o.type !== undefined && o.type !== "module" && o.type !== "commonjs") errors.push(`Invalid "type": ${String(o.type)}`);
  if (o.private !== undefined && typeof o.private !== "boolean") errors.push(`"private" must be boolean`);
  if (o.scripts !== undefined) {
    if (!isStringMap(o.scripts)) errors.push(`"scripts" must map names to command strings`);
  }
  const seen = new Map<string, string>();
  for (const field of ["dependencies", "devDependencies", "peerDependencies", "optionalDependencies"]) {
    const deps = o[field];
    if (deps === undefined) continue;
    if (!isStringMap(deps)) {
      errors.push(`"${field}" must map package names to version strings`);
      continue;
    }
    for (const [name, spec] of Object.entries(deps)) {
      if (!NPM_NAME.test(name)) errors.push(`${field}: invalid package name "${name}"`);
      if (!VERSION_SPEC.test(spec.trim())) errors.push(`${field}: invalid version spec for ${name}: "${spec}"`);
      if (field !== "peerDependencies" && field !== "optionalDependencies") {
        const prev = seen.get(name);
        if (prev && prev !== field) errors.push(`${name} is declared in both ${prev} and ${field}`);
        seen.set(name, field);
      }
    }
  }
  if (o.workspaces !== undefined && !Array.isArray(o.workspaces) && typeof o.workspaces !== "object") errors.push(`"workspaces" must be an array or object`);
  return errors;
}

function isStringMap(v: unknown): v is Record<string, string> {
  return !!v && typeof v === "object" && !Array.isArray(v) && Object.values(v).every((x) => typeof x === "string");
}

export const PROTECTED_POLICIES: ProtectedPolicy[] = [
  {
    id: "package_manifest",
    match: /(^|\/)package\.json$/,
    description: "Package manifest — semantic edits only, validated before write",
    allowedTools: ["edit_package_manifest", "create_file"],
    requiresApproval: false,
    validate: validatePackageManifest,
  },
  {
    id: "lockfile",
    match: /(^|\/)(package-lock\.json|npm-shrinkwrap\.json|pnpm-lock\.yaml|yarn\.lock|bun\.lockb?|poetry\.lock|Pipfile\.lock|Cargo\.lock)$/,
    description: "Lockfiles are only changed by the package manager through approved installs",
    allowedTools: [],
    requiresApproval: true,
  },
  {
    id: "typescript_config",
    match: /(^|\/)(tsconfig|jsconfig)(\.[\w-]+)?\.json$/,
    description: "TypeScript config — structured JSON edits only",
    allowedTools: ["edit_json", "create_file"],
    requiresApproval: false,
    validate: validateJson,
  },
  {
    id: "build_config",
    match: /(^|\/)(vite|vitest|next|webpack|rollup|esbuild|babel|postcss|tailwind|svelte|astro|nuxt|electron-builder|playwright|jest|eslint)\.config\.[cm]?[jt]s$|(^|\/)\.(babelrc|eslintrc(\.json)?|prettierrc(\.json)?)$/,
    description: "Build/tool configuration — patch edits require approval",
    allowedTools: ["apply_patch", "create_file", "edit_json"],
    requiresApproval: true,
  },
  {
    id: "ci_workflow",
    match: /(^|\/)\.github\/workflows\/.+\.ya?ml$|(^|\/)\.gitlab-ci\.yml$|(^|\/)azure-pipelines\.yml$/,
    description: "CI workflows — structured YAML edits with approval",
    allowedTools: ["edit_yaml", "create_file"],
    requiresApproval: true,
    validate: (c) => {
      try {
        YAML.parse(c);
        return [];
      } catch (e) {
        return [`Invalid YAML: ${(e as Error).message}`];
      }
    },
  },
  {
    id: "docker",
    match: /(^|\/)(Dockerfile(\..+)?|docker-compose(\.[\w-]+)?\.ya?ml|compose\.ya?ml|\.dockerignore)$/,
    description: "Container definitions — require approval",
    allowedTools: ["apply_patch", "create_file", "edit_yaml"],
    requiresApproval: true,
  },
  {
    id: "provider_config",
    match: /(^|\/)\.flowcode\/(providers|policy)\.json$/,
    description: "FlowCode provider/policy configuration — never edited by agents",
    allowedTools: [],
    requiresApproval: true,
    validate: validateJson,
  },
  {
    id: "pyproject",
    match: /(^|\/)pyproject\.toml$/,
    description: "Python project manifest — structured TOML edits only",
    allowedTools: ["edit_toml", "create_file"],
    requiresApproval: false,
    validate: (c) => {
      try {
        parseToml(c);
        return [];
      } catch (e) {
        return [`Invalid TOML: ${(e as Error).message}`];
      }
    },
  },
];

export function protectedPolicyFor(relPath: string): ProtectedPolicy | undefined {
  const p = relPath.replace(/\\/g, "/");
  return PROTECTED_POLICIES.find((x) => x.match.test(p));
}
