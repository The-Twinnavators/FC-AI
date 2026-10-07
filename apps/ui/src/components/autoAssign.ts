/**
 * Auto-assign: picks a local model for every agent role from what's installed and what has passed the capability lab.
 * - Coder & Debugger: the largest model that passed the lab (required for tool-using roles).
 * - Planner and reviewing/researching roles: the same proven model (best reasoning available).
 * - Critic: a vision model (it has to look at screenshots).
 * - Documenter (also Copilot): a smaller general model for speed, if one exists.
 * Embedding models and very small models are never picked.
 */
export interface InstalledModel {
  name: string;
  parameterSize?: string;
  family?: string;
}
export interface Plan {
  role: string;
  from?: string;
  to: string;
  why: string;
}

const ROLES = ["planner", "coder", "debugger", "repository_analyst", "researcher", "reviewer", "designer", "critic", "security_qa", "accessibility_qa", "compliance_triage", "documenter"];
const params = (m: InstalledModel) => {
  const p = /([\d.]+)\s*([BM])/i.exec(m.parameterSize ?? "") ?? /:(\d+(?:\.\d+)?)b/i.exec(m.name);
  if (!p) return 0;
  return Number(p[1]) * (p[2]?.toUpperCase() === "M" ? 0.001 : 1);
};
const isEmbed = (m: InstalledModel) => /embed|bge|e5-|minilm/i.test(m.name) || /bert/i.test(m.family ?? "");
const isVision = (m: InstalledModel) => /vl|vision|llava|moondream|minicpm-v|bakllava/i.test(m.name) || /vl$/i.test(m.family ?? "");

export function planAutoAssign(models: InstalledModel[], passed: Set<string>, current: Record<string, string | undefined>): { plan: Plan[]; warnings: string[] } {
  const warnings: string[] = [];
  const chat = models.filter((m) => !isEmbed(m));
  const general = chat.filter((m) => !isVision(m) && params(m) >= 3);
  const proven = general.filter((m) => passed.has(m.name)).sort((a, b) => params(b) - params(a));
  // Laptop-friendly ceiling for reasoning roles when nothing passed the lab.
  const strongest = [...general].sort((a, b) => params(b) - params(a)).find((m) => params(m) <= 16) ?? general[0];
  const coder = proven[0]?.name ?? current.coder;
  if (!proven.length) warnings.push("No model has passed the capability lab yet, so Coder and Debugger keep their current model. Run a capability test first.");
  const thinker = proven[0]?.name ?? strongest?.name ?? coder;
  const vision = [...chat].filter(isVision).sort((a, b) => params(b) - params(a))[0]?.name;
  if (!vision) warnings.push("No vision model is installed, so the Critic can't review screenshots (try installing qwen2.5vl).");
  // Documenter: a mid-size general model from the same family as the thinker if possible (fast Copilot answers).
  const thinkerModel = general.find((m) => m.name === thinker);
  const mid = general.filter((m) => params(m) >= 6 && params(m) <= 9).sort((a, b) => Number((b.family ?? "") === (thinkerModel?.family ?? "")) - Number((a.family ?? "") === (thinkerModel?.family ?? "")) || params(b) - params(a))[0]?.name;

  const pick: Record<string, { model?: string; why: string }> = {
    coder: { model: coder, why: proven.length ? "Passed all 8 capability probes" : "Kept: nothing has passed the lab" },
    debugger: { model: coder, why: proven.length ? "Edits code with the same tools as the Coder" : "Kept: nothing has passed the lab" },
    planner: { model: thinker, why: "Best reasoning model available for plans" },
    repository_analyst: { model: thinker, why: "Reads and maps the codebase" },
    researcher: { model: thinker, why: "Reads sources and writes research" },
    reviewer: { model: thinker, why: "Judges changes" },
    designer: { model: thinker, why: "Design reasoning" },
    security_qa: { model: thinker, why: "Security review" },
    accessibility_qa: { model: thinker, why: "Accessibility review" },
    compliance_triage: { model: thinker, why: "Compliance triage" },
    critic: { model: vision ?? current.critic, why: vision ? "Vision model: looks at screenshots" : "Kept: no vision model installed" },
    documenter: { model: mid ?? thinker, why: mid ? "Smaller and faster for summaries and Copilot" : "Best general model available" },
  };
  const plan = ROLES.flatMap((role) => {
    const p = pick[role];
    return p.model ? [{ role, from: current[role], to: p.model, why: p.why }] : [];
  });
  return { plan, warnings };
}
