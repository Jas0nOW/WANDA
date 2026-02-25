# Wanda — Threat Model

> **Status:** Level 0  
> **Date:** 2026-02-23  
> **Scope:** Local-first Telegram agent with Docker sandbox

---

## 1. Assets

| Asset | Location | Sensitivity |
|-------|----------|-------------|
| **API keys & credentials** | `/data/secrets.db` (encrypted) | CRITICAL |
| **User messages & transcripts** | `/data/sessions/` | HIGH |
| **Memory store** | `/data/memory.db` (SQLite) | HIGH |
| **System prompt & tool configs** | In-memory + config files | MEDIUM |
| **Pairing database** | `/data/pairing.db` (SQLite) | HIGH |
| **Bot token (Telegram)** | `.env` → `BOT_TOKEN` | CRITICAL |
| **Master encryption key** | `.env` → `WANDA_SECRETS_MASTER_KEY` | CRITICAL |
| **Docker socket** | Host `/var/run/docker.sock` | CRITICAL |
| **Source code** | Git repository | LOW |

---

## 2. Actors

| Actor | Trust Level | Description |
|-------|-------------|-------------|
| **Admin (Jannis)** | FULL | Bootstrap admin via `ADMIN_TELEGRAM_ID`. Can pair/revoke users, approve tools, change config. |
| **Paired user** | MEDIUM | Approved via OTP pairing. Can send messages, trigger agent turn. Cannot approve dangerous tools. |
| **Unknown Telegram user** | NONE | Sends DM to bot. Must receive NO response. Admin gets pairing request. |
| **LLM provider** (Anthropic) | EXTERNAL | Processes prompts. Must NEVER receive raw secrets. Prompt context = trust boundary. |
| **MCP server** | SCOPED | Allowlisted integration. Runs in separate process. Can only access declared resources. |
| **Tool sandbox** (Docker) | CONTAINED | Non-root container. Read-only root FS. Only `/data` writable. Network DENY by default. |
| **Host OS** | TRUSTED | Runs Docker daemon. Must protect `.env`, Docker socket, and `/data` volume. |
| **Attacker** | HOSTILE | Internet-reachable only via Telegram API. Direct network access blocked (no inbound ports). |

---

## 3. Trust Boundaries

```
┌─────────────────────────────────────────────────────────┐
│                    INTERNET                             │
│  ┌─────────────┐                                       │
│  │  Telegram    │◄──── Attacker messages                │
│  │  API Cloud   │                                       │
│  └──────┬──────┘                                       │
│         │ HTTPS (outbound only, long polling)           │
├─────────┼───────────────────────────────────────────────┤
│         │         HOST BOUNDARY                        │
│  ┌──────▼──────────────────────────────────────┐       │
│  │            wanda-bot Container               │       │
│  │  ┌────────────────────────────────────────┐ │       │
│  │  │ Channel Adapter (Telegram)             │ │       │
│  │  │  ↕ typed InboundMessage                │ │       │
│  │  │ Core (Brain / Agent Loop)              │ │       │
│  │  │  ↕ lifecycle hooks                     │ │       │
│  │  │ Tool Registry                          │ │       │
│  │  │  ↕ zod-validated params                │ │       │
│  │  │ Secret Resolver                        │ │       │
│  │  │  (secret:// → JIT decryption)          │ │       │
│  │  └────────────────────────────────────────┘ │       │
│  │  ┌────────────────────────────────────────┐ │       │
│  │  │ /data  (mounted volume, rw)            │ │       │
│  │  │  secrets.db   memory.db   sessions/    │ │       │
│  │  │  pairing.db                            │ │       │
│  │  └────────────────────────────────────────┘ │       │
│  └─────────────────────────────────────────────┘       │
│                                                         │
│  ┌─────────────────────────────────────────────┐       │
│  │  Tool Sandbox Container(s)                   │       │
│  │  (non-root, dropped caps, no-new-privileges, │       │
│  │   ro rootfs, network DENY, /workspace only)  │       │
│  └─────────────────────────────────────────────┘       │
│                                                         │
│  .env (bootstrap only: BOT_TOKEN, MASTER_KEY)          │
│  docker-compose.yaml                                    │
└─────────────────────────────────────────────────────────┘
```

---

## 4. Threats

### T1: Prompt Injection via Telegram Message

| Field | Value |
|-------|-------|
| **Actor** | Unknown user or compromised paired user |
| **Vector** | Crafted Telegram message manipulating LLM to bypass instructions |
| **Impact** | Tool execution under attacker control, data exfiltration |
| **Likelihood** | HIGH (well-known, unsolved at model level) |
| **Mitigation** | M1, M2, M3, M4 |

### T2: Secret Exfiltration via LLM Output

| Field | Value |
|-------|-------|
| **Actor** | Attacker (via prompt injection) or misconfigured tool |
| **Vector** | LLM outputs raw API keys or secret values in chat/logs |
| **Impact** | API key abuse, credential compromise |
| **Likelihood** | MEDIUM |
| **Mitigation** | M5, M6 |

### T3: Tool Overreach / Destructive Commands

| Field | Value |
|-------|-------|
| **Actor** | LLM (hallucinated intent or injection-driven) |
| **Vector** | Agent executes `rm -rf`, network calls, or file exfiltration |
| **Impact** | Data loss, lateral movement, exfiltration |
| **Likelihood** | MEDIUM |
| **Mitigation** | M3, M7, M8 |

### T4: Unauthorized User Access

| Field | Value |
|-------|-------|
| **Actor** | Unknown Telegram user |
| **Vector** | DMs the bot without pairing |
| **Impact** | Unauthorized access to agent capabilities |
| **Likelihood** | HIGH (anyone can find the bot) |
| **Mitigation** | M1 |

### T5: Supply-Chain Attack (Dependencies)

| Field | Value |
|-------|-------|
| **Actor** | Compromised npm package |
| **Vector** | Malicious `postinstall` script, backdoored dependency |
| **Impact** | RCE on build/runtime, secret theft |
| **Likelihood** | LOW-MEDIUM |
| **Mitigation** | M9 |

### T6: Docker Escape / Container Breakout

| Field | Value |
|-------|-------|
| **Actor** | Compromised tool sandbox |
| **Vector** | Kernel exploit, misconfigured seccomp/capabilities |
| **Impact** | Host compromise |
| **Likelihood** | LOW |
| **Mitigation** | M8 |

### T7: Network-Based Attack on Exposed Service

| Field | Value |
|-------|-------|
| **Actor** | Network attacker |
| **Vector** | Connecting to an exposed port on the host |
| **Impact** | Unauthorized access to management plane |
| **Likelihood** | LOW (no inbound ports by design) |
| **Mitigation** | M10 |

### T8: Master Key Compromise

| Field | Value |
|-------|-------|
| **Actor** | Anyone with host filesystem access |
| **Vector** | Reading `.env` file containing `WANDA_SECRETS_MASTER_KEY` |
| **Impact** | Decrypt all stored secrets |
| **Likelihood** | LOW (requires host access) |
| **Mitigation** | M11 |

### T9: Indirect Prompt Injection via Tool Output

| Field | Value |
|-------|-------|
| **Actor** | Malicious content in external data (web pages, APIs, documents) |
| **Vector** | Tool output containing adversarial instructions the LLM follows |
| **Impact** | Same as T1 — tool overreach, data exfiltration |
| **Likelihood** | MEDIUM (especially with web/search tools) |
| **Mitigation** | M2, M3, M4 |

---

## 5. Mitigations

| ID | Mitigation | Threats |
|----|------------|---------|
| **M1** | **Pairing system**: Unknown users get zero response. Admin receives OTP pairing request. Paired users stored in SQLite with status, created_at, last_seen. `/pair revoke` to remove. | T4 |
| **M2** | **Capability-based tool allowlist**: Tools whitelist, not blocklist. Unknown tools cannot be invoked. | T1, T9 |
| **M3** | **Dangerous tool approval**: Tools flagged as dangerous require action plan + admin OTP approval before execution. | T1, T3, T9 |
| **M4** | **Loop limits**: Max iterations (configurable, default 10), max tool calls per turn (default 5), per-turn timeout (default 120s), max output size (default 100KB). | T1, T9 |
| **M5** | **Secret handle system**: LLM sees only `secret://<id>`. Resolver decrypts JIT at tool execution. Secrets never in logs, traces, errors, or prompts. | T2 |
| **M6** | **Output scrubbing**: All outbound messages and log entries scanned for known secret patterns. Matches redacted or blocked. | T2 |
| **M7** | **Structured logging**: Pino with mandatory redaction. Tool arguments containing file paths, URLs, or potential secrets are sanitized. | T3 |
| **M8** | **Docker sandbox**: Non-root (`USER 1000`), `--cap-drop ALL`, `--security-opt no-new-privileges`, read-only root FS, only `/data` writable, default network DENY outbound. | T3, T6 |
| **M9** | **Supply-chain hardening**: `pnpm audit` in CI, lockfile required, no postinstall scripts in production deps, pinned base images with digest verification. | T5 |
| **M10** | **No exposed ports**: Telegram uses outbound-only long polling. Local IPC (127.0.0.1) disabled by default. No inbound HTTP/WS listeners. | T7 |
| **M11** | **Key protection**: `.env` file permissions `600`; master key as environment variable only (not in config files); full-disk encryption recommended on host. | T8 |

---

## 6. Residual Risks

| Risk | Severity | Notes |
|------|----------|-------|
| **Prompt injection at model level** | HIGH | No technical solution exists. Mitigated by blast radius reduction (sandbox + tool gates). |
| **Telegram API compromise** | LOW | Out of scope — Telegram's infrastructure is external. |
| **LLM provider data retention** | MEDIUM | Prompts sent to Anthropic may be stored per their data policy. Use data retention opt-out where available. |
| **Host-level compromise** | MEDIUM | If the host OS is compromised, all bets are off. Out of scope for application-level security. |
