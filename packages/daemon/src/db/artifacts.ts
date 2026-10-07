/** Local content-addressed object store for snapshots, screenshots, reports and logs (ADR-0004). */
import fs from "node:fs";
import path from "node:path";
import { sha256, newId, nowIso } from "../util/ids.js";
import { ensureDir } from "../util/paths.js";
import type { ArtifactRecord, Store } from "./store.js";

export class ObjectStore {
  constructor(readonly root: string) {
    ensureDir(root);
  }

  put(content: Buffer | string): string {
    const buf = typeof content === "string" ? Buffer.from(content, "utf8") : content;
    const hash = sha256(buf);
    const file = this.pathFor(hash);
    if (!fs.existsSync(file)) {
      ensureDir(path.dirname(file));
      const tmp = `${file}.${process.pid}.tmp`;
      fs.writeFileSync(tmp, buf);
      fs.renameSync(tmp, file);
    }
    return hash;
  }

  get(hash: string): Buffer {
    if (!/^[a-f0-9]{64}$/.test(hash)) throw new Error("Invalid content ref");
    return fs.readFileSync(this.pathFor(hash));
  }

  has(hash: string): boolean {
    return /^[a-f0-9]{64}$/.test(hash) && fs.existsSync(this.pathFor(hash));
  }

  pathFor(hash: string): string {
    return path.join(this.root, hash.slice(0, 2), hash);
  }
}

export class ArtifactService {
  constructor(
    private store: Store,
    readonly objects: ObjectStore,
  ) {}

  save(input: Omit<ArtifactRecord, "id" | "contentRef" | "bytes" | "createdAt"> & { content: Buffer | string }): ArtifactRecord {
    const buf = typeof input.content === "string" ? Buffer.from(input.content, "utf8") : input.content;
    const contentRef = this.objects.put(buf);
    const rec: ArtifactRecord = {
      id: newId("art"),
      runId: input.runId,
      kind: input.kind,
      label: input.label,
      mime: input.mime,
      meta: input.meta,
      contentRef,
      bytes: buf.length,
      createdAt: nowIso(),
    };
    return this.store.artifacts.upsert(rec);
  }

  read(id: string): { record: ArtifactRecord; content: Buffer } {
    const record = this.store.artifacts.require(id);
    return { record, content: this.objects.get(record.contentRef) };
  }

  forRun(runId: string): ArtifactRecord[] {
    return this.store.artifacts.where("run_id = ? ORDER BY created_at ASC", runId);
  }
}
