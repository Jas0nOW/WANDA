# Wanda-Repo

Core orchestration backend for WANDA (providers, OAuth, routing, channels, memory, tools).

## Quick Start

```bash
pnpm install
pnpm run typecheck
pnpm run test
pnpm run wanda -- auth status
```

## Debug Mode

```bash
pnpm run debug:bot
pnpm run wanda -- doctor
pnpm run wanda -- test model "ping"
```

`LOG_LEVEL=debug` aktiviert detaillierte Runtime-Logs.

## Validation

```bash
pnpm run validate:basics
```

## Docs

- `docs/00_overview/PROJECT.md`
- `docs/04_plan/TASKS.md`
- `docs/04_plan/MILESTONES.md`
- `docs/04_plan/HANDOFF.md`
