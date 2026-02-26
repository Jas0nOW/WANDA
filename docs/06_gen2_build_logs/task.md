# Wanda Gen-2 Memory System Design

- [x] Research Agent Zero memory system (GitHub/Docs)
- [x] Research OpenClaw memory system (GitHub/Docs)
- [x] Research Cursor and Windsurf memory characteristics
- [x] Research state-of-the-art agent memory (e.g. MemGPT, Knowledge Graphs, vector DBs)
- [x] Analyze strengths and weaknesses of existing solutions
- [x] Synthesize a Gen-2 memory architecture for Wanda
- [x] Create `implementation_plan.md` for Wanda's memory system

# Wanda Feature Expansion & Workspace Procedure
- [x] Draft ADR-0002: Architectural mapping for 68 features (Modular without breaking core)
- [x] Draft Workspace Procedure Specification (Github/Work-OS layout handling)
- [x] Update `implementation_plan.md` with feature breakdown and module integration strategy

# Gen-2 Feature Research & Architecture Planning
- [x] Research Gen-2 Multi-Channel Router architecture (Telegram, Discord, WebChat)
- [x] Research Always-On Voice & Speech loop (Whisper + ElevenLabs)
- [x] Research OpenRouter Failover, Local LLMs, Streaming
- [x] Research User-Centric UX & Dashboard design for Agent Control Centers
- [x] Draft Gen-2 architecture for Channels, Voice, LLMs, and UI
- [x] Extend `implementation_plan.md` with detailed implementation steps for these areas

# Final Research Phase: Proactive, Swarms & UX
- [x] Research Proactive Behavior (Cron vs Event-driven Heartbeats, Recommendations)
- [x] Research Agent Architecture (Tool Loops, Swarms, Agent-to-Agent Comms, Mesh Workflows)
- [x] Research UX & UI (Smooth Streaming, Live Canvas, Observability/Usage Tracking)
- [x] Counter-Research critical architectural decisions (e.g. Swarm scaling limits, Streaming UX challenges)
- [x] Synthesize findings into `wanda_gen2_architecture_pt2.md`
- [x] Finalize `implementation_plan.md` with all remaining features

# Execution Phase 1: Core Foundation & Strict Testing
- [x] Establish `Workspace-MCP` (File Sandbox) with 100% passing boundary tests
- [x] Establish `AgentBus` (Multi-Channel Router) with 100% passing schema tests
- [x] Ensure 1-2 year maintainability via global `pino` structured logger and precise `zod` errors

# Execution Phase 2: Core Loop Integration
- [x] Refactor `runAgentLoop` wrapping via `bus.onInbound`
- [x] Interface WebChat & Telegram adapters to emit/receive on `AgentBus`
- [x] Enforce typed validation for cross-channel OutboundMessages

# Execution Phase 3: Unified Core Memory
- [x] Implement Tier-2 SQLite GraphManager (`graph_manager.ts`)
- [x] Implement Tier-3 Markdown JournalManager (`journal_manager.ts`)
- [x] Implement Tier-4 Supabase ArchiveManager (`archive_manager.ts`)
- [x] Implement Memory MCP Tool bindings (`mcp_server.ts`)
- [x] Implement Janitor Agent for memory decay & consolidation (`janitor_agent.ts`)

# Execution Phase 4: WANDA Hub MCP Host
- [x] Initialize `apps/wanda-hub` using Fastify or Express
- [x] Mount the `@wanda/memory` MCP Server via SSE endpoint
- [x] Mount the `@wanda/workspace-mcp` via SSE endpoint
- [x] Establish global `pino` logger and robust error middleware for the hub
- [x] Ensure the Hub can run continuously on `localhost:3000`

# Execution Phase 5: LLM Gateway & Swarm Engine
- [x] Implement `packages/providers/llm-gateway` using OpenRouter with Ollama fallback
- [x] Implement `packages/core/swarm-manager` to consume `AgentBus` events
- [x] Connect the Swarm Worker to the `@wanda/memory` and `@wanda/workspace-mcp` tools via the SSE Client
- [x] Implement the ReAct Loop (Thought -> Action -> Observation) for the Worker Thread

# Execution Phase 6: Frontends & The Remote Control
- [x] Implement `packages/channels/cli-adapter` for rapid local terminal testing
- [x] Implement `packages/channels/telegram-adapter` using `grammY` for outside access
- [x] Configure `apps/wanda-bot` to construct the `AgentBus`, attach `SwarmManager`, and run adapters
- [x] Connect the CLI Adapter to standard input/output and verify Agent Loop end-to-end

# Execution Phase 7: WebChat & Vox-Voice (The Senses)
- [x] Implement `packages/channels/webchat-adapter` to proxy AgentBus over WebSockets
- [x] Initialize frontend application `apps/wanda-webchat` (Vite/React)
- [x] Build a sleek conversational UI that consumes the webchat-adapter via WebSocket
- [x] Implement `packages/voice/vox-voice-sink` for experimental ElevenLabs audio output
