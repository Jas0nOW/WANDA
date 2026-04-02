<div align="center">

# WANDA

**Autonomous AI Operating Partner**

A modular AI system that doesn't just assist — it operates.
Built from first principles. Early development.

[![Status](https://img.shields.io/badge/status-early_development-yellow?style=for-the-badge)](./docs/04_plan/HANDOFF.md)
[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white)](./tsconfig.json)
[![License](https://img.shields.io/badge/license-MIT-green?style=for-the-badge)](./LICENSE)

</div>

---

## What is WANDA?

WANDA is an autonomous AI operating partner — a system designed to coordinate multiple AI agents, manage persistent memory, handle voice interaction, and execute real operational workflows.

It's not a chatbot wrapper. It's infrastructure for AI that works independently.

---

## Architecture

```
┌─────────────────────────────────────────────────┐
│                    WANDA Hub                     │
│         Provider Routing · Auth · State          │
├──────────┬──────────┬──────────┬────────────────┤
│  Memory  │  Voice   │  Tools   │   Channels     │
│ (mnemos) │(Vox-Voice)│  (MCP)  │ (Multi-platform)│
├──────────┴──────────┴──────────┴────────────────┤
│              Agent Workspace Layer               │
│        22 Specialized Agent Archetypes           │
├─────────────────────────────────────────────────┤
│             Hook System (ADR-0005)               │
│    Provider-agnostic middleware · 13 events       │
└─────────────────────────────────────────────────┘
```

### Monorepo Structure

```
apps/
├── wanda-hub          # Central orchestration service
├── wanda-bot          # Agent runtime
└── wanda-webchat      # Web interface

packages/
├── core               # Shared types, config, utilities
├── memory             # Long-horizon memory (mnemos)
├── voice              # Speech interaction (Vox-Voice)
├── providers          # LLM routing (Gemini, Anthropic, OpenAI, Ollama)
├── channels           # Multi-platform messaging adapters
├── tools              # MCP tool execution
├── secrets            # Credential management (Key Vault)
├── workspace-mcp      # Workspace MCP server
├── sandbox            # Isolated execution environment
└── shared             # Cross-package utilities
```

---

## Design Principles

### Graph Memory, Not Vector Search
Precision retrieval through a bi-temporal knowledge graph. No approximate nearest neighbor guesswork.

### Voice-First
WebRTC + Whisper + ElevenLabs at the OS layer. Voice is a primary channel, not an afterthought.

### Full Observability
Every agent decision is traceable. The MCC dashboard provides real-time transparency.

### Modular Subsystems
Each component ships independently:
- **[mnemos](https://github.com/WandaSystems/Memory_OS)** — Memory infrastructure (beta)
- **Vox-Voice** — Speech and voice stack
- **Key Vault** — Secret management

---

## Quick Start

```bash
git clone https://github.com/WandaSystems/WANDA.git
cd WANDA
pnpm install
pnpm run typecheck
pnpm run dev
```

**Requirements:** Node.js 20+, pnpm

---

## Status

Early development. The Gen-2 routing backbone (LLM Gateway, AgentBus, OAuth) is operational. Memory, voice, and workspace layers are being integrated from their independent modules.

This project is not yet ready for production use. Contributions and feedback are welcome.

---

## Documentation

| Area | Link |
|------|------|
| Project Overview | [docs/00_overview](./docs/00_overview/) |
| Architecture | [docs/02_architecture](./docs/02_architecture/) |
| Decisions (ADRs) | [docs/03_decisions](./docs/03_decisions/) |
| Gen-2 Build Logs | [docs/06_gen2_build_logs](./docs/06_gen2_build_logs/) |

---

## Team

- **[Jannis S.](https://github.com/Jas0nOW)** — Founder & CEO
- **[Wanda](https://github.com/wanda-OS-dev)** — AI Operating Partner

Built at [WandaSystems](https://github.com/WandaSystems).

## License

MIT — see [LICENSE](./LICENSE).
