<div align="center">

# WANDA Central Hub

**Core orchestration backend for the WANDA ecosystem**

[![Status](https://img.shields.io/badge/status-active-brightgreen)](./docs/04_plan/HANDOFF.md)
[![Node](https://img.shields.io/badge/node-20%2B-green)](./package.json)
[![Package Manager](https://img.shields.io/badge/pnpm-workspace-orange)](./pnpm-workspace.yaml)
[![License](https://img.shields.io/badge/license-MIT-green)](./LICENSE)

</div>

WANDA is a service-oriented orchestration hub that connects model providers, tool execution (MCP), auth bridges, and persistent memory for the rest of the ecosystem.

## Core Responsibilities

- Provider routing (Gemini, Anthropic, OpenAI, Ollama)
- Tool execution through MCP integrations
- Authentication flows and bridge handling
- Shared memory and state handoff across products

## Monorepo Structure

| Path | Purpose |
| --- | --- |
| `apps/` | Runtime applications and entry services |
| `packages/` | Shared packages/utilities |
| `scripts/` | Debug, validation and operational scripts |
| `docs/` | Project overview, roadmap, handoff, operations |
| `data/` | Local runtime data (ignored for production hygiene) |

## Quick Start

```bash
pnpm install
pnpm run typecheck
pnpm run test
pnpm run dev
```

## Operational Commands

```bash
pnpm run validate:basics
pnpm run debug:bot
pnpm run wanda -- doctor
pnpm run wanda:auth:status
```

## Documentation

- [Project Overview](./docs/00_overview/PROJECT.md)
- [Tasks](./docs/04_plan/TASKS.md)
- [Milestones](./docs/04_plan/MILESTONES.md)
- [Handoff](./docs/04_plan/HANDOFF.md)

## Security and Governance

- Keep `.env` and auth material local only
- Validate provider/auth status before deployment
- Run `validate:basics` before merging to main

## License

MIT. See [LICENSE](./LICENSE).
