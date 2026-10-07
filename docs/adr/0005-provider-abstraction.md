# ADR-0005 — Model provider abstraction and capability gating

- Status: Accepted (2026-10-01)
- Context: PRD FR-M1–M4, §10, Phase 3

## Decision
- A uniform `Provider` interface (`chat` with native tools, `listModels`, `describe`, optional `embed`,
  `health`). Implementations: **Ollama** (local, default), **OpenAI-compatible** (hosted, disabled until
  configured + consented; key read from an env var, never persisted), **Scripted** (deterministic, tests).
- `ModelRouter` resolves role → model (global defaults, project overrides), logs every request with
  provider/model/version, and applies the retry policy: cancellation is terminal; only `timeout`,
  `connection_refused`, `connection_reset`, `rate_limited`, `dns_failure` are retried (bounded, backoff);
  tool side effects are never replayed by a model retry.
- Errors are classified into typed kinds with sanitized cause chains.
- **Capability lab**: eight probes in a disposable workspace through the real governed tools. Records are keyed
  by provider/model/digest/config hash. A model without native tool calls, or failing any probe, cannot be
  assigned as Coder and runs are blocked at Coder preflight.
- Thinking-capable models run with reasoning off by default; reasoning is a recorded part of the configuration.

## Observed results on the reference machine (RTX 5070 Laptop, 32 GB RAM), 2026-10-01
| Model | Result | Notes |
|---|---|---|
| qwen3:14b | **8/8 PASS** | default Coder/Planner/Debugger |
| qwen3:8b (reasoning) | 7/8 | wrote wrong file content once |
| qwen3:8b | 6/8 | regex in a literal patch; false completion claim (caught) |
| qwen2.5:7b | 6/8 | arithmetic error; wrong patch |
| llama3.1:8b | 2/8 | |
| qwen2.5-coder:7b | 0/8 | tool calls written as text (pseudo-JSON) |
| gemma2:2b | 0/8 | no tool support |
