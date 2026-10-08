/**
 * Which agent roles actually run, and who does the work of the ones that don't.
 *
 * AgentRole lists twelve roles, but only some of them are ever given a model call: Planner, Coder, Debugger, Visual
 * critic, Researcher and Documenter in builds, and Repository analyst for Repo Report. Design steps are done by the
 * Coder; security, accessibility and compliance are automatic scans whose findings the Debugger fixes; nothing runs
 * as "reviewer" or "designer". Skills and tools name those roles anyway, so guidance written for them would reach no
 * one. `roleStandsIn` maps each one to the agent that does that work, for picking skills and for showing who uses
 * something.
 */
export const ACTIVE_ROLES = ["planner", "coder", "debugger", "critic", "researcher", "documenter", "repository_analyst"] as const;
export type ActiveRole = (typeof ACTIVE_ROLES)[number];

/** A role that never runs → the agents that do its work. */
export const ROLE_STANDS_IN: Record<string, ActiveRole[]> = {
  designer: ["coder"],
  reviewer: ["debugger"],
  security_qa: ["debugger"],
  accessibility_qa: ["debugger"],
  compliance_triage: ["debugger"],
};

export const isActiveRole = (role: string): role is ActiveRole => (ACTIVE_ROLES as readonly string[]).includes(role);

/** The agents a list of roles really reaches: active roles as they are, the others through the agent doing their work. */
export function effectiveRoles(roles: readonly string[] | undefined): ActiveRole[] {
  const out: ActiveRole[] = [];
  for (const r of roles ?? []) for (const a of isActiveRole(r) ? [r] : ROLE_STANDS_IN[r] ?? []) if (!out.includes(a)) out.push(a);
  return out;
}

/** Whether something meant for `roles` (empty = everyone) applies to an agent running as `role`. */
export const appliesToRole = (roles: readonly string[] | undefined, role: string) => !roles?.length || effectiveRoles(roles).includes(role as ActiveRole);
