# Wanda Gen-2 Memory Architecture Research & Design

## 1. Research on Existing Systems
We analyzed several top-tier memory systems to learn from their strengths and weaknesses:

*   **Agent Zero:** Uses a Hybrid Memory System (FAISS vector search) to split information into main memories, fragments, and proven solutions. **Strength:** Excellent context engineering and project isolation. **Weakness:** Vector-only search can miss precise logical connections and feels like a "black box" to users.
*   **OpenClaw:** Pioneers a "Markdown-first" approach. Uses daily append-only logs (`YYYY-MM-DD.md`) and a curated `MEMORY.md`. **Strength:** 100% transparent, human-readable, and git-friendly. **Weakness:** Lacks sophisticated semantic traversal.
*   **Cursor & Windsurf IDEs:** Utilize deep Codebase Indexing. Cursor parses ASTs and uses Merkle trees for 21-second index updates. Windsurf uses "M-query" (parallel LLM calls) to understand relationships across files. **Strength:** Unmatched contextual awareness of complex relationships. **Weakness:** Compute-heavy, strictly focused on code rather than generalized, persistent user preferences.
*   **MemGPT:** Treats the LLM like an Operating System. Separates context into Main (RAM) and External (Disk), utilizing "heartbeats" for inner monologues and self-editing memory via autonomous function calls. **Strength:** True self-evolving capabilities and unbounded memory illusion. **Weakness:** Complex to orchestrate, can lead to infinite loops if heartbeats aren't managed well.

## 2. Wanda's Gen-2 Memory Concept: The "Unified Core Memory" (UCM)
Based on the provided ideas (SQLite, Knowledge Graph, Supabase, Markdown, etc.) and our research, we propose a 4-Tier Memory System. The goal is to be **proactive, token-efficient, self-cleaning, and transparent.**

### Tier 1: Ephemeral "RAM" (Session State & Flow)
*   **Mechanism:** Conversational FIFO queue + "Working Context" scratchpad (inspired by MemGPT).
*   **Token Efficiency:** Implements **Context Pruning**. When approaching the token limit, older messages are autonomously summarized and pushed to Tier 3/4.
*   **Self-Evolving Feature:** "Inner Monologue" heartbeats allow Wanda to think, plan, and call memory-editing tools *before* responding to the user.

### Tier 2: The Knowledge Graph (SQLite)
*   **Mechanism:** Stores memories as interconnected entities (e.g., `Jannis` -> `uses` -> `Pop!_OS`, `AERIS` -> `is` -> `Developer King`).
*   **Token Efficiency:** Instead of dumping massive vector search results, Graph Traversal queries (`get_related_to('AERIS', depth=2)`) fetch only precisely relevant logic chains.
*   **Self-Evolving Feature:** Background tracking of "Access Patterns." Unused edges slowly decay, and a background agent merges duplicate entities.

### Tier 3: Markdown "Journals" (Human-Readable Core)
*   **Mechanism:** Inspired by OpenClaw. Stores user profiles, robust system rules, and major project architectures as local `.md` files.
*   **Why?** Ensures the core identity and rules of Wanda remain completely transparent, easily editable by the user via AERIS Studio, and trackable via Git.

### Tier 4: The Archive (Supabase + pgvector)
*   **Mechanism:** Remote vector database.
*   **Usage:** For vast semantic similarity searches, Multimodal Memory (storing metadata for images/audio), and true cross-device persistence. Acts as the cold storage for everything that doesn't fit in Tier 1, 2, or 3.

## 3. How Wanda Manages It Autonomously
*   **Proactive Learning:** Wanda is equipped with `store_memory` and `link_entity` tools. Whenever the user states a fact, Wanda updates the SQLite Graph or Markdown files silently.
*   **The Janitor Cron:** A separate lightweight agent (`Wanda Janitor`) runs periodically on the local Hub to analyze SQLite and pgvector, merging duplicates, pruning obsolete contexts, and summarizing facts into the Markdown Journals.
