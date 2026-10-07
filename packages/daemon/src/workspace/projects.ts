/**
 * Project service (FR-W1). Stores a secure local reference for each workspace (an opaque ref mapped to the
 * canonical path inside the daemon DB), never the absolute path in reports or events.
 */
import fs from "node:fs";
import path from "node:path";
import type { CreateProjectInput, PreflightRecord, Project, ProjectSettings } from "@flowcode/contracts";
import { ProjectSettings as ProjectSettingsSchema } from "@flowcode/contracts";
import type { Store } from "../db/store.js";
import type { EventBus } from "../events/bus.js";
import { PathJail, PolicyError } from "../security/pathJail.js";
import { detectPreflight } from "./preflight.js";
import { newId, nowIso, sha256 } from "../util/ids.js";
import { ensureDir } from "../util/paths.js";

export class ProjectService {
  constructor(
    private store: Store,
    private bus: EventBus,
    private workspacesRoot: string,
  ) {}

  private refs(): Record<string, string> {
    return this.store.getSetting<Record<string, string>>("workspaceRefs", {});
  }

  private saveRef(abs: string): string {
    const canonical = fs.realpathSync.native(path.resolve(abs));
    const ref = `ws_${sha256(canonical.toLowerCase()).slice(0, 16)}`;
    const refs = this.refs();
    refs[ref] = canonical;
    this.store.setSetting("workspaceRefs", refs);
    return ref;
  }

  /** Resolves a workspace ref to its canonical absolute path (daemon-internal only). */
  workspacePath(project: Project): string {
    const p = this.refs()[project.workspaceRef];
    if (!p) throw new PolicyError("Workspace reference is not registered", "workspace_missing");
    return p;
  }

  jail(projectOrId: Project | string): PathJail {
    const project = typeof projectOrId === "string" ? this.store.projects.require(projectOrId) : projectOrId;
    return new PathJail(this.workspacePath(project), project.settings.extraSecretPatterns);
  }

  create(input: CreateProjectInput): Project {
    let abs: string;
    if (input.workspacePath) {
      abs = path.resolve(input.workspacePath);
      if (!fs.existsSync(abs)) {
        if (!input.createWorkspace) throw new PolicyError("Selected folder does not exist", "workspace_missing");
        fs.mkdirSync(abs, { recursive: true });
      }
      if (!fs.statSync(abs).isDirectory()) throw new PolicyError("Selected path is not a folder", "workspace_invalid");
      if (isDangerousRoot(abs)) throw new PolicyError("Refusing to use a drive root, home folder or system folder as a workspace", "workspace_dangerous");
    } else {
      const slug = input.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "project";
      abs = ensureDir(path.join(this.workspacesRoot, `${slug}-${newId("w").slice(2, 8)}`));
    }
    const now = nowIso();
    const project: Project = {
      id: newId("prj"),
      name: input.name,
      workspaceRef: this.saveRef(abs),
      createdAt: now,
      updatedAt: now,
      // New projects start from the default project policy (Application settings), without standing approvals.
      settings: ProjectSettingsSchema.parse({ ...this.store.getSetting<Record<string, unknown>>("projectDefaults", {}), persistentApprovals: [] }),
    };
    this.store.projects.upsert(project);
    return project;
  }

  selectWorkspace(projectId: string, workspacePath: string): Project {
    const project = this.store.projects.require(projectId);
    const abs = path.resolve(workspacePath);
    if (!fs.existsSync(abs) || !fs.statSync(abs).isDirectory()) throw new PolicyError("Selected folder does not exist", "workspace_missing");
    if (isDangerousRoot(abs)) throw new PolicyError("Refusing to use a drive root, home folder or system folder as a workspace", "workspace_dangerous");
    return this.store.projects.upsert({ ...project, workspaceRef: this.saveRef(abs), projectType: undefined, updatedAt: nowIso() });
  }

  updateSettings(projectId: string, patch: Partial<ProjectSettings>): Project {
    const project = this.store.projects.require(projectId);
    const settings = ProjectSettingsSchema.parse({ ...project.settings, ...patch });
    return this.store.projects.upsert({ ...project, settings, updatedAt: nowIso() });
  }

  preflight(projectId: string, runId?: string): PreflightRecord {
    const project = this.store.projects.require(projectId);
    this.bus.emit({ type: "preflight.started", projectId, runId, message: `Preflight started for ${project.name}` });
    const jail = this.jail(project);
    const rec = detectPreflight(projectId, jail.root);
    this.store.preflights.upsert(rec);
    this.store.projects.upsert({ ...project, projectType: rec.projectType, updatedAt: nowIso() });
    const blocked = rec.projectType === "incomplete" || (!rec.manifestValid && rec.manifestErrors.length > 0);
    this.bus.emit({
      type: blocked ? "preflight.blocked" : "preflight.completed",
      projectId,
      runId,
      message: blocked
        ? `Preflight blocked: ${[...rec.manifestErrors, ...rec.missingPrerequisites].join("; ") || "workspace is empty or incomplete"}`
        : `Preflight: ${rec.projectType} (${rec.packageManager}), ${rec.scripts.length} scripts, preview: ${rec.previewStrategy}${rec.missingPrerequisites.length ? `; missing: ${rec.missingPrerequisites.join(", ")}` : ""}`,
      data: { preflightId: rec.id, projectType: rec.projectType, allowedChecks: rec.allowedChecks },
      level: blocked ? "warning" : "info",
    });
    return rec;
  }

  latestPreflight(projectId: string): PreflightRecord | undefined {
    return this.store.preflights.where("project_id = ? ORDER BY created_at DESC LIMIT 1", projectId)[0];
  }
}

/** Drive roots, the home folder and system folders: never a workspace, never a scan target. */
export function isDangerousRoot(abs: string): boolean {
  const norm = path.resolve(abs);
  const parsed = path.parse(norm);
  if (parsed.root === norm) return true;
  const home = process.env.USERPROFILE ?? process.env.HOME;
  if (home && path.resolve(home).toLowerCase() === norm.toLowerCase()) return true;
  const sys = [process.env.SystemRoot, process.env.ProgramFiles, process.env["ProgramFiles(x86)"], "/usr", "/etc", "/bin", "/System", "/Library"].filter(Boolean) as string[];
  return sys.some((s) => norm.toLowerCase() === path.resolve(s).toLowerCase() || norm.toLowerCase().startsWith(path.resolve(s).toLowerCase() + path.sep));
}
