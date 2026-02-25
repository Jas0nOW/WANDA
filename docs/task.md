# Wanda — Level 0 + Level 1

## Level 0 — Research & Documentation
- [x] Research OpenClaw architecture patterns (gateway, agent loop, hooks, memory, security, sandboxing)
- [x] Research Agent-Zero architecture patterns (hierarchy, workspaces, memory, skills, extensions, secrets)
- [x] Write `/docs/01_research/UPSTREAM_PATTERNS.md`
- [x] Write `/docs/02_architecture/THREAT_MODEL.md`
- [x] Write `/docs/03_decisions/ADR-0001.md`
- [/] Review with Jannis

## Level 1 — Foundation (status snapshot 2026-02-25)
- [x] Initialize monorepo (pnpm workspace, tsconfig, eslint, prettier)
- [x] `packages/shared` — types, config, logger (pino)
- [x] `packages/secrets` — encrypted secret store + `secret://<id>` resolver
- [x] `packages/core` — lifecycle hooks, agent loop, loop limits
- [x] `packages/channels` — channel adapter interface + Telegram (grammy, long polling)
- [x] `packages/providers` — LLM provider interface + Anthropic adapter
- [x] `packages/tools` — tool registry (zod schemas) + `get_current_time`
- [x] `packages/memory` — SQLite + FTS5 stub (Level 2 deep impl)
- [x] `packages/sandbox` — Docker runner config
- [x] `apps/wanda-bot` — entry point, Dockerfile, docker-compose
- [x] Pairing system (admin bootstrap, OTP, SQLite store)
- [x] Tests erweitern: pairing silence + secret redaction + memory/sandbox smoke
- [x] CI (GitHub Actions lint + test) via `.github/workflows/ci.yml`
- [x] Verification baseline (`pnpm run validate:basics`) erfolgreich
- [x] Manual walkthrough (admin pairing flow end-to-end) via Ops-Runbook + automatischer Baseline
