# Upstream Patterns & Security Hardening

> **Status:** Level 0 — Research complete  
> **Date:** 2026-02-23  
> **Sources:** OpenClaw docs (website + GitHub), Agent-Zero docs (website + GitHub)  
> **Rule:** Pattern extraction only — NO code reuse.

---

## 1. OpenClaw — What It Does Well (Strengths)

| Strength | Details |
|----------|---------|
| **Multi-LLM support** | 20+ built-in providers: Anthropic, OpenAI, Gemini (API key + Vertex + Antigravity OAuth), Ollama, vLLM, Mistral, Groq, OpenRouter, Moonshot/Kimi, etc. Provider refs use `provider/model` format. API key rotation supported (retry on 429). Custom OpenAI/Anthropic-compatible proxies via `models.providers`. |
| **Persistent memory** | Plain Markdown on disk (source of truth). Hybrid search: BM25 + vector embeddings. MMR re-ranking for diversity. Temporal decay for recency. Pre-compaction memory flush (silent agentic turn). Optional session transcript indexing. |
| **Voice support** | Audio/TTS nodes on macOS/iOS. Voice wake word detection. Talk mode with real-time STT → agent → TTS pipeline. Media understanding (images, audio, video). |
| **Large community skill ecosystem** | AgentSkills-compatible `SKILL.md` format. ClawHub marketplace (`clawhub.com`) for install/sync/update. 3-tier precedence: workspace > managed > bundled. Load-time gating via `metadata.openclaw.requires` (bins, env, config, OS). Per-agent session snapshots with hot reload. |
| **Proactive scheduling/check-ins** | Heartbeat system: periodic agent turns (default 30m). `HEARTBEAT.md` checklist in workspace. Active hours with timezone support. `HEARTBEAT_OK` response contract (silent ack). Per-agent, per-channel visibility controls. Manual wake via CLI. Cost-aware: cheaper model override for heartbeat runs. |
| **Gateway architecture** | Single daemon owns all messaging surfaces. Channel adapters decouple brain from transport. TypeBox schemas + JSON Schema for wire protocol. WebSocket with typed request/response/event frames. |
| **Security posture** | `openclaw security audit` CLI. Pairing-first identity. DM session isolation. Tool policy (allow/deny per agent). Sandbox modes (agent/session/shared). Log redaction. Credential storage map. Incident response runbook. |

## 2. OpenClaw — Weaknesses to Avoid

| Weakness | Risk | Wanda Mitigation |
|----------|------|-------------------|
| **Exposed web server instances** | Gateway HTTP+WS on port 18789 reported publicly accessible. Canvas host serves untrusted HTML/JS. | No inbound ports. Telegram long polling only. No HTTP server. |
| **Untrusted community skills** | ClawHub skills treated as "read before enabling." Reported malicious cases. npm install lifecycle scripts in plugin setup. | Skills = first-party config wrappers only. No marketplace. MCP-only integrations. |
| **High per-token API costs** | Heartbeat runs full agent turns every 30m. No token budgeting. Users report surprise bills. | Cost caps in config. Heartbeat uses cheaper model by default. Budget limits per session. |
| **Massive codebase** | Most users don't fully understand the system. Config reference alone is 75KB+. 700+ docs files. | Lean, auditable codebase. Every line is first-party. Docs match code 1:1. |

---

## 3. OpenClaw — Extracted Patterns

### 3.1 Gateway Architecture (Channel ↔ Brain Decoupling)

- Single long-lived Gateway daemon owns all messaging surfaces (Telegram via grammY, WhatsApp via Baileys, Discord, Slack, Signal, etc.).
- Control-plane clients connect via WebSocket on local bind (`127.0.0.1:18789`).
- Channels are adapters: each maps platform events into unified typed protocol.
- TypeBox schemas define protocol; JSON Schema generated from them.
- Idempotency keys required for side-effecting RPC methods.

**Pattern for Wanda:** Strict `ChannelAdapter` interface normalizing all inbound/outbound into typed events. Brain receives `InboundMessage`, never Telegram-specific types.

### 3.2 Explicit Event Loop + Tool Loop Safety

Agent loop pipeline: `intake → context assembly → model inference → tool execution → streaming reply → persistence`

Key hook points in OpenClaw:
- `message_received` / `message_sending` / `message_sent`
- `before_model_resolve` / `before_prompt_build`
- `before_tool_call` / `after_tool_call`
- `tool_result_persist`
- `session_start` / `session_end` / `agent_end`

Safety: `timeoutMs` (default 600s), `AbortSignal`, serialized per-session queue.

**Pattern for Wanda:** 6 essential typed lifecycle hooks. Max iterations, max tool calls, timeout enforced at runner level.

### 3.3 Pairing for Unknown Identities

- All clients include device identity on `connect`.
- New IDs → pairing approval required (admin issues device token).
- Pairing codes expire (1 hour), capped at 3 pending per channel.
- DM policies: `pairing` (default) | `allowlist` | `open` | `disabled`.

**Pattern for Wanda:** Bootstrap admin via `ADMIN_TELEGRAM_ID`. Unknown users get NO response. Admin receives OTP pairing request.

### 3.4 Sandbox Mount-Level Separation (ro/rw Boundaries)

- Docker sandbox: full gateway in Docker OR tool-sandbox (host gateway + Docker-isolated exec).
- Per-agent: `off` / `all`, scope: `agent` / `session` / `shared`.
- Workspace access: `none` / `ro` / `rw`.
- `tools.elevated` = escape hatch for host exec (tightly restricted).

**Pattern for Wanda:** Docker sandbox default. Non-root, dropped caps, no-new-privileges, read-only root FS, only `/data` writable, network DENY outbound.

### 3.5 Proactive Heartbeat Scheduling (Opt-in Autonomy)

- Periodic agent turns in main session (configurable interval, default 30m).
- `HEARTBEAT.md` in workspace = the agent's checklist (read every tick).
- Response contract: `HEARTBEAT_OK` = silent ack; anything else = alert delivered to channel.
- Active hours: `start`/`end` times with timezone; heartbeats skipped outside window.
- Per-agent heartbeats: only agents with `heartbeat` config run them.
- Visibility controls: `showOk`, `showAlerts`, `useIndicator` — per-channel overrides.
- Cost awareness: override model to cheaper variant; skip if `HEARTBEAT.md` is empty.
- Manual wake: `openclaw system event --mode now`.

**Pattern for Wanda (Level 5):** Opt-in heartbeat with `HEARTBEAT.md` checklist. Configurable interval + active hours. `HEARTBEAT_OK` contract. Safety gates apply to heartbeat turns too.

---

## 4. Agent-Zero — What It Does Well (Strengths)

| Strength | Details |
|----------|---------|
| **Strong project isolation** | `.a0proj` per project: `variables.env` + `secrets.env`. Isolated memory (separate vector DB per project). Knowledge base per project. Prevents context bleed. |
| **Clean lifecycle hook system** | Extensions in `python/extensions/` — ordered by filename prefix (`_10_`, `_20_`). Categories: message loop, memory management, system integration. Modular single-concern extensions. |
| **Local-first execution** | Docker-based runtime. No mandatory public server. Host runs only Docker + browser. Complete framework inside container. |
| **Transparent tool calls** | Structured output: `Thoughts:` + `Tool name:` + `Responses:`. User sees full chain-of-thought and tool usage. |
| **Smaller, auditable codebase** | Core Python in `/python/`. Key files: `agent.py`, `models.py`, `initialize.py`. Manageable for a single developer to understand fully. |

## 5. Agent-Zero — Weaknesses to Avoid

| Weakness | Impact | Wanda Mitigation |
|----------|--------|-------------------|
| **Smaller ecosystem** | Fewer integrations, community skills, third-party tools. | MCP integrations provide extensibility. First-party skills cover core use cases. |
| **No large-scale multi-agent hierarchy** | `call_subordinate` tool exists but no complex routing, load balancing, or agent mesh. | Agent Mesh planned for Level 9–10. Single-agent focus for Level 1. |
| **Less built-in proactivity** | No heartbeat, no scheduled check-ins, no background task monitoring. | Heartbeat system planned for Level 5. CronJobs for Level 6. |
| **Fewer integrated UI systems** | Web UI is functional but minimal. No TUI, mobile apps, or desktop integration. | No UI is a non-goal for now. Telegram is the primary interface. |
| **Less battle-tested at scale** | Smaller user base, fewer edge cases discovered. | Designed for single-user personal agent. Scale is not a v1 concern. |

---

## 6. Agent-Zero — Extracted Patterns

### 6.1 Project-Scoped Workspaces (`.a0proj`)

- `variables.env` (non-sensitive config) + `secrets.env` (sensitive credentials).
- Memory isolation: project-specific vector DB.
- Knowledge base: per-project custom documents auto-indexed.

**Pattern for Wanda:** Future workspace isolation per project/agent. Secret scoping at project level.

### 6.2 Lifecycle Hooks (`message_start`, `before_tool_exec`, `after_tool_exec`)

- Extensions ordered alphabetically (prefix-numbered).
- Hook into: message loop, memory recall, solution memorization, system integration.
- Behavior adjustment tool: agents self-modify behavior rules stored in `behaviour.md`.

**Pattern for Wanda:** Typed async hook functions registered at boot. Not file-ordered scripts. 6 essential hooks for v1.

### 6.3 Layered Memory (Episodic vs Semantic)

- Four types: Conversation, Knowledge Base, Learning, Project.
- Vector embeddings with configurable similarity threshold.
- Utility model for summarization + memory extraction.
- Dynamic context compression: recent = full, older = summarized.

**Pattern for Wanda:** Episodic (per-session) + Semantic (facts/vectors) layers. Level 2 deep implementation.

### 6.4 Sandboxed Tool Execution

- Entire framework runs in Docker container.
- Code execution (Python, Node.js, Shell) inside the container.
- `/a0` is framework root; data persists in container.
- Backup & Restore for upgrades.

**Pattern for Wanda:** Docker default for tool sandbox. Tool execution isolated from host.

### 6.5 Local-First Orchestration Loop

- Docker container + web browser on host. No cloud dependency.
- SearXNG for privacy-focused search (replaces DuckDuckGo/Perplexity).
- All data local: memory, knowledge, chat logs, secrets.

**Pattern for Wanda:** Local-first is default. Cloud providers explicitly enabled. All state in `/data`.

---

## 7. Security Risks to Harden Against

### 7.1 Prompt Injection

Attackers craft messages manipulating the model into unsafe actions.

**Wanda mitigations:** Pairing + allowlists. Tool policy (allow, not blocklist). Dangerous tools need admin OTP. Sandbox for all tool execution. Instruction-hardened frontier models. Untrusted content tagged in context.

### 7.2 Secret Exfiltration

LLM tricked into outputting API keys or config contents.

**Wanda mitigations:** LLM sees only `secret://<id>` handles. Resolver decrypts JIT at tool execution. Secrets never in logs, traces, errors, prompts. Encrypted at rest (AES-256-GCM). Output scrubbing for known patterns.

### 7.3 Tool Overreach

Agent executing destructive commands without authorization.

**Wanda mitigations:** Capability-based allowlist. Dangerous tools: action plan → admin `/approve <otp>`. Hard limits: max iterations, max tool calls, timeout, max output size. Docker sandbox default.

### 7.4 Supply-Chain Attacks

Malicious dependencies, community scripts, compromised MCP servers.

**Wanda mitigations:** No untrusted script execution — MCP-only integrations. Skills = config wrappers. `pnpm audit` in CI. Lockfile enforcement. Pinned base images.

---

## 8. DO NOT COPY List

| Rule | Rationale |
|------|-----------|
| **No upstream code reuse** | Cleanroom implementation. Patterns only. |
| **No arbitrary community scripts** | All code is first-party or allowlisted MCP. |
| **No third-party skill files** | Skills = config wrappers, not executable code. |
| **No exposed inbound HTTP ports** | Telegram long polling; no webhook listener. |
| **No Canvas/web host in core** | No untrusted HTML/JS served from daemon. |
| **No secrets in plaintext config** | Encrypted at rest; `secret://` handles only. |
| **No public web UI** | No inbound ports; local IPC only. |
| **No `.env` for API secrets** | `.env` for bootstrap config only; secrets in encrypted store. |
