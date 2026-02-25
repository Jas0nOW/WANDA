<div align="center">
  <h1>🧠 WANDA Central Hub</h1>
  <p><strong>The Core Orchestration Engine for the Dezentralized Jannis AI Ecosystem.</strong></p>
  <a href="https://github.com/Jas0nOW/WANDA">View Repository</a>
</div>

---

WANDA (The Brain & Hands) is a stateless, decentralized microservice-based AI orchestrator built on Node.js/TypeScript. It serves as the intelligent backend handling Model Providers, Tool/Skill Execution via MCP, Routing, and Authentication (OAuth Bridge) for the entire ecosystem (including AERIS, Vox-Voice, and Wanda-Bots). 

Unlike a monolithic AI agent, WANDA is designed to run silently in the background (`localhost:3000`), executing commands securely and persisting knowledge globally.

## 🚀 Key Features

- **Microservice Architecture:** Acts as the central hub connecting all other WANDA ecosystem products.
- **Provider Abstraction:** Unified interface for Gemini, Anthropic, OpenAI, and local Ollama models.
- **OAuth Identity Bridge:** Implements a true Google OAuth2 flow (Authorization Code Flow + PKCE) for Gemini, completely avoiding API key costs, tailored for Jannis' Google One AI Pro subscription.
- **MCP Provider (Model Context Protocol):** Exposes up to 18 State-of-the-Art tools (Kraken, Supabase, n8n, Stripe, Jina, ast-grep, Tavily, Context7) natively to connected AI interfaces.
- **Persistent Global Memory:** Integrated document scrapers and knowledge vaults (via `wanda_remember` protocol) ensure no insights are lost.

## ⚙️ Quick Start

### Installation

```bash
# Install dependencies
pnpm install

# Typechecking and tests
pnpm run typecheck
pnpm run test

# Check authentication status
pnpm run wanda -- auth status
```

### Debug & Validation

```bash
# Start bot in debug mode
pnpm run debug:bot

# Run system check
pnpm run wanda -- doctor

# Test model connectivity
pnpm run wanda -- test model "ping"
```

*Set `LOG_LEVEL=debug` for detailed runtime insights.*

## 📚 Technical Documentation

For deep-dives into the system design, architecture, and current state, refer to the docs:

- [Project Overview](docs/00_overview/PROJECT.md)
- [Active Tasks](docs/04_plan/TASKS.md)
- [Milestones & Roadmap](docs/04_plan/MILESTONES.md)
- [Handoff State](docs/04_plan/HANDOFF.md)

---
*Built under the JANNIS PROTOCOL — Code Must Be Tested, Efficient, and Secure.*
