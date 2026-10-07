// packages/daemon/src/flowReport/comprehend/model.ts
//
// The model FlowReport reads a repository through, for the daemon.
//
// ── FlowCode's router, not a client of its own ───────────────────────────────
//
// In FlowAgent this file was a small Ollama client with a fixed host, because
// FlowAgent's daemon had no other way to reach a model. FlowCode has one: the
// ModelRouter, which holds the provider registry and the role → model
// assignments, logs every request, and enforces hosted-model consent. Going
// round it would mean a second set of model settings that the Models page does
// not show and the Performance view does not count. So FlowReport asks the
// router for the model assigned to the `repository_analyst` role and talks to
// it through `router.chat`, exactly as the critique and style capture do.
//
// ── Local means local, unless research is on ─────────────────────────────────
//
// FlowReport's promise is that nothing a report reads leaves the machine
// unless external research was turned on for that project. FlowAgent kept it
// by hard-coding 127.0.0.1. Here the assignment may point at a hosted provider,
// so the promise is kept by refusing one: a hosted model is used only when the
// run's `networkResearch` setting is on AND the provider is enabled (FlowCode's
// own consent). Otherwise the run is told no model is available, says so in
// the report, and carries on measuring — which is what FlowReport always did
// when the local model was asleep.
//
// ── No quiet substitutes ─────────────────────────────────────────────────────
//
// FlowAgent fell back to whichever model happened to be pulled. FlowCode never
// swaps in another model on its own: if the assigned one is not installed, the
// step does not happen and the reason names the model, so the fix is obvious.
//
// ── Scoped per run ───────────────────────────────────────────────────────────
//
// The comprehension modules call `modelStatus()` and `chatJson()` as plain
// functions. Two runs can be in flight with different research settings, so
// the gateway is carried by AsyncLocalStorage for the duration of one run
// rather than set globally — every await inside the run sees that run's rules.
//
// ── An absent model is a degraded run, never a failed one ────────────────────
//
// Every function here returns null (or `available: false`) rather than
// throwing, and the caller's job is to carry on and say the step did not
// happen. A report that refuses to generate because a model was asleep would be
// worse than the deterministic one it replaced.

import { AsyncLocalStorage } from 'node:async_hooks'
import type { AgentRole, ModelAssignment } from '@flowcode/contracts'
import type { ModelRouter } from '../../models/router.js'

/** The FlowCode role FlowReport's model work runs under. Its assignment is
 *  whatever the Models page says, global or overridden. */
export const FLOW_REPORT_ROLE: AgentRole = 'repository_analyst'

/** Kept for the callers' signature: `chooseModel(status, o.model ?? DEFAULT_MODEL)`.
 *  Empty means "the assigned one". */
export const DEFAULT_MODEL = ''

export interface ChatOptions {
  model?: string
  /** Hard ceiling. A comprehension pass that hangs must not hang the run. */
  timeoutMs?: number
  /** 0 for anything whose output is recorded. Two runs of one repository
   *  should not disagree because the sampler rolled differently. */
  temperature?: number
  numCtx?: number
  signal?: AbortSignal
}

export interface ModelStatus {
  available: boolean
  /** The model that will answer, when there is one. */
  models: string[]
  reason?: string
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

/** What a run talks to. Production builds one from the router; tests may
 *  supply their own. */
export interface ModelGateway {
  status(): Promise<ModelStatus>
  /** The reply's text, or null on any failure. */
  chat(messages: ChatMessage[], o: ChatOptions): Promise<string | null>
}

const scope = new AsyncLocalStorage<ModelGateway>()

/** Run `fn` with `gateway` as the model every comprehension call inside it
 *  uses. */
export function withModel<T>(gateway: ModelGateway | null, fn: () => Promise<T>): Promise<T> {
  return gateway ? scope.run(gateway, fn) : fn()
}

/** Is there a model to talk to, and which. Never throws. */
export async function modelStatus(): Promise<ModelStatus> {
  const g = scope.getStore()
  if (!g) {
    return { available: false, models: [], reason: 'No model is set up for FlowReport, so the product was not read — only measured.' }
  }
  try {
    return await g.status()
  } catch (err: any) {
    return { available: false, models: [], reason: `The model could not be checked: ${String(err?.message ?? err)}` }
  }
}

/**
 * The model that will answer.
 *
 * With the router there is exactly one candidate — the assigned model — so
 * this returns it when it is available and nothing otherwise. A `preferred`
 * name is honoured only if it is that model: FlowCode does not swap models.
 */
export function chooseModel(status: ModelStatus, preferred = DEFAULT_MODEL): string | null {
  if (!status.available) return null
  if (preferred && status.models.includes(preferred)) return preferred
  return status.models[0] ?? null
}

/**
 * One JSON-returning exchange.
 *
 * Structured output makes the provider constrain decoding to a JSON object,
 * which removes the whole class of failure where a model wraps its answer in
 * prose. The result is still validated by the caller, because well-formed JSON
 * and the right shape are different things.
 *
 * Returns null on any failure — unreachable, timed out, refused, unparseable.
 */
export async function chatJson<T>(messages: ChatMessage[], o: ChatOptions = {}): Promise<T | null> {
  const g = scope.getStore()
  if (!g) return null
  try {
    const text = await g.chat(messages, o)
    if (!text) return null
    return JSON.parse(stripFence(text)) as T
  } catch {
    return null
  }
}

/** Some hosted models wrap JSON in a fence even when asked not to. */
function stripFence(s: string): string {
  const m = /^\s*```(?:json)?\s*([\s\S]*?)\s*```\s*$/.exec(s)
  return m ? m[1]! : s
}

/**
 * The gateway for one run, through FlowCode's router.
 *
 * `allowHosted` is the run's `networkResearch` setting and nothing else: it is
 * the one switch FlowReport's user turned on to let anything leave the machine.
 */
export function routerModel(router: ModelRouter, o: { allowHosted: boolean; role?: AgentRole }): ModelGateway {
  const role = o.role ?? FLOW_REPORT_ROLE
  let checked: { assignment: ModelAssignment; status: ModelStatus } | null = null

  const status = async (): Promise<ModelStatus> => {
    let assignment: ModelAssignment
    try {
      assignment = router.assignmentFor(role)
    } catch {
      return { available: false, models: [], reason: `No model is assigned to ${role.replace(/_/g, ' ')} on the Models page, so the product was not read — only measured.` }
    }
    let provider
    try {
      provider = router.provider(assignment.providerId)
    } catch {
      return { available: false, models: [], reason: `The provider for ${assignment.model} is not configured, so the product was not read — only measured.` }
    }
    if (provider.config.hosted && !o.allowHosted) {
      return {
        available: false, models: [],
        reason: `The model assigned to repository analysis (${assignment.model}) is hosted, and external research is off for this report, so nothing was sent to it. The product was measured, not read.`,
      }
    }
    if (!provider.config.enabled) {
      return { available: false, models: [], reason: `${provider.config.label} is switched off on the Models page, so the product was not read — only measured.` }
    }
    if (!provider.config.hosted) {
      // Installed? Asking for a model that is not pulled fails exactly like
      // the container being down, and the report would say the wrong thing.
      try {
        const listed = await provider.listModels(AbortSignal.timeout(3_000))
        const names = listed.map((m) => m.name)
        if (!names.some((n) => n === assignment.model || n === `${assignment.model}:latest`)) {
          return { available: false, models: [], reason: `The model assigned to repository analysis (${assignment.model}) is not installed in ${provider.config.label}, so the product was not read — only measured.` }
        }
      } catch (err: any) {
        return { available: false, models: [], reason: `No local model is reachable through ${provider.config.label}: ${String(err?.message ?? err)}` }
      }
    }
    // A hosted model's name says so, because the report prints the name and
    // otherwise claims the reading happened on this machine.
    const label = provider.config.hosted ? `${assignment.model} (hosted — external research was on)` : assignment.model
    const s: ModelStatus = { available: true, models: [label] }
    checked = { assignment, status: s }
    return s
  }

  return {
    status,
    async chat(messages, opts) {
      if (!checked) {
        const s = await status()
        if (!s.available) return null
      }
      const { assignment } = checked!
      try {
        const res = await router.chat({ role }, assignment, {
          messages,
          format: { type: 'object' },
          temperature: opts.temperature ?? 0,
          timeoutMs: opts.timeoutMs ?? 120_000,
          signal: opts.signal,
        })
        return res.content || null
      } catch {
        return null
      }
    },
  }
}
