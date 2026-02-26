# ADR-0002: Modular Mapping of 68 Features and Workspace Procedure

> **Status:** Accepted  
> **Date:** 2026-02-26  
> **Decision makers:** Jannis (admin), Wanda Agent (architect)

---

## Context

The system has been tasked with implementing 68 new features alongside a strict "Github/Work-OS Workspace Procedure" for directory maintenance and file management. Based on [ADR-0001](./ADR-0001.md), no new dependencies or changes should break the core codebase, and all tool interactions must run through a secure, modular pipeline (e.g., proper packages or MCP bridges).

This document establishes how we will iterate on the 68 features system-wide without violating existing core boundaries.

---

## Decisions

### D1: The Github Workspace Procedure as a Core MCP Server
**Decision:** The entire `work-os/` navigation, reading, and structural enforcement will not be hardcoded into the Agent Loop. Instead, we implement a dedicated `Workspace_Manager` MCP Server (in `packages/tools` or as an external localized MCP service on `localhost:3000`).

**Rationale:**
- **Decoupled Logic:** The agent interacts with `work-os/` by calling `mcp_workspace_read`, `mcp_workspace_write`, and `mcp_workspace_analyze`.
- **Enforced Structure:** The MCP server itself strictly enforces the folder hierarchy (e.g., `business/`, `personal/`, `memory/`, `AGENTS.md`). Any attempt by the LLM to write outside of predefined folders (or create misnamed files) is automatically rejected by the MCP tool.
- Maintains compliance with `ADR-0001` (D8: MCP-Only Integrations).

**Consequence:** The core bot logic remains completely ignorant of the file system structure; it relies purely on the MCP server descriptions to navigate the Work-OS tree.

---

### D2: Grouping the 68 Features into Functional Packages
**Decision:** We categorize the 68 requested features into distinct `packages/` workspaces to avoid scope creep and monolithic files.

1. **`packages/channels` mapping:**
   - Features 1-6 (Telegram, Discord, iMessage, WebChat UI, Gmail, Multi-Channel).
   - Each gets its own adapter conforming precisely to the `ChannelAdapter` typescript interface defined in ADR-0001.
2. **`packages/voice` (New Modular Package):**
   - Features 7-12 (Whisper, Wake Word, Talk Mode, ElevenLabs).
   - Operates as a background process or adapter that converts audio buffers into `InboundMessage` strings for the brain, entirely decoupled from the core text loop.
3. **`packages/memory` & `packages/providers` mapping:**
   - Features 13-27 (SQLite, Knowledge Graph, Supabase, LLM Providers, Unified Auth).
   - Designed around the Gen-2 Unified Core Memory Architecture.
4. **`packages/tools` and External MCPs:**
   - Features 28-35 (Browser, Web Search, Exec, Schedulers).
   - All implemented exclusively via MCP. No direct library imports into `wanda-bot` root.
5. **`apps/wanda-bot` Application Layer:**
   - Features 36-39 (Morning Briefing, Evening Recap) and 49-60 (Docker Deploy, Telemetry).
   - Driven via strictly-timed cron payloads injecting synthetic `InboundMessage` objects to the brain.

---

### D3: Professional Repo Management (Feature 62)
**Decision:** Every new module or package must include an ADR, a strict `.md` specification in `docs/05_specs/`, and follow standard Git workflows. Implementation happens transparently as Pull Requests/Branches managed by the `gh` CLI.

**Rationale:**
- Directly fulfills the "Github Workspace Procedure" rule.
- Ensures the user ("Jannis") has "Easy Oversight" (Feature 65) before a PR is merged into `main`.

---

### D4: Master Control Center (MCC) Integration
**Decision:** The system will deeply integrate with the existing `Wanda-MCC` repository (`/home/jannis/Schreibtisch/Work-OS/40_Products/Wanda-MCC/`) and WebChat UI. 
- The MCC will act as the single pane of glass for monitoring, memory management, and configuration via the newly added `settings.json`.
- Communication between `Wanda-Repo` (the brain) and `Wanda-MCC` (the dashboard) will happen via a strictly typed, authenticated WebSocket or REST API bridge established in the `packages/channels/webchat-adapter`.

**Rationale:**
- Preserves the existing Work-OS frontend investment.
- Separates frontend Dashboard concerns from backend Brain concerns.
- Fulfills the "User-Centric UX" (Feature 65) by making all active state visible in the MCC.

---

## Consequences Summary

| Decision | Trade-off |
|----------|-----------|
| D1 (Workspace via MCP) | The LLM cannot use raw `fs` commands. It must use explicit MCP endpoints with built-in validation. |
| D2 (Modular Packages) | Increased boilerplate for new channels/tools, but zero risk of cascading failures. |
| D3 (Strict Repo Management) | Slower immediate execution, but extremely high reliability and Git audit trails. |

## Next Steps
1. The Workspace structure (`business/`, `personal/`, `memory/` etc.) will be templated via a setup script.
2. Feature subsets (e.g., Channels, Voice, Memory) will be implemented as modular workspace packages iterativley.
