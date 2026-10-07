/**
 * Export the prototype as a folder you host yourself (D12): FlowCode builds the app (vite build, through its usual
 * command runner and policy) into a scratch folder in the project, copies it to FlowCode's exports folder on this
 * computer, and adds a README on hosting it. Nothing is uploaded anywhere; where it goes next is the person's choice.
 * The apps route with the URL hash, so the folder works on any static host with no server set-up.
 */
import fs from "node:fs";
import path from "node:path";
import type { App } from "../app.js";

const SCRATCH = ".flowcode-export";

export async function exportSite(app: App, projectId: string): Promise<{ folder?: string; files?: number; awaitingApproval?: string; error?: string }> {
  const project = app.store.projects.require(projectId);
  const jail = app.projects.jail(project);
  const pf = app.projects.preflight(project.id);
  if (!pf.hasNodeModules) return { error: "This app's packages aren't installed yet; finish a build first." };
  const res = await app.runner.run({
    jail,
    projectId: project.id,
    runId: `export_${project.id}`,
    phase: "verification",
    argv: ["npx", "vite", "build", "--base", "./", "--outDir", SCRATCH, "--emptyOutDir"],
    reason: "Export the prototype as a folder to host (requested from the builder)",
    preflight: pf,
    overrideNoProgress: true,
  });
  if (res.record.status === "awaiting_approval") return { awaitingApproval: res.record.approvalId };
  const built = path.join(jail.root, SCRATCH);
  if (res.record.status !== "succeeded" || !fs.existsSync(path.join(built, "index.html"))) {
    return { error: `The build for export didn't finish (${res.record.status}). ${(res.record.outputPreview ?? "").split("\n").filter(Boolean).slice(-3).join(" ")}`.trim() };
  }
  const slug = project.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "prototype";
  const stamp = new Date().toISOString().slice(0, 16).replace(/[:T]/g, "-");
  const folder = path.join(app.dataDir, "exports", `${slug}-${stamp}`);
  fs.mkdirSync(path.dirname(folder), { recursive: true });
  fs.cpSync(built, folder, { recursive: true });
  fs.rmSync(built, { recursive: true, force: true });
  fs.writeFileSync(
    path.join(folder, "README.txt"),
    [
      `${project.name}: a clickable prototype exported from FlowCode on ${new Date().toLocaleString()}.`,
      "",
      "HOSTING IT",
      "- Upload this whole folder to any static web host. No server set-up is needed.",
      "- To try it on this computer first, serve the folder (for example: npx serve .) and open the address it prints.",
      "  Opening index.html straight from the folder may not work: browsers block some scripts on file:// pages.",
      "",
      "WHAT PEOPLE WILL SEE",
      "- The data is pretend. Anything a visitor enters is saved only in their own browser.",
      "- Nothing reaches you or anyone else: there are no real accounts, emails, bookings or payments.",
      "- Before sharing it with real customers, read the project's Launch readiness checklist in FlowCode.",
      "",
    ].join("\n"),
  );
  let files = 0;
  const count = (d: string) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) e.isDirectory() ? count(path.join(d, e.name)) : files++;
  };
  count(folder);
  return { folder, files };
}
