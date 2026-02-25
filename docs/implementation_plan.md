# Wanda — Level 1 Foundation Implementation Plan

## Goal

Build the complete Level 1 foundation for Wanda as a pnpm monorepo with TypeScript strict ESM. This delivers a working Telegram bot that responds to paired users via an LLM (Anthropic), enforces pairing, has a single safe tool (`get_current_time`), encrypted secrets, Docker sandbox config, and structured logging.

---

## User Review Required

> [!IMPORTANT]
> **OAuth vs API Key**: The prompt specifies `@anthropic-ai/sdk`. Jannis has a Google One AI Pro subscription and prefers OAuth-based access. For Level 1, should we:
> - A) Use Anthropic API key (as specified in the prompt) — simplest for v1
> - B) Start with Google Gemini via OAuth (aligns with Jannis's subscription)
> - Recommendation: **A** for Level 1 (single provider, simpler). Add Gemini OAuth in Level 2.

> [!WARNING]
> **Encrypted Secrets**: The prompt mentions SQLCipher or libsodium/age. For Level 1 I plan to use `@noble/ciphers` (audited, zero-dependency AES-256-GCM). SQLCipher would add a native dependency. Acceptable?

---

## Proposed Changes

### Root — Monorepo Setup

#### [NEW] [package.json](file:///home/jannis/Schreibtisch/Work-OS/40_Products/Wanda-Repo/package.json)
Root workspace package.json with scripts: `dev`, `build`, `test`, `lint`, `format`.

#### [NEW] [pnpm-workspace.yaml](file:///home/jannis/Schreibtisch/Work-OS/40_Products/Wanda-Repo/pnpm-workspace.yaml)
Declares `packages/*` and `apps/*` as workspace members.

#### [NEW] [tsconfig.json](file:///home/jannis/Schreibtisch/Work-OS/40_Products/Wanda-Repo/tsconfig.json)
Base TypeScript config: strict, ESM, Node22, noEmit.

#### [NEW] [.eslintrc.cjs](file:///home/jannis/Schreibtisch/Work-OS/40_Products/Wanda-Repo/.eslintrc.cjs)
ESLint flat config with TypeScript plugin.

#### [NEW] [.prettierrc](file:///home/jannis/Schreibtisch/Work-OS/40_Products/Wanda-Repo/.prettierrc)
Prettier config: single quotes, trailing commas, 100 print width.

#### [NEW] [.gitignore](file:///home/jannis/Schreibtisch/Work-OS/40_Products/Wanda-Repo/.gitignore)
Standard Node.js + TypeScript ignores, plus `/data`, `.env`.

---

### packages/shared

Types, config loading, and structured logger (pino).

#### [NEW] [types.ts](file:///home/jannis/Schreibtisch/Work-OS/40_Products/Wanda-Repo/packages/shared/src/types.ts)
Core types: `InboundMessage`, `OutboundMessage`, `UserIdentity`, `PairingRequest`, `ToolDefinition`, `ToolResult`, `SecretHandle`, `LifecycleHooks`, `WandaConfig`.

#### [NEW] [logger.ts](file:///home/jannis/Schreibtisch/Work-OS/40_Products/Wanda-Repo/packages/shared/src/logger.ts)
Pino logger with mandatory secret redaction (regex for API key patterns, `secret://` handles).

#### [NEW] [config.ts](file:///home/jannis/Schreibtisch/Work-OS/40_Products/Wanda-Repo/packages/shared/src/config.ts)
Config loader from environment variables with zod validation.

---

### packages/secrets

Encrypted secret store with `secret://<id>` resolver.

#### [NEW] [store.ts](file:///home/jannis/Schreibtisch/Work-OS/40_Products/Wanda-Repo/packages/secrets/src/store.ts)
SQLite-backed secret store. Secrets encrypted with AES-256-GCM via `@noble/ciphers`. Master key from `WANDA_SECRETS_MASTER_KEY` env var.

#### [NEW] [resolver.ts](file:///home/jannis/Schreibtisch/Work-OS/40_Products/Wanda-Repo/packages/secrets/src/resolver.ts)
`resolveSecrets(str: string): string` — replaces `secret://<id>` patterns with decrypted values. Used by tool runner only, never by prompt assembly.

---

### packages/core

Agent loop, lifecycle hooks, loop limits.

#### [NEW] [agent-loop.ts](file:///home/jannis/Schreibtisch/Work-OS/40_Products/Wanda-Repo/packages/core/src/agent-loop.ts)
Main loop: receive message → check pairing → assemble context → call LLM → parse tool calls → execute tools → send response. Enforces max iterations, max tool calls, timeout.

#### [NEW] [hooks.ts](file:///home/jannis/Schreibtisch/Work-OS/40_Products/Wanda-Repo/packages/core/src/hooks.ts)
Hook registry with typed async handlers: `on_message_received`, `before_llm`, `after_llm`, `before_tool_exec`, `after_tool_exec`, `on_error`.

---

### packages/channels

Channel adapter interface + Telegram implementation.

#### [NEW] [adapter.ts](file:///home/jannis/Schreibtisch/Work-OS/40_Products/Wanda-Repo/packages/channels/src/adapter.ts)
`ChannelAdapter` interface.

#### [NEW] [telegram.ts](file:///home/jannis/Schreibtisch/Work-OS/40_Products/Wanda-Repo/packages/channels/src/telegram.ts)
Grammy-based Telegram adapter with long polling. Maps `ctx.message` to `InboundMessage`. Implements pairing on receive (drops unknown users silently, notifies admin).

---

### packages/providers

LLM provider interface + Anthropic implementation.

#### [NEW] [provider.ts](file:///home/jannis/Schreibtisch/Work-OS/40_Products/Wanda-Repo/packages/providers/src/provider.ts)
`LLMProvider` interface: `chat(messages, tools) → LLMResponse`.

#### [NEW] [anthropic.ts](file:///home/jannis/Schreibtisch/Work-OS/40_Products/Wanda-Repo/packages/providers/src/anthropic.ts)
Anthropic SDK adapter. Uses `secret://anthropic-key` resolved at connection time.

---

### packages/tools

Tool registry + `get_current_time`.

#### [NEW] [registry.ts](file:///home/jannis/Schreibtisch/Work-OS/40_Products/Wanda-Repo/packages/tools/src/registry.ts)
Tool registry: register, lookup, validate (zod), execute. Dangerous tools gated by `requireApproval` flag.

#### [NEW] [get-current-time.ts](file:///home/jannis/Schreibtisch/Work-OS/40_Products/Wanda-Repo/packages/tools/src/tools/get-current-time.ts)
Safe tool: returns current time in a specified timezone.

---

### packages/memory

SQLite + FTS5 stub.

#### [NEW] [store.ts](file:///home/jannis/Schreibtisch/Work-OS/40_Products/Wanda-Repo/packages/memory/src/store.ts)
SQLite via better-sqlite3 with tables: `messages` (session log), `memories` (facts). FTS5 virtual table for search. Full implementation in Level 2.

---

### packages/sandbox

Docker runner config.

#### [NEW] [runner.ts](file:///home/jannis/Schreibtisch/Work-OS/40_Products/Wanda-Repo/packages/sandbox/src/runner.ts)
Configuration for Docker tool execution: image, caps, mounts, network policy. Actual execution deferred to Level 4 (when we have tools that need sandboxing).

---

### apps/wanda-bot

Entry point, Dockerfile, docker-compose.

#### [NEW] [index.ts](file:///home/jannis/Schreibtisch/Work-OS/40_Products/Wanda-Repo/apps/wanda-bot/src/index.ts)
Boot sequence: load config → init logger → init secrets → init memory → init tool registry → init channel → start agent loop.

#### [NEW] [Dockerfile](file:///home/jannis/Schreibtisch/Work-OS/40_Products/Wanda-Repo/apps/wanda-bot/Dockerfile)
Multi-stage build: Node 22 alpine. Non-root user. Read-only root FS. `/data` volume.

#### [NEW] [docker-compose.yaml](file:///home/jannis/Schreibtisch/Work-OS/40_Products/Wanda-Repo/docker-compose.yaml)
Service `wanda-bot` with env_file, `/data` volume mount, `no-new-privileges`, `cap_drop: ALL`.

#### [NEW] [.env.example](file:///home/jannis/Schreibtisch/Work-OS/40_Products/Wanda-Repo/.env.example)
Template with all required env vars documented (BOT_TOKEN, ADMIN_TELEGRAM_ID, ADMIN_TELEGRAM_CHAT_ID, WANDA_SECRETS_MASTER_KEY, ANTHROPIC_API_KEY).

---

### Root docs & meta

#### [NEW] [README.md](file:///home/jannis/Schreibtisch/Work-OS/40_Products/Wanda-Repo/README.md)
Project overview, setup instructions, run commands.

#### [NEW] [SECURITY.md](file:///home/jannis/Schreibtisch/Work-OS/40_Products/Wanda-Repo/SECURITY.md)
Security policy and disclosure instructions.

#### [NEW] [LICENSE](file:///home/jannis/Schreibtisch/Work-OS/40_Products/Wanda-Repo/LICENSE)
MIT license.

---

## Verification Plan

### Automated Tests (vitest)

All tests run with: `pnpm test` (root, runs all workspace tests)

#### Test 1: Pairing — Silent Behavior for Unknown Users
- **File:** `packages/channels/__tests__/pairing.test.ts`
- **What:** Send a message from an unknown `user_id`. Assert: no response sent, admin notified with OTP.
- **Command:** `pnpm --filter @wanda/channels test`

#### Test 2: Loop Iteration Limit
- **File:** `packages/core/__tests__/loop-limits.test.ts`
- **What:** Configure max iterations = 3. Mock LLM to always return a tool call. Assert: loop stops at 3 iterations, error logged.
- **Command:** `pnpm --filter @wanda/core test`

#### Test 3: Secret Redaction
- **File:** `packages/secrets/__tests__/redaction.test.ts`
- **What:** Store a secret, resolve it, then verify the value NEVER appears in: (a) pino log output, (b) serialized tool results, (c) error messages.
- **Command:** `pnpm --filter @wanda/secrets test`

#### Test 4: Tool Registry — Schema Validation
- **File:** `packages/tools/__tests__/registry.test.ts`
- **What:** Register `get_current_time`. Call with invalid params → zod error. Call with valid params → success.
- **Command:** `pnpm --filter @wanda/tools test`

### Build Verification

#### Docker Build
- **Command:** `docker compose build`
- **Assert:** Builds successfully, image runs with `docker compose up` and exits cleanly when no BOT_TOKEN provided (graceful error log).

### Manual Verification (by Jannis)
1. Set up `.env` with real `BOT_TOKEN` and `ADMIN_TELEGRAM_ID`
2. Run `pnpm install && pnpm dev`
3. Send a message from an unknown Telegram account → verify silence
4. Check admin chat for pairing request with OTP
5. Reply `/pair approve <otp>` → verify user is now paired
6. Send a message as the paired user → verify LLM response
7. Ask the bot "What time is it?" → verify `get_current_time` tool usage
