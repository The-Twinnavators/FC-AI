# Plan: Bring your own AI provider (OpenAI, Anthropic)

Status: **proposal, waiting for approval.** No code, dependencies, schema changes or migrations have been made for this feature.

## 1. What exists today (inspected)

| Area | Today | File |
|---|---|---|
| Users and auth | One local user. The desktop shell creates a random token and passes it to the daemon; the UI sends it as a Bearer header (and `?token=` for live updates and images). The daemon listens on 127.0.0.1 only and checks an origin allowlist. No accounts. | `apps/desktop/src/main.ts:23-27`, `packages/daemon/src/api/server.ts:826-858`, `apps/ui/src/api.ts:18-61` |
| Providers | `ProviderKind` is `ollama`, `openai_compatible`, `scripted`. A disabled `hosted-openai-compatible` provider exists; its key is read from an environment variable and never stored. No Anthropic provider. | `packages/contracts/src/schemas.ts:156-179`, `packages/daemon/src/models/router.ts:23-157`, `models/openaiCompat.ts` |
| Hosted gate | A hosted provider must be enabled, and for project calls the project must allow hosted models. **Gap:** calls without a project (the Copilot) only check "enabled". The `hosted_model` approval kind exists but nothing uses it. | `router.ts:112-117`, `PolicyForm.tsx:20` |
| Secrets | No secret storage or encryption anywhere (no Electron safeStorage, keytar, DPAPI or node crypto use). | n/a |
| Redaction | Strong: Bearer values, auth headers, secret-named fields, and `sk-`, `sk-proj-`, `sk-ant-` keys are redacted before events are stored. HTTP errors are redacted and trimmed. | `packages/daemon/src/security/redaction.ts`, `events/bus.ts:37-44`, `server.ts:928-931` |
| Storage | Settings and events in one SQLite file in the data folder; events kept 90 days. No backups or exports of the data folder. | `db/store.ts:68-75`, `db/retention.ts:19` |
| Copilot | Uses the documenter model; history kept in the browser's local storage (`fc.copilot.history.v2`). The daemon doesn't store message text. | `api/copilot.ts:140-200`, `components/Copilot.tsx:35-63` |
| Legal pages | No Terms of Service or Privacy Policy pages or links. | `components/AppFooter.tsx` |

## 2. Data and ownership model

FlowCode is a single-user desktop app, so "the user's own keys" means the person using this computer. There is no team or workspace sharing. One connected provider at a time (OpenAI or Anthropic), one key per provider.

New SQLite table `ai_connections` (one migration):

| Column | Meaning |
|---|---|
| `provider` | `openai` or `anthropic` (allowlist) |
| `model` | an id from the allowlist for that provider |
| `key_ciphertext`, `key_iv`, `key_tag` | the API key, encrypted (AES-256-GCM) |
| `key_hint` | last 4 characters only, for "Key ending in …abcd" |
| `status` | `connected`, `failed`, `model_unavailable` |
| `last_tested_at`, `last_ok_at`, `last_error_kind` | connection health (error kind only, never text that could contain the key) |
| `ack_provider`, `ack_version`, `ack_at` | the user's data-sharing and charges acknowledgement |
| `uses` | which parts may use it: `copilot`, `design_steps`, `all_build_steps` (the user chooses; default `copilot` only) |
| `limits` | daily request cap and max output length per request |

## 3. Key storage and encryption

- **Master key:** a random 32-byte key that never touches the database.
  - **Desktop app:** the Electron main process creates it on first use and stores it encrypted with Electron `safeStorage`. That uses Windows DPAPI, the macOS Keychain or the Linux secret service, so only this OS user can decrypt it. At launch the main process decrypts it and passes it to the daemon process only (child environment, `FLOWCODE_SECRETS_KEY`). It is never sent to the renderer.
  - **Dev mode (no Electron):** a `secrets.key` file in the data folder, owner-only permissions. Settings will show a notice: "Development mode: your key is protected only by file permissions."
- **At rest:** each API key is encrypted with AES-256-GCM (Node's built-in crypto, no new dependency) using a fresh IV, and stored in `ai_connections`.
- **In use:** the key is decrypted only inside the provider adapter, at the moment of a provider request, and is never cached in module state longer than the request.
- **Never returned:** no route returns the key. The UI only ever sees the provider, model, status and "Key ending in …abcd".
- **Not in backups:** there are no data-folder backups today; any future export will exclude `ai_connections`, and this is documented.

## 4. Provider adapter architecture

- Add `anthropic` to `ProviderKind` and a new `AnthropicProvider` (Messages API, `x-api-key` and `anthropic-version` headers) implementing the same `ModelProvider` interface as `OllamaProvider` and `OpenAICompatibleProvider`. The rest of FlowCode keeps calling `router.chat(...)`; nothing else depends on provider formats.
- OpenAI reuses `OpenAICompatibleProvider` with base URL `https://api.openai.com/v1`, but takes its key from the secret store (new `keySource: "secret"`) instead of an environment variable.
- **Model allowlist** in contracts, per provider, each with a plain label and the provider id shown second, e.g.:
  - "Fast and lower cost" · "Balanced for most tasks" · "More capable for complex work"
  - The allowlist is checked server-side on every save and every request; arbitrary model ids are rejected. On each connection test, FlowCode checks the allowlisted models against the provider's model list and marks unavailable ones ("model unavailable or no longer supported" state).
- **Limits:** request timeout 120 s, max 2 retries with backoff (rate-limit and 5xx only), max output length per request, max request size, and a daily request cap (default 200, editable). Hitting the cap pauses provider use with a plain message; nothing silently falls back.
- **Routing:** the connected provider is used only where the user allowed it (`uses`). Builds additionally need the project's existing "Allow hosted models" switch. **Fix the existing gap:** calls with no project (the Copilot) must check `uses` too.

## 5. Backend routes (all behind the existing token and origin checks)

| Route | Does |
|---|---|
| `GET /ai-provider` | status: provider, model, label, status, last test, key hint, uses, limits, acknowledgement. Never the key. |
| `POST /ai-provider/test` | `{provider, key}` → tests the key with the provider's model-list call (no tokens spent). Returns a result kind only. Nothing is stored. |
| `POST /ai-provider/connect` | `{provider, key, model, acknowledged: true, ackVersion}` → tests again, then encrypts and saves. Refused without a passing test and a fresh acknowledgement. |
| `POST /ai-provider/model` | change model (allowlist only). |
| `POST /ai-provider/uses` | change what may use it, and limits. |
| `POST /ai-provider/replace-key` | `{key}` → test, then replace atomically. The old key stays if the test fails ("Your key was not changed."). |
| `POST /ai-provider/disconnect` | delete the row, then `VACUUM` so the ciphertext isn't left in free pages. |

Request bodies are never logged (the server doesn't log bodies today; a test will keep it that way). Error responses are built from a fixed set of result kinds, not from provider text.

## 6. Authorization model

Single local user: possession of the daemon token is the authorization, as for every other route. Provider routes additionally require the request origin to be the app (existing allowlist) and reject `?token=` query auth, so a key can only be sent with the Bearer header. No other user or process on the machine can call them without the token.

## 7. UI flow and copy

**Settings → AI provider** (new section, also linked from System → Models):

1. **Current AI provider:** provider, model (plain label + id), status, "Last checked 2 minutes ago". Empty state: "No AI provider is connected yet." Primary action: "Connect an AI provider".
2. **Choose a provider:** two cards (OpenAI, Anthropic): short description, "You need your own OpenAI account", "Pricing" link to the official page, "Connect".
3. **Guided setup**, "Step 1 of 4" with Back, and Cancel that keeps non-sensitive choices:
   1. *What you need:* "To connect OpenAI, you need an API key from your OpenAI account. An API key is a private code that lets this app send your requests to OpenAI. Your provider may charge you for AI usage." Buttons "Open OpenAI" (official key page, new tab) and "I already have an API key". "What is an API key?" help. "Do not share your API key with anyone."
   2. *Create or find the key:* the numbered steps from the spec, per provider, plus "Copy it now: it's shown only once" and "This app never needs your password."
   3. *Paste and test:* masked field with Show/Hide, paste support, `autocomplete="off"`, format hint, "Your API key is private. Never share it with anyone.", the disclosure line, the unticked acknowledgement checkbox ("I understand that my requests may be sent to OpenAI and that OpenAI may charge for usage."), Terms and Privacy links, "Test connection", then "Save and connect" enabled only after a passing test.
   4. *Choose a model and what uses it:* the three plain-language options; "Use it for: The Copilot / Design steps in builds / All build steps"; daily limit.
4. **Manage:** Test again · Change model · Replace key · Disconnect (confirmation explains: "FlowCode will delete your saved key from this computer and go back to local models. Your provider account is not changed.").

All required states are covered: no provider, setup in progress, empty field, invalid format, testing, success, failed, provider unavailable, rate-limited, account/billing/permission problem, connected, replacing, disconnect confirm, disconnected, model unavailable, cancelled, secure storage failure, network unavailable. Each has a plain message and a next action, e.g. "We could not connect with that API key. Check that you copied the full key, then try again."

Accessibility: keyboard throughout, labelled fields with errors tied by `aria-describedby`, status announced with `role="status"`, no colour-only status, works at 375 px, respects reduced motion, and the masked field works with password managers.

## 8. Copilot boundaries

- A **setup assistant** mode with a fixed system prompt: explain API keys, charges, where to go next, model differences and safe error meanings; link only official docs; never ask for or repeat a key, password, payment details or screenshots; no guarantees about price, privacy or availability.
- **Key guard before sending:** the Copilot input checks for key-like text (`sk-…`, `sk-ant-…`, long random strings) in the browser and blocks sending: "For your security, do not share API keys in chat. Remove that key from this message and paste it only into the secure API key field." It also advises revoking the key if it was already sent anywhere. The daemon repeats the check and refuses to forward such a message to any model.
- The Copilot's local chat history never stores a message that tripped the guard.

## 9. Privacy and consent

- Before the first connection: who receives data, that prompts, attached files and relevant app context may be sent, that the provider has its own terms and charges, what FlowCode stores (encrypted key, model, status, acknowledgement) and where, and how to disconnect and delete.
- The acknowledgement is stored with the provider and the wording version; changing the wording requires a fresh acknowledgement.
- **Terms of Service and Privacy Policy:** linked in the footer, in Settings and in the setup flow. For now they are **clearly labelled drafts** ("Draft for testing. Not legal advice and not final."), as allowed for a private prototype. Before any public or paid release they must be replaced by attorney-reviewed documents. I will not present generated text as final legal documents.

## 10. Disconnect and deletion

Disconnect deletes the `ai_connections` row and runs `VACUUM`. If the key may have been exposed, the UI says to revoke it in the provider's account and links there. Uninstalling FlowCode leaves the data folder; Settings → Data & privacy gets a "Delete saved AI provider key" control that works even without a connection.

## 11. Threats and mitigations

| Threat | Mitigation |
|---|---|
| Key read from the database file | AES-256-GCM with a master key held by the OS (DPAPI/Keychain) in the desktop app |
| Key in logs, events, errors | no body logging; result kinds instead of provider text; existing redaction (covers `sk-`, `sk-ant-`); tests |
| Key in the browser | key only in the setup field's component state, cleared on unmount and after save; never in local/session storage, URLs or analytics (there is no analytics) |
| Another local page calls the daemon | token + origin allowlist; provider routes reject query-string tokens |
| Prompt injection asks the model to reveal the key | the key is never in model context; adapters add it only as a header |
| Runaway cost | daily cap, max output length, retries capped, builds need per-project consent, clear usage counter |
| Arbitrary model or endpoint | provider and model allowlists; fixed official base URLs |
| Key pasted into chat | browser and daemon key guard |

## 12. Tests

- Encryption round trip; ciphertext differs per save; wrong master key fails cleanly ("secure storage failure" state).
- No route ever returns the key; status shows only the hint.
- Redaction: key never appears in stored events, errors or diagnostics after a failed test (fake provider returns an error echoing the key).
- Connect refused without a passing test or acknowledgement; replace keeps the old key on failure; disconnect deletes the row.
- Allowlist: unknown provider or model rejected.
- Adapter contract tests for Anthropic and OpenAI against a local fake server (no real calls, no cost): success, 401, 403 billing, 429, 5xx, timeout, network down.
- Routing: Copilot uses the provider only when `uses` includes it (the existing gap); builds also need the project switch.
- Copilot key guard (browser and daemon).
- UI: typecheck, accessibility audit, theme sweep.
- Before completion: type check, lint, all tests, production build.

## 13. Files expected to change

- `packages/contracts/src/schemas.ts`, `api.ts`, new `aiProviders.ts` (allowlists, labels, copy)
- `packages/daemon/src/db/migrations.ts` (new table), new `security/secrets.ts`, new `models/anthropic.ts`, `models/openaiCompat.ts`, `models/router.ts`, new `api/aiProvider.ts`, `api/server.ts`, `api/copilot.ts`
- `apps/desktop/src/main.ts` (master key via safeStorage)
- `apps/ui/src/views/SettingsView.tsx`, new `components/AiProviderSettings.tsx` and setup flow, `components/Copilot.tsx` (key guard, setup assistant), `components/AppFooter.tsx`, new draft Terms and Privacy pages
- `packages/daemon/test/ai-provider.test.ts` (new)

## 14. Cost

No cost to FlowCode itself and no new dependencies (Node crypto and Electron safeStorage are built in). Provider usage is billed by the provider to the user's own account, which the UI says plainly.

## 15. Decisions needed

1. Approve this plan (or note changes).
2. Default for "what uses the provider": Copilot only (recommended), or also design steps?
3. Draft Terms and Privacy pages now, labelled as drafts, or links only until you have reviewed documents?
