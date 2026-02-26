# GITHUB/WORK-OS WORKSPACE PROCEDURE

## 1. Overview
The **Work-OS Workspace** is the core functional directory structure that acts as Wanda's external brain and execution environment. To ensure predictability, security, and clean management ("Github Workspace Procedure"), Wanda agents must interact with this structure using a strict set of rules mapped via decoupled MCP endpoints.

## 2. Directory Matrix

Any file manipulation MUST fit explicitly within this matrix. Root-level pollution is forbidden.

```text
/home/jannis/Schreibtisch/Work-OS/
├── business/               # Strategic Second Brain (AERIS, Strategies, Ops)
│   ├── strategy/
│   ├── Wanda/
│   ├── coding/
│   ├── copywriting/
│   ├── metrics/
│   └── journal/
├── personal/               # Private goals and lifestyle
│   ├── biology/
│   ├── finances/
│   └── journal/
├── memory/                 # Agent raw data logs (DD-MM-YYYY.md)
├── AGENTS.md               # Active Sub-Agent Configuration
├── BOOT.md                 # Startup Checks
├── HEARTBEAT.md            # System Logs
├── IDENTITY.md             # Core AI Persona
├── MEMORY.md               # Long-term knowledge index
├── TOOLS.md                # CLI Tools / API Integrations list
├── USER.md                 # Jannis Context
└── settings.json           # Zentrale Konfigurationsdatei für alles an Wanda
```

## 3. Strict Rules of Engagement

1. **Root Lockdown:** Agents are *not* permitted to create new directories at the root level of `Work-OS`. New topics must be categorized into existing `business/` or `personal/` subfolders.
2. **Markdown Supremacy:** Whenever possible, knowledge states are saved as `.md` files. This allows absolute transparency, Github integration, and manual edits from the user inside AERIS Studio.
3. **No Direct `fs` Access:** Code modules do not use raw `fs.writeFileSync(...)` to handle Work-OS concepts. They invoke the internal Workspace MCP client (`mcp_workspace_write`), which sanitizes the input and validates the file path against the matrix above.
4. **Git-Driven Validation:** 
   - Before major changes are made to the directory architecture or code, the agent creates a Github Issue or Branch.
   - Example: Implementing the Telegram Channel involves branching (`feat/telegram-channel`), adding the package logic, and opening a PR.
5. **Central Configuration:** Any global parameters, API keys (via reference), or feature flags must be read from `settings.json`. It acts as the central truth for operational config, manageable entirely through the Wanda-MCC.

## 4. Integration with the 68 Features
As Wanda implements the 68 target features, they act *on* this workspace, but do not *alter* its underlying philosophy:
- **Features 1-6 (Channels):** Read configuration from `AGENTS.md` and `IDENTITY.md`.
- **Features 13-20 (Memory):** Read and append to `memory/DD-MM-YYYY.md` and `MEMORY.md`. The Gen-2 Graph memory runs silently alongside this, with the Markdown serving as the transparent human interface.
- **Features 36-39 (Proactive Behavior):** Scan `business/journal/` or `personal/journal/` to compile the Morning Briefing.

## 5. Security Posture
All access is restricted to `/home/jannis/Schreibtisch/Work-OS/`. 
Attempts to read `~/.ssh`, `/etc`, or navigate up `../` via relative pathing will trigger an immediate hard halt by the Sandbox layer.
