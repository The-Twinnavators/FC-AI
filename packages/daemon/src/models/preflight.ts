/**
 * Provider and model check before model work (reliability phase 1). For each service a build's roles use: is it
 * reachable, and is every model it is assigned there? It records which service answered (Ollama's version and host,
 * each model's digest) and says plainly what it can't confirm. It never downloads a model, switches providers or
 * makes a paid request: listing models and asking a version are free.
 *
 * Clean Cart (run_b08ca512): a Docker Ollama took the port without qwen3:14b, and later the cloud coder's credits ran
 * out. Both surfaced only as a failed attempt in the middle of a step.
 */
import type { AgentRole, ModelAssignment, ProviderErrorKind } from "@flowcode/contracts";
import type { ModelInfo, Provider } from "./types.js";
import { classifyError } from "./errors.js";

export interface ModelCheck {
  model: string;
  roles: AgentRole[];
  /** available: listed by the service. missing: the service answered and doesn't have it. unconfirmed: couldn't tell. */
  status: "available" | "missing" | "unconfirmed";
  digest?: string;
}

export interface ServiceCheck {
  providerId: string;
  kind: string;
  reachable: boolean;
  /** What answered, e.g. "Ollama 0.40.3 at 127.0.0.1:11434". */
  identity?: string;
  detail: string;
  models: ModelCheck[];
  /** What this check can't confirm (which process answered, a cloud account's credit). */
  uncertain: string[];
  /** Set when the service can't be used: why, as an error kind. */
  failure?: ProviderErrorKind;
}

export interface PreflightResult {
  ok: boolean;
  at: string;
  services: ServiceCheck[];
  /** One plain sentence per problem, with what to do. Empty when ok. */
  problems: string[];
  /** The first problem's error kind, for the blocker. */
  failure?: ProviderErrorKind;
}

const sameModel = (listed: string, wanted: string) => listed === wanted || listed === `${wanted}:latest` || `${listed}:latest` === wanted;

export async function checkProviders(provider: (id: string) => Provider, assignments: Partial<Record<AgentRole, ModelAssignment>>, roles?: AgentRole[]): Promise<PreflightResult> {
  // Group the roles' models by service.
  const byService = new Map<string, Map<string, AgentRole[]>>();
  for (const [role, a] of Object.entries(assignments) as Array<[AgentRole, ModelAssignment | undefined]>) {
    if (!a?.model || (roles && !roles.includes(role))) continue;
    const models = byService.get(a.providerId) ?? new Map<string, AgentRole[]>();
    models.set(a.model, [...(models.get(a.model) ?? []), role]);
    byService.set(a.providerId, models);
  }
  const services: ServiceCheck[] = [];
  const problems: string[] = [];
  let failure: ProviderErrorKind | undefined;
  for (const [providerId, wanted] of byService) {
    const check = await checkService(provider, providerId, wanted);
    services.push(check);
    if (check.failure) {
      failure ??= check.failure;
      problems.push(check.detail);
    }
    for (const m of check.models.filter((x) => x.status === "missing")) {
      failure ??= "model_missing";
      problems.push(`${m.model} (${m.roles.join(", ")}) isn't installed in ${check.identity ?? providerId}. Install it yourself ("ollama pull ${m.model}") or pick an installed model on System → Models; FlowCode doesn't download models or switch them on its own.`);
    }
  }
  return { ok: problems.length === 0, at: new Date().toISOString(), services, problems, ...(failure ? { failure } : {}) };
}

async function checkService(provider: (id: string) => Provider, providerId: string, wanted: Map<string, AgentRole[]>): Promise<ServiceCheck> {
  const models = (status: ModelCheck["status"]) => [...wanted].map(([model, roles]) => ({ model, roles, status }));
  let p: Provider;
  try {
    p = provider(providerId);
  } catch {
    return { providerId, kind: "unknown", reachable: false, detail: `The model service "${providerId}" isn't set up. Pick a service on System → Models.`, models: models("unconfirmed"), uncertain: [], failure: "auth_failed" };
  }
  const kind = p.config.kind;
  const hosted = !!p.config.hosted;
  const health = await p.health().catch((err) => ({ ok: false, detail: classifyError(err).message }));
  if (!health.ok) {
    const failure: ProviderErrorKind = hosted ? (/key|disabled|set up/i.test(health.detail) ? "auth_failed" : "connection_refused") : "connection_refused";
    const detail = hosted ? `${p.config.label} can't be used: ${health.detail}. Set it up on System → Models, or pick a local model.` : `${p.config.label} isn't answering (${health.detail}). Start Ollama, then resume the build; the step's work is kept.`;
    return { providerId, kind, reachable: false, detail, models: models("unconfirmed"), uncertain: [], failure };
  }
  const uncertain: string[] = [];
  if (kind === "ollama") uncertain.push("Which Ollama process answered can't be confirmed (a Docker and a desktop Ollama can share the port); the version, address and model digests identify it.");
  if (hosted) uncertain.push("A cloud account's remaining credit can't be checked without a paid request; running out shows as a provider failure that keeps the work.");
  let listed: ModelInfo[] | undefined;
  try {
    listed = await p.listModels();
  } catch (err) {
    const e = classifyError(err);
    if (e.kind === "auth_failed") return { providerId, kind, reachable: true, identity: health.detail, detail: `${p.config.label} refused the sign-in (${e.message.slice(0, 160)}). Check its key on System → Models.`, models: models("unconfirmed"), uncertain, failure: "auth_failed" };
    if (!hosted) return { providerId, kind, reachable: false, identity: health.detail, detail: `${p.config.label} answered but couldn't list its models (${e.kind}). Restart Ollama, then resume the build.`, models: models("unconfirmed"), uncertain, failure: e.kind === "timeout" ? "timeout" : "connection_reset" };
    uncertain.push(`Its model list couldn't be read (${e.kind}), so the models are unconfirmed.`);
  }
  const checks: ModelCheck[] = [...wanted].map(([model, roles]) => {
    if (!listed) return { model, roles, status: "unconfirmed" };
    const hit = listed.find((m) => sameModel(m.name, model));
    // Only Ollama's list is complete: a cloud service's can leave out aliases it still accepts, and other local servers
    // load models on request.
    return { model, roles, status: hit ? "available" : kind === "ollama" ? "missing" : "unconfirmed", ...(hit?.digest ? { digest: hit.digest.slice(0, 12) } : {}) };
  });
  return { providerId, kind, reachable: true, identity: health.detail.replace(/^configured: /, `${p.config.label}: `), detail: health.detail, models: checks, uncertain };
}

/** A short line for the activity feed: what answered and with which models. */
export function preflightSummary(r: PreflightResult): string {
  const parts = r.services.map((s) => `${s.identity ?? s.providerId}: ${s.models.map((m) => `${m.model}${m.status === "available" ? "" : ` (${m.status})`}`).join(", ")}`);
  return r.ok ? `Models checked. ${parts.join("; ")}` : `Model service problem: ${r.problems[0]}`;
}
