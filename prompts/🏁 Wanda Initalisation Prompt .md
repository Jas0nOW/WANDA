# Wanda — Cleanroom Prompt v1.0 🦞➡️🧠

You are my **Senior Staff Engineer + Security Engineer + Systems Architect**.

Your job is to build **Wanda** — a cleanroom, modular, secure, local-first personal AI agent inspired by architectural patterns from **OpenClaw** (formerly ClawdBot/Moltbot) and **Agent-Zero**.

**Goal:** prevent “80–90% development hell” by encoding constraints into **types, policies, tests, CI, ADRs, and runbooks from day 1**.

---

# 0) Ground truth first (MANDATORY, before code) 🔎

Study *patterns* (NOT code reuse) from upstream local-first agent systems.

## Primary research sources

1. Official GitHub repositories (first pass mandatory)
2. Official documentation
3. Local scraped documentation (if GitHub context is insufficient)

Local scraped Web-pages:documentation available:

Agent-Zero docs: 
/home/jannis/Schreibtisch/Work-OS/40_Products/Wanda-DocScraper/output/agent-zero_docs/

OpenClaw docs:
/home/jannis/Schreibtisch/Work-OS/40_Products/Wanda-DocScraper/output/openclaw_docs/

These are reference material only.  
Do NOT reuse upstream code. Extract architectural patterns only.

---

## OpenClaw (concepts + research tasks)

Study:
- GitHub repo (`github.com/openclaw/openclaw`)
- Messaging channels
- Agentic tool loop
- Memory system
- Skills system
- Proactive heartbeat

Understand what it does well:
- Multi-LLM support
- Persistent memory
- Voice support
- Large community skill ecosystem
- Proactive scheduling/check-ins

Understand weaknesses to avoid:
- Exposed web server instances reported publicly
- Untrusted community skills (reported malicious cases)
- High per-token API costs reported by users
- Massive codebase that most users do not fully understand

Extract patterns:
- Gateway architecture (channels decoupled from brain)
- Explicit event loop + tool loop safety
- Pairing for unknown identities
- Sandbox mount-level separation (ro/rw boundaries)
- Proactive heartbeat scheduling (opt-in autonomy)

---

## Agent-Zero (concepts + research tasks)

Study:
- GitHub repo (`github.com/frdel/agent-zero`)
- Project-scoped workspaces (`.a0proj`)
- Lifecycle hooks (`message_start`, `before_tool_exec`, `after_tool_exec`)
- Layered memory (episodic vs semantic)
- Sandboxed tool execution
- Local-first orchestration loop

Understand what it does well:
- Strong project isolation
- Clean lifecycle hook system
- Local-first execution (no mandatory public server)
- Transparent tool calls
- Smaller, auditable codebase

Understand weaknesses:
- Smaller ecosystem
- No large-scale multi-agent hierarchy by default
- Less built-in proactivity
- Fewer integrated dashboards/UI systems
- Less battle-tested at very large scale

---

## Required Output (before any production code)

Create:

1. `/docs/01_research/UPSTREAM_PATTERNS.md`
   - What OpenClaw does well
   - What Agent-Zero does well
   - Security risks to harden against:
     - Prompt injection
     - Secret exfiltration
     - Tool overreach
     - Supply-chain attacks
   - “DO NOT COPY” list:
     - No upstream code reuse
     - No arbitrary community scripts
     - No third-party skill files

2. `/docs/02_architecture/THREAT_MODEL.md`
   - Assets
   - Actors
   - Trust boundaries
   - Threats
   - Mitigations

3. `/docs/03_decisions/ADR-0001.md`
   - Core architectural boundaries
   - Security rationale

No production code before these documents exist.

---

# 1) What we are building 🧱

A **lean, secure, fully-understood system** — not a fork.

Wanda is:
- Telegram-first
- Expandable to Discord
- Later expandable to WhatsApp
- Core logic never rewritten for new channels

---

## Key goals

- Cleanroom implementation
- Modular provider interfaces (LLM/STT/TTS/Search/Tools/Channels/Skills/CronJobs/AgentMesh/Models)
- Local-first execution + storage
- Strong sandboxing (Docker default)
- Secret handle system
- Agentic tool loop with safety gates
- Multi-agent capable (Agent Mesh)
- Open-source repo quality from day 1
- Integrations via MCP
- Wanda is **OAuth Compatible** over all providers simillar to most AI tools today

---

## Non-goals (for now)

- No public web UI
- No exposed inbound ports
- No arbitrary host code execution
- No skills marketplace

---

# 2) Non-negotiable security rules 🔒

## Consistency rules (apply everywhere)

- `.env` is allowed ONLY for:
  - Bootstrap configuration
  - Secrets master key
- Actual provider/API secrets must be stored encrypted at rest in `/data/secrets.*`
- Secrets must be accessed via `secret://<id>` handles only
- Local-first means local providers are default; cloud providers must be explicitly enabled
- “Skills” are first-party wrappers around allowlisted tools/MCP only

---

## 2.1 Identity & Pairing

Implement strict pairing.

Bootstrap admin via:
- `ADMIN_TELEGRAM_ID`
- `ADMIN_TELEGRAM_CHAT_ID`

Unknown user:
- Must receive NO response
- Admin receives pairing request with:
  - user_id
  - username
  - timestamp
  - OTP

Pairing:
- `/pair approve <otp>`
- Store in SQLite:
  - status
  - created_at
  - last_seen
- `/pair revoke <user_id>`

---

## 2.2 No exposed ports

- Telegram uses long polling
- No public HTTP endpoints
- Local IPC binds to `127.0.0.1` only
- Disabled by default

---

## 2.3 Secret Handle Resolver 🔐

- LLM sees only `secret://<id>`
- Tool runner resolves secrets just-in-time
- Secrets must never appear in:
  - logs
  - tool outputs
  - traces
  - errors
  - prompts

Secrets stored encrypted at rest:
- SQLCipher OR libsodium/age
- Master key: `WANDA_SECRETS_MASTER_KEY`

Hard tests required:
- Secret value must never appear anywhere

---

## 2.4 Tool safety & confirmations

- Capability-based allowlist
- Dangerous tools require:
  1. Action plan
  2. `/approve <otp>`

Hard limits:
- max loop iterations
- max tool calls
- timeouts
- max output size
- rate limits

---

## 2.5 Zero-trust sandbox 🐳

Docker default:
- non-root
- dropped caps
- no-new-privileges
- read-only root filesystem
- only `/data` writable

Workspace:
- Mount only `/workspace/<project_id>`
- Core mounted read-only or not at all

Network:
- Default DENY outbound
- Allowlist per tool if required

---

## 2.6 MCP-only integrations

- No untrusted script execution
- All integrations via allowlisted MCP servers

---

# 3) Architecture principles

Lifecycle hooks:
- on_message_received
- before_llm
- after_llm
- before_tool_exec
- after_tool_exec
- on_error

Modules:
- Adapters
- Providers
- Tool registry (zod schemas)
- Sandbox runner
- Memory layer
- Secrets module

---

# 4) Tech stack

- Node.js >= 22
- TypeScript strict (ESM)
- pnpm workspaces
- grammy (Telegram)
- @anthropic-ai/sdk
- better-sqlite3 + FTS5
- zod
- pino
- vitest
- eslint + prettier
- GitHub Actions
- lockfile required
- pnpm audit

Voice (Level 3):
- Default STT: local (e.g. faster-whisper)
- Optional: OpenAI Whisper API
- Default TTS: Edge-Seraphina or local
- Optional: ElevenLabs

Dev:
- tsx
- npm run dev
- pnpm dev

---

# 5) Repo structure (monorepo)

/  
  README.md  
  LICENSE  
  SECURITY.md  
  CONTRIBUTING.md  
  CODE_OF_CONDUCT.md  
  CHANGELOG.md  
  pnpm-workspace.yaml  
  package.json  

  /docs  
    /00_overview  
    /01_research  
    /02_architecture  
    /03_decisions  
    /04_plan  
    /05_specs  
    /runbooks  

  /apps  
    /wanda-bot  
      Dockerfile  

  /packages  
    /core  
    /channels  
    /providers  
    /memory  
    /secrets  
    /tools  
    /sandbox  
    /shared  

  /scripts  

---

# 6) Build levels

Level 0 — Research + docs  
Level 1 — Foundation  
Level 2 — Memory  
Level 3 — Voice  
Level 4 — Tools + MCP  
Level 5 — Heartbeat (opt-in proactivity)  
Level 6 — CronJobs (scheduled automation; same safety gates)  
Level 7 — Alerts & Notifications  
Level 8 — Skills & Tooling (first-party only)  
Level 9 — Agent Builder (scoped agent creation + permissions + with build in questions for maximize outcome)  
Level 10 — Agent Management (lifecycle, audits, revocation)

---

## Level 1 Requirements

- Telegram long polling
- Pairing system
- Basic LLM loop
- One safe tool: `get_current_time`
- Tool registry + zod validation
- Loop limits
- Structured logging
- Secret handle system end-to-end
- Docker (no ports)
- `/data` volume
- `npm install && npm run dev` works
- `pnpm dev` works
- `docker compose up --build` works

Tests:
- pairing silent behavior
- loop iteration limit
- secret redaction

---

# 7) Output rules

For Level 0 + Level 1:
- Provide full repo tree
- Provide key files
- Update milestones + ADR
- Provide exact run commands
- No fake features
- If deferred: stub + skipped test + justification

---

# 8) EXECUTE ▶️

Start with Level 0.  
Then Level 1.

All constraints must be encoded in:
- Types
- Policies
- Tests
- CI