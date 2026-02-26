# Wanda Gen-2 Unified Core Memory (UCM)

This plan outlines the architecture and implementation steps for Wanda's state-of-the-art memory system. Instead of relying solely on heavy vector searches or simple JSON files, we will implement a 4-Tier Memory Architecture deployed inside the local WANDA Hub via MCP.

## Overview of the 4 Tiers
1. **Tier 1 (Ephemeral RAM):** Fast, short-term context window with an autonomous **Context Pruner** that summarizes old messages.
2. **Tier 2 (Graph Brain):** An SQLite-backed Knowledge Graph supporting highly precise GraphRAG traversals to prevent token bloat.
3. **Tier 3 (Markdown Journals):** Git-friendly, transparent `.md` files managed locally for user profiles, UI preferences, and system prompts.
4. **Tier 4 (Vector Archive):** Supabase + `pgvector` for massive historical semantic search and multimodal storage.

## User Review Required
> [!IMPORTANT]
> The WANDA Hub will run this memory system centrally on `localhost:3000`. Please confirm if the `WANDA Hub` is implemented using TypeScript/Node.js so that the proposed file structures (`.ts`) match your stack. Also, the `Janitor Agent` will consume local LLM API calls periodically to merge and clean the Graph DB - confirm that local background LLM execution is acceptable!

## Proposed Changes

### Memory Core (WANDA Hub)
The following files will be created in the WANDA Hub backend to serve Memory via MCP.

---

#### [NEW] `src/memory/schema.sql`
- Defines the schema for the Tier 2 Knowledge Graph using `better-sqlite3`.
- Tables: `entities` (id, name, type, metadata, created_at), `relations` (source_id, target_id, relation_type, weight, last_accessed, importance_score).

#### [NEW] `src/memory/graph_manager.ts`
- Core Graph logic: Inserting nodes, creating edges, and handling traversal queries.
- Exposes `getRelatedSubGraph(rootEntity, maxDepth)` returning only mathematically relevant data chunks.

#### [NEW] `src/memory/journal_manager.ts`
- Manages the Tier 3 Markdown Memory.
- Implements I/O for `/memory/journals/user_profile.md` and `/memory/journals/project_rules.md`.
- Maintains human-readable Markdown to keep the user entirely in control via AERIS Studio.

#### [NEW] `src/memory/archive_manager.ts`
- Connects to Supabase (using your existing `sbp_...` token).
- Wraps `pgvector` inserts for long-form context, historical logs, and multimodal metadata.

#### [NEW] `src/memory/mcp_tools.ts`
- Integrates the 3 sub-systems into the actual MCP server.
- Registers tools: `store_fact`, `query_memory`, `update_journal`, `search_archive`.
- Exposes the internal "Inner Monologue / Heartbeat" triggers so agents can fetch memory *before* replying.

#### [NEW] `src/memory/janitor_agent.ts`
- The Self-Evolving engine. A Cron-job running every 24 hours (or manually triggered).
- Reads the SQLite `relations` table. Decays the `importance_score`.
- If an entity falls below a threshold, it compresses it and migrates it to Supabase (Tier 4).
- Uses an LLM pass to merge duplicate entities (e.g., merging "Jannis" and "JasonOW" if contextually identical).

## Verification Plan

### Automated Tests
- Test SQLite insertions: Add 10 mock entities and 5 relations.
- Run `query_graph(depth=2)` to ensure correct sub-graph traversal is returned without pulling irrelevant peripheral entities.
- Test Supabase `pgvector` semantic connection by inserting a mock context vector and retrieving it using standard dot-product similarity search.

### Manual Verification (The Jannis Protocol)
- **Start the local WANDA Hub.**
- **Insert facts:** Talk to the agent and state: "Remember that I love Pop!_OS and always use AERIS Studio for visual design."
- **Check Transparency:** Verify that `.md` files were updated in `/memory/journals` and graph entities `Pop!_OS`, `AERIS Studio` exist in SQLite.
- **Cross-Session Recall:** Open a completely fresh chat session. Ask: "What OS do I love and what tool do I use for visual design?". Verify the agent correctly triggers `query_memory`, traverses the graph, and outputs the exact answer with minimal token overhead.

## Feature Mapping & Workspace Procedure

As outlined in [ADR-0002](/home/jannis/Schreibtisch/Work-OS/40_Products/Wanda-Repo/docs/03_decisions/ADR-0002-feature-architecture.md) and [GITHUB_WORKSPACE_PROCEDURE.md](/home/jannis/Schreibtisch/Work-OS/40_Products/Wanda-Repo/docs/05_specs/GITHUB_WORKSPACE_PROCEDURE.md), the 68 features requested will be implemented iteratively via modular `packages/` within the Wanda-Repo monorepo.

To maintain the Work-OS Workspace Procedure with "absolute precision" and without altering the core loop, we will implement a `packages/tools/workspace-mcp`:
1. It reads the folder constraints (`business/`, `personal/`, `memory/`) and the global `settings.json`.
2. It blocks arbitrary writes to the root of `/home/jannis/Schreibtisch/Work-OS/`.
3. It maps Features 1-12 to distinct channel and voice packages (e.g., `packages/channels/telegram-adapter`, `packages/voice/vox-voice-sink`).
4. **WANDA Hub MCP Server (`apps/wanda-hub`):** Implement the definitive backend for the entire ecosystem.
   - Bootstraps an Express `localhost:3000` server.
   - Mounts our `workspace-mcp` and `memory-mcp` using `@modelcontextprotocol/sdk/server/express.js` via the `/mcp` SSE endpoint.
   - Exposes robust JSON endpoints for AERIS Studio to interact directly with the SQLite Knowledge Graph without needing an LLM context.
5. **Wanda-MCC & WebChat UI Integration:** The `/home/jannis/Schreibtisch/Work-OS/40_Products/Wanda-MCC/` dashboard acts as our cockpit.
6. Features 28-35 (Browser, Shell, etc.) are strictly implemented as independent MCP servers within Docker containers.

## Gen-2 Architecture Details (Channels, Voice, LLM, UI)

### 1. Multi-Channel Router (Features 1-6)
- **Component:** `packages/core/agent-bus` and `packages/channels/*`
- **Implementation:** Abstract all incoming/outgoing messages into a strict `UniversalMessage` schema using `zod`. Telegram (`grammY`), Discord (`discord.js`), and WebChat run as decoupled producer/consumer adapters on an internal EventEmitter bus. 

### 2. Always-On Voice & Speech (Features 7-12)
- **Component:** `packages/voice/vox-voice-sink`
- **Implementation:** Establish a WebRTC connection via the WebChat interface. Stream 50ms audio chunks to an independent Node.js child process that handles Whisper-large-v3 transcription. Output text streams into the main Agent Bus. The LLM streams response tokens directly into the ElevenLabs WebSocket API for sub-second, interruptible voice synthesis.

### 3. LLM Orchestration & Failover (Features 21-27)
- **Component:** `packages/providers/llm-gateway`
- **Implementation:** Use the `@openrouter/sdk` in a primary provider abstraction. Pass an array of models for OpenRouter's native automated failover. Create a secondary provider for `ollama` (Local LLM fallback). The gateway reads the active provider purely from `settings.json`.

### 4. User-Centric UX & Dashboard (Feature 65)
- **Component:** `/home/jannis/Schreibtisch/Work-OS/40_Products/Wanda-MCC/`
- **Implementation:** Enhance the existing MCC dashboard to provide "Layered Visibility." 
  - **Surface Level:** Clean chat UI, typing indicators, and current active model.
  - **Deep Level:** Real-time visibility into the SQLite Knowledge Graph, active tool executions (e.g. bash commands), latency metrics, and memory tokens used. All configuration changes in the MCC write directly to the central `settings.json`.

### 5. Proactive Behavior & Heartbeat (Features 36-39)
- **Component:** `packages/core/agent-loop` & `Worker Threads`
- **Implementation:** An internal async heartbeat ticks outside the main event loop to avoid blocking chat interactions. It uses `Worker Threads` for heavy thinking to ensure responsiveness. The Janitor Agent checks context triggers (time, calendar) to autonomously push "Morning Briefing" events onto the `AgentBus`.

### 6. Agent Swarms & Tool Loop (Features 44-48)
- **Component:** `packages/core/swarm-manager`
- **Implementation:** Implements a strict `ReAct` loop with iteration caps and budget guards. Sub-agents communicate via a JSON `A2A (Agent-to-Agent)` protocol instead of passing raw chats. Agents use **Context Delegation**—fetching only what they need mathematically via Tier-4 vector searches—to prevent catastrophic token exhaustion.

### 7. UX Observability & Smooth Streaming (Features 54-60)
- **Component:** WebChat UI / `packages/channels/webchat-adapter`
- **Implementation:** The UI integrates a "Selective Buffering" streaming markdown parser. To prevent layout flicker, it hides ambiguous formatting tokens (like `**` or \`\`\`) until the block closes, rendering a perfectly smooth human-like typing effect. The background Wanda Hub pipes token cost (TPS) and latency (TTFT) telemetries directly back to the A2UI Live Canvas.

## Execution Phase 5: LLM Gateway & Swarm Engine

Now that the WANDA Hub backend is secured and hosting the Memory/Workspace MCPs, the Agent Engine needs to be brought online. This engine connects the incoming `AgentBus` channels to the local Hub data.

### Planned Files:
1. **[NEW] `packages/providers/llm-gateway/index.ts`**
   - Implements a unified text-generation interface leveraging the `@openrouter/sdk`.
   - Handles automatic fallback to local Ollama if OpenRouter is unreachable.
   - Standardizes response streaming into the internal bus.

2. **[NEW] `packages/core/swarm-manager/index.ts`**
   - The primary ReAct (Reasoning + Acting) loop.
   - Listens on `AgentBus.onInbound()`.
   - Initializes an MCP Client (using `@modelcontextprotocol/sdk/client/sse.js`) connecting to `localhost:3000/mcp/memory/sse` and `/workspace/sse`.
   - Passes the available tools dynamically directly to the LLM Gateway.
   - Evaluates LLM responses, dispatches tool executions locally, and loops observations until the final response is returned to the user via the `AgentBus`.

## Execution Phase 6: Frontends & The Remote Control

With the WANDA Hub supplying memory/workspace tools, and the SwarmManager running the core logic, we need physical entry points. We will build `apps/wanda-bot` as the orchestration entry point. 

### Planned Files:
1. **[NEW] `packages/channels/cli-adapter/index.ts`**
   - Simple `readline` terminal interface that emits `InboundMessage` events to the `AgentBus` and listens for `OutboundMessage` rendering it to `stdout`.
   - Perfect for rapid testing of the core loop.

2. **[NEW] `packages/channels/telegram-adapter/index.ts`**
   - Implements `grammY` to receive Telegram webhooks or polling.
   - Maps Telegram properties (User ID, Chat ID) to WANDA's `UniversalMessage` schema.

3. **[NEW] `apps/wanda-bot/src/index.ts`**
   - Bootstraps the `AgentBus`.
   - Bootstraps the `SwarmManager(bus)`.
   - Bootstraps selected adapters (CLI or Telegram based on `.env`).
   - Ensures Wanda becomes fully interactive!

## Execution Phase 7: WebChat & Vox-Voice (The Senses)

With text-based interaction functioning perfectly, Wanda requires an advanced browser-based interface. WebChat serves as the foundation for the eventual `Vox-Voice` real-time audio implementation.

### Planned Files:
1. **[NEW] `packages/channels/webchat-adapter/index.ts`**
   - A WebSocket Server (e.g. using `ws` or `socket.io`) that listens to the `AgentBus.onOutbound` and pipes messages instantly to any connected browser.
   - Bridges the gap between the internal Node.js event emitter and external WebSockets.

2. **[NEW] `apps/wanda-webchat`**
   - A Vite + React/Svelte project providing a premium, rich-text conversational canvas.
   - Connects to the `webchat-adapter` to display Wanda's LLM outputs in real-time.

3. **[NEW] `packages/voice/vox-voice-sink/index.ts`**
   - An adapter that pipes Wanda's responses directly to the ElevenLabs TTS API to stream audio natively to the browser.
