/** A project's newest screenshot for its card (Dashboard and My Projects), or a placeholder with its initials. */
import { useEffect, useState } from "react";
import { conn } from "../api";

/**
 * The project's newest screenshot (its latest build's desktop shot, or the look check's first screen), cropped to the
 * top of the page. A project with none yet shows a placeholder with its initials.
 */
export function ProjectShot({ projectId, name, version, variant = "thumb" }: { projectId: string; name: string; version: string; variant?: "thumb" | "banner" }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [version]);
  const initials = name.replace(/[^A-Za-z0-9& ]/g, " ").split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]!.toUpperCase()).join("") || "?";
  // A steady tint per project, so placeholders are told apart at a glance.
  const hue = [...projectId].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 360, 7);
  if (failed)
    return (
      <span className={`pcard__shot pcard__shot--empty pcard__shot--${variant}`} style={{ ["--shot-hue" as string]: hue }} aria-hidden="true">
        <span className="pcard__initials">{initials}</span>
        <span className="pcard__noshot">No screenshot yet</span>
      </span>
    );
  return (
    <span className={`pcard__shot pcard__shot--${variant}`} aria-hidden="true">
      <img src={`${conn.base}/projects/${encodeURIComponent(projectId)}/thumbnail?token=${encodeURIComponent(conn.token)}&v=${encodeURIComponent(version)}`} alt="" loading="lazy" decoding="async" onError={() => setFailed(true)} />
    </span>
  );
}
