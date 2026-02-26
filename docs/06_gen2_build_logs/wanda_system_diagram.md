# WANDA Ecosystem Architecture

This diagram visualizes the structural components of the WANDA Gen-2 system. 

- **Grün (Done):** Abgeschlossen und getestet (Das Fundament: Memory, Host, Workspace).
- **Orange (Next Phase):** Der logisch nächste Schritt (Agent Engine / The Brain).
- **Grau gestrichelt (Future Phase):** Geplante Frontends und Kanäle (The Senses & Controls).

```mermaid
graph TD
    %% Styling Classes
    classDef done fill:#2e7d32,stroke:#1b5e20,stroke-width:2px,color:#fff;
    classDef next fill:#f57c00,stroke:#e65100,stroke-width:2px,color:#fff;
    classDef todo fill:#424242,stroke:#212121,stroke-width:2px,color:#fff,stroke-dasharray: 5 5;

    subgraph Frontends_and_Channels [The Senses & Controls]
        MCC[Wanda MCC Dashboard]:::todo
        AERIS[AERIS Studio / Visual Canvas]:::todo
        TG[Telegram Bot Adapter]:::done
        CLI[CLI Terminal Adapter]:::done
        VOX[Vox-Voice WebRTC]:::next
        WebChat[WebChat React UI]:::next
    end

    subgraph WANDA_Hub [The Central Local Host]
        Express[Express.js / SSE Server auf Port 3000/3001]:::done
        MemoryMCP[Memory MCP Server]:::done
        WorkspaceMCP[Workspace MCP Server]:::done

        subgraph UCM [Unified Core Memory]
            Graph[(Tier 2: SQLite Graph)]:::done
            Journal[(Tier 3: Markdown Journals)]:::done
            Vector[(Tier 4: Supabase Archive)]:::done
        end

        MemoryMCP --> Graph
        MemoryMCP --> Journal
        MemoryMCP --> Vector

        Express --> MemoryMCP
        Express --> WorkspaceMCP
    end

    subgraph Agent_Engine [The Active Brain]
        AgentBus[Universal Agent Bus]:::done
        Swarm[Swarm Manager / ReAct Loop]:::done
        LLMGateway[LLM Gateway / OpenRouter API]:::done
        Janitor[Janitor Memory Maintenance]:::done
        EventLoop[Proactive Async Heartbeat]:::todo
    end

    %% Connections
    MCC -.-> |Settings & Config| Express
    AERIS -.-> |Graph Queries| Express
    TG -.-> AgentBus
    CLI -.-> AgentBus
    VOX -.-> AgentBus
    WebChat -.-> AgentBus

    AgentBus <--> Swarm
    Swarm <--> LLMGateway
    Swarm --> |Nutzt Tools per SSE| Express
    Janitor --> |Räumt auf| UCM
```

### Der nächste logische Schritt (Execution Phase 5)

Da wir nun das **komplette Backend-Fundament** (WANDA Hub, Memory MCP, Workspace MCP) fertig implementiert und getestet haben, ist das System bereit, Befehle auszuführen – aber es fehlt der Akteur, der *denkt*. Ein Hub ohne Client ist stumm.

Daher ist der nächste logische Schritt die **Agent Engine (Phase 5: LLM Gateway & Swarm Tool Loop)**.
Wir müssen:
1. **Das LLM Gateway (`packages/providers/llm-gateway`) bauen:** Eine verlässliche Schnittstelle zu OpenRouter (und Ollama als Fallback) implementieren, die mit sauberen Streaming-Responses umgehen kann.
2. **Den Swarm Manager / ReAct Loop (`packages/core/swarm-manager`) implementieren:** Die eigentliche Schleife ("Agens"), die User-Nachrichten via `AgentBus` empfängt, an das LLM schickt, erkennt, dass das LLM Tools (aus unserem neuen Hub) aufrufen will, diese Tools ausführt und das Ergebnis wieder an das LLM gibt.

Ohne diese Schicht können unsere Interfaces (Voice, Webchat, AERIS) nicht mit der AI kommunizieren!
