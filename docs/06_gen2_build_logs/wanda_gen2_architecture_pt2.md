# Wanda Gen-2 Proactive, Swarm & UX Architecture

Based on deep primary and counter-research for edge-cases, we define the architecture for Wanda's advanced capabilities:

## 1. Proactive Behavior & Heartbeat (Features 36-39)
*   **The Problem:** Traditional bots only reply when spoken to. Heavy background cron jobs can block the main Node.js event loop, making the chatbot unresponsive to user messages.
*   **Gen-2 Solution (Asynchronous Heartbeat & Workers):**
    *   We utilize **Node.js Worker Threads** or an asynchronous in-memory Job queue to ensure background thought processes never block the main `AgentBus` event loop.
    *   **Heartbeat Event:** A background tick wakes up a "Proactive Manager" every X minutes. It evaluates the user's Context Graph (Tier 2 Memory) and time-of-day.
    *   **Smart Triggers:** Instead of hardcoded times, Morning/Evening Briefings are triggered dynamically (e.g., "User's first interaction after 7:00 AM").

## 2. Agent Swarms & Tool Loop (Features 44-48)
*   **The Problem:** Passing massive conversation histories between multiple LLM sub-agents causes catastrophic token limit exhaustion, high latency, and high costs.
*   **Gen-2 Solution (Chain-of-Agents & A2A Protocol):**
    *   **Iterative Tool Loop:** Wanda uses a `ReAct` (Reason+Act) cycle with strict fail-safes: Maximum Iteration Caps and Budget Limits per session to prevent runaway loops.
    *   **Token-Optimized Swarms:** Sub-agents (e.g., 'Researcher', 'Coder') communicate using a strict JSON **Agent-to-Agent (A2A)** protocol. 
    *   **Context Delegation:** The orchestrator does NOT pass the whole chat history. It passes a constrained `Goal Schema`. If the sub-agent needs historical data, it queries the `Vector Archive` itself, keeping token usage minimal.

## 3. UX: Observability & Smooth Streaming (Features 54-60)
*   **The Problem:** Token-by-token LLM streaming causes severe UI "jank" when rendering markdown (e.g., unclosed `**` or \`\`\` tags break the HTML layout). Users are also blind to what the agent is doing background.
*   **Gen-2 Solution (Buffering Parsers & Telemetry):**
    *   **Smooth Markdown Streaming:** The WebChat UI will implement **Selective Buffering** or use a streaming-optimized parser. Ambiguous tokens (like `[`, `*`, \`\`\`) are buffered invisibly until their closing pairs arrive, guaranteeing a buttery-smooth "human typing" visual without DOM flickering.
    *   **Observability Metrics:** The `Wanda-MCC` connects to a dedicated Telemetry WebSocket, receiving: *Time to First Token (TTFT)*, *Tokens Per Second (TPS)*, and *Live Cost-Tracking* per tool execution.
    *   **Live Canvas (A2UI):** Wanda can output special JSON blocks that the UI intercepts to render interactive widgets (charts, code editors) alongside text.
