<div align="center">

# WANDA

**Autonomous AI Operating Partner**

An open, modular AI system that doesn't just assist — it operates.
Built from first principles. Not a fork. Not a wrapper.

[![Status](https://img.shields.io/badge/status-active_development-brightgreen?style=for-the-badge)](./docs/04_plan/HANDOFF.md)
[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white)](./tsconfig.json)
[![License](https://img.shields.io/badge/license-MIT-green?style=for-the-badge)](./LICENSE)

</div>

---

## What is WANDA?

WANDA is an autonomous AI operating partner — a system that coordinates multiple AI agents, manages persistent memory, handles voice interaction, and executes real operational workflows.

Think of it as what comes after [OpenClaw](https://openclaw.ai/) and [Hermes](https://github.com/NousResearch/hermes-agent):

| | OpenClaw | Hermes | **WANDA** |
|---|---|---|---|
| **Architecture** | Stateless, session-scoped | Self-improving skill loop | Graph memory + modular subsystems |
| **Memory** | None | Full-text search + Honcho | 4-tier unified core (ephemeral → graph → journals → vector) |
| **Voice** | None | None | Native, OS-level (WebRTC + Whisper + ElevenLabs) |
| **Observability** | Logs | Logs | First-class — real-time MCC dashboard |
| **Learning** | None | Extract → refine → retrieve | Memory decay (FSRS) + knowledge graph traversal |

WANDA doesn't compete on simplicity. It competes on **depth**.

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
│     22 Specialized Agent Archetypes              │
├─────────────────────────────────────────────────┤
│           Hook System (ADR-0005)                 │
│   PreModelCall · PostModelCall · 13 Events       │
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
├── memory             # Long-horizon memory (mnemos integration)
├── voice              # Speech interaction (Vox-Voice integration)
├── providers          # LLM routing (Gemini, Anthropic, OpenAI, Ollama)
├── channels           # Multi-platform messaging adapters
├── tools              # MCP tool execution
├── secrets            # Credential management (Key Vault integration)
├── workspace-mcp      # Workspace MCP server
├── sandbox            # Isolated execution environment
└── shared             # Cross-package utilities
```

---

## Key Differentiators

### Graph Memory over Vector Similarity
Where others embed and search, WANDA traverses. A bi-temporal knowledge graph (SQLite) gives precision retrieval without the hallucination tax of approximate nearest neighbors.

### Voice-First, Not Voice-Added
WebRTC + Whisper + ElevenLabs baked at the OS layer. Voice isn't a plugin — it's a primary interaction channel with low-latency feedback loops.

### Hook System
Provider-agnostic middleware layer with 13 event types including `PreModelCall` and `PostModelCall` — hooks that OpenClaw and Hermes don't expose. Your logic runs before and after every LLM call.

### Full Observability
Every agent decision is traceable. The MCC (Mission Control Center) dashboard provides real-time transparency into what your agents are doing and why.

### Modular by Design
Each subsystem ships independently:
- **[mnemos](https://github.com/WandaSystems/Memory_OS)** — Memory infrastructure
- **Vox-Voice** — Speech and voice stack
- **Key Vault** — Secret management

Use WANDA as a whole, or pick the modules you need.

---

## Quick Start

```bash
git clone https://github.com/WandaSystems/WANDA.git
cd WANDA
pnpm install
pnpm run typecheck
pnpm run dev
```

### Requirements
- Node.js 20+
- pnpm

---

## Agent Archetypes

WANDA ships with 22 specialized agent templates — each with defined responsibilities, tools, and workspace configurations. From CTO to Copywriter, from Scout-Research to Canary-Runtime-Audit.

These aren't chat personas. They're operational roles with scoped access, memory partitions, and execution boundaries.

---

## Documentation

| Area | Link |
|------|------|
| Project Overview | [docs/00_overview](./docs/00_overview/) |
| Architecture | [docs/02_architecture](./docs/02_architecture/) |
| ADRs | [docs/03_decisions](./docs/03_decisions/) |
| Gen-2 Build Logs | [docs/06_gen2_build_logs](./docs/06_gen2_build_logs/) |
| Specs | [docs/05_specs](./docs/05_specs/) |

---

## Status

Active development. Gen-2 routing backbone (LLM Gateway, AgentBus, OAuth) is operational. Memory, voice, and workspace layers are being integrated from their independent modules.

---

## Team

- **[Jannis S.](https://github.com/Jas0nOW)** — Founder & CEO
- **[Wanda](https://github.com/wanda-OS-dev)** — AI Operating Partner & Co-CEO

Built at [WandaSystems](https://github.com/WandaSystems).

---

## License

MIT — see [LICENSE](./LICENSE).
