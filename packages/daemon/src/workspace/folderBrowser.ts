/**
 * Choosing a folder by browsing, not typing (after FlowAgent's FlowReport): a typed path is easy to get wrong, and a
 * report about the wrong folder reads exactly like one about the right one. The browser lists folder names and
 * nothing else: it never opens a file, reports a size or descends on its own. Whether a folder looks like a repository
 * (it has a manifest or .git) is a hint for the picker, not a rule.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

export interface BrowseEntry {
  name: string;
  path: string;
  looksLikeRepository: boolean;
}

/** Folders nobody picks a repository from, left out of the list. */
const BORING = new Set(["node_modules", "$RECYCLE.BIN", "System Volume Information", "AppData", "Windows", "Program Files", "Program Files (x86)", "ProgramData"]);
const MANIFESTS = ["package.json", ".git", "go.mod", "pyproject.toml", "Cargo.toml", "pom.xml", "composer.json", "Gemfile"];

/** One folder's sub-folders, sorted by name, and the folder above it. Starts at the home folder. */
export function browseFolder(target?: string): { path: string; parent: string | null; entries: BrowseEntry[] } {
  const here = path.resolve(target && path.isAbsolute(target) ? target : os.homedir());
  if (!fs.existsSync(here)) throw Object.assign(new Error("That folder no longer exists."), { status: 404 });
  if (!fs.statSync(here).isDirectory()) throw Object.assign(new Error("That isn't a folder."), { status: 400 });
  const entries: BrowseEntry[] = [];
  for (const name of fs.readdirSync(here)) {
    if (name.startsWith(".") || BORING.has(name)) continue;
    const full = path.join(here, name);
    try {
      // A folder that can't be read isn't shown, rather than shown and then failing on click.
      if (!fs.statSync(full).isDirectory()) continue;
    } catch {
      continue;
    }
    entries.push({ name, path: full, looksLikeRepository: MANIFESTS.some((m) => fs.existsSync(path.join(full, m))) });
  }
  entries.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));
  const up = path.dirname(here);
  return { path: here, parent: up === here ? null : up, entries };
}

/** Where browsing can start: the home folder, and each drive (Windows) or the root (elsewhere). */
export function folderRoots(): Array<{ name: string; path: string }> {
  const roots = [{ name: "Home", path: os.homedir() }];
  if (process.platform === "win32") {
    for (const letter of "CDEFGHIJ") {
      const drive = `${letter}:\\`;
      if (fs.existsSync(drive)) roots.push({ name: `${letter}:`, path: drive });
    }
  } else roots.push({ name: "/", path: "/" });
  return roots;
}
