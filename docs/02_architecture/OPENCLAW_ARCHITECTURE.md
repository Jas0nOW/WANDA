# OpenClaw — Vollständige Systemarchitektur
_Erstellt: 2026-02-26 · Basis: Live-System Wanda V5.0 · OpenClaw v2026.2.x_

> Dieses Dokument erklärt **wie OpenClaw wirklich funktioniert** — von innen. Vollständig genug um es nachzubauen.

---

## 1. Übersicht: Was ist OpenClaw?

OpenClaw ist ein **selbst-gehostetes AI-Agent-Framework**. Es läuft als Node.js-Daemon (Gateway) auf einem VPS/Server und verbindet:

- **Messaging-Kanäle** (WhatsApp, Telegram, Signal, ...) als Input/Output
- **KI-Modelle** (Anthropic, Gemini, Codex, ...) als "Gehirn" der Agenten
- **Tools** (Shell, Browser, Web, File I/O) als Hände der Agenten
- **Skills** (Markdown-Instruktionsdateien) als Spezialisierungen
- **Crons** (Scheduled Jobs) als autonome Hintergrundprozesse
- **Memory** (Files + Plugins) als persistentes Gedächtnis

---

## 2. Top-Level Architektur

```mermaid
graph TB
    subgraph USER["👤 User (Jannis)"]
        WA[WhatsApp]
        TG[Telegram]
        SIG[Signal]
    end

    subgraph VPS["🖥️ VPS Ubuntu 24.04"]
        subgraph DOCKER["Docker Container"]
            subgraph OC["OpenClaw Gateway (Node.js :63362)"]
                CHAN[Channel Manager]
                SESS[Session Manager]
                SCHED[Cron Scheduler]
                PLUG[Plugin System]
                SKILL[Skill Loader]
                CFG[Config Engine\nopenlaw.json]
            end

            subgraph AGENTS["Agent Layer"]
                WANDA[Wanda\nClaude Sonnet]
                CTO[CTO\nGemini Pro]
                COO[COO\nGemini Flash]
                BUILDER[Builder\nCodex GPT-5.3]
                SCOUT[Scout\nGemini Flash]
                MORE[...11 weitere Agenten]
            end

            subgraph TOOLS["Tool Layer"]
                EXEC[exec\nShell]
                BROWSER[browser\nPlaywright]
                WEBSRCH[web_search\nGemini+Google]
                WEBFTCH[web_fetch\nHTTP→MD]
                SPAWN[sessions_spawn\nSub-Agents]
                FSYS[read/write/edit\nFilesystem]
            end

            subgraph MEMORY["Memory Layer"]
                MEMFILES[Workspace Files\nSOUL/MEMORY/USER.md]
                DAILY[Daily Notes\nmemory/YYYY-MM-DD.md]
                MEM0[Mem0 Plugin\nSemantic Recall]
                HBSTATE[Heartbeat State\nheartbeat-state.json]
            end
        end

        NGINX[Nginx Reverse Proxy\nwanda.lazytechlab.de]
    end

    subgraph PROVIDERS["☁️ AI Provider APIs"]
        ANTHROPIC[Anthropic\nClaude]
        GEMINI[Google Antigravity\nGemini + Claude]
        CODEX[OpenAI Codex]
        COPILOT[GitHub Copilot\nClaude]
        KIMI[Kimi Coding]
    end

    WA -->|Webhook/WA-Plugin| CHAN
    TG -->|Webhook| CHAN
    SIG -->|Webhook| CHAN
    CHAN --> SESS
    SESS --> WANDA
    WANDA -->|Tool Calls| TOOLS
    WANDA -->|API Call| ANTHROPIC
    CTO -->|API Call| GEMINI
    BUILDER -->|API Call| CODEX
    SCHED -->|Trigger| AGENTS
    PLUG --> MEM0
    SKILL --> WANDA
    CFG --> CHAN
    CFG --> AGENTS
    AGENTS --> MEMORY
    NGINX --> OC
```

---

## 3. Message Flow (inbound → response)

```mermaid
sequenceDiagram
    participant U as User (WhatsApp)
    participant WH as WA Plugin
    participant CM as Channel Manager
    participant SM as Session Manager
    participant SL as Skill Loader
    participant AG as Agent (Wanda)
    participant AI as AI Provider (Claude)
    participant TL as Tools
    participant MEM as Memory
    participant OUT as Output

    U->>WH: Sendet Nachricht
    WH->>CM: Webhook-Event + Metadata
    CM->>CM: dmPolicy check (allowlist?)
    CM->>SM: Route zu Session
    SM->>SM: Session lookup/create (per-channel-peer)
    SM->>SL: Skill-Matching (available_skills scan)
    SL-->>AG: Inject SKILL.md wenn Match
    SM->>MEM: Lade Workspace-Files (SOUL/USER/MEMORY/etc.)
    SM->>MEM: Mem0 semantic search (ähnliche Erinnerungen)
    SM->>AG: System-Prompt + Context + User-Message
    AG->>AI: API Request (primary model)
    AI-->>AG: Streaming Response + Tool Calls
    AG->>TL: Tool ausführen (exec/browser/web/etc.)
    TL-->>AG: Tool Result
    AG->>AI: Tool Result zurück → weiterer Response
    AG->>MEM: Context Pruning (cache-ttl, 1h)
    AG->>MEM: Memory Flush wenn >40k Tokens
    AG-->>OUT: Finale Antwort
    OUT->>CM: Text/Media zurück an Channel
    CM->>WH: WhatsApp-Delivery
    WH->>U: Nachricht/Voice Memo
```

---

## 4. Konfiguration: openclaw.json (Kern-Struktur)

```mermaid
graph LR
    CFG[openclaw.json]

    CFG --> AUTH[auth\nProvider-Profile\nTokens / OAuth]
    CFG --> AGENTS[agents\ndefaults + list\nModels, Tools, Subagents]
    CFG --> MESSAGES[messages\nTTS-Config\nChunkMode, AckReaction]
    CFG --> SESSION[session\ndmScope\nper-channel-peer]
    CFG --> CHANNELS[channels\nwhatsapp/telegram\ndmPolicy, allowFrom]
    CFG --> GATEWAY[gateway\nport, bind, auth\ntrustedProxies]
    CFG --> SKILLS[skills\ninstall nodeManager\nAPI Keys je Skill]
    CFG --> PLUGINS[plugins\nslots: memory\nwhatsapp, mem0, etc.]
    CFG --> BROWSER[browser\nheadless, noSandbox\ndefaultProfile]
    CFG --> UPDATE[update\nchannel: stable\ncheckOnStart]
```

### Wichtigste Config-Abschnitte erklärt:

| Abschnitt | Zweck | Kritisch |
|-----------|-------|----------|
| `auth.profiles` | Welche AI-Provider + Auth-Methode | Ja — ohne Auth keine Modelle |
| `agents.defaults` | Globale Defaults für alle Agenten | Ja — Model-Allowlist, Context-Pruning |
| `agents.list` | Individuelle Agent-Configs | Ja — Tool-Permissions, Sub-Agent-Allow |
| `channels.whatsapp.dmPolicy` | `allowlist` = nur erlaubte Nummern | Ja — Security-kritisch |
| `messages.tts.auto` | `off` = kein auto TTS | Ja — verhindert Voice-Spam |
| `plugins.slots.memory` | Welches Memory-Plugin aktiv ist | Ja — steuert Erinnerungssystem |
| `agents.defaults.heartbeat` | Model + Interval für Heartbeat | Ja — autonomer Check-Daemon |

---

## 5. Agent-System

```mermaid
graph TD
    subgraph L1["Layer 1 — CEO (Orchestrator)"]
        WANDA[🔮 Wanda\nClaude Sonnet 4.6\nHauptkanal WhatsApp]
    end

    subgraph L2["Layer 2 — C-Suite"]
        CTO[CTO Linus\nGemini Pro]
        COO[COO Sheryl\nGemini Flash]
        CFO[CFO Buffett\nGemini Pro]
        CMO[CMO Godin\nGemini Pro]
        CSO[CSO Cardone\nGemini Pro]
    end

    subgraph L3["Layer 3 — Spezialisten"]
        BUILDER[Builder Carmack\nCodex GPT-5.3]
        REVIEWER[Reviewer Dijkstra\nGemini Pro]
        SCOUT[Scout Silver\nGemini Flash]
        CS[Customer Success\nGemini Flash]
        ACC[Accountant\nGemini Pro]
        COPY[Copywriter Ogilvy\nKimi K2.5]
        SDR[SDR Ross\nGemini Flash]
        CLOSER[Closer Ziglar\nGemini Pro]
        PARTNER[Partner Hoffman\nGemini Flash]
    end

    WANDA -->|sessions_spawn| CTO
    WANDA -->|sessions_spawn| COO
    WANDA -->|sessions_spawn| CFO
    WANDA -->|sessions_spawn| CMO
    WANDA -->|sessions_spawn| CSO

    CTO -->|sessions_spawn| BUILDER
    CTO -->|sessions_spawn| REVIEWER
    COO -->|sessions_spawn| SCOUT
    COO -->|sessions_spawn| CS
    CFO -->|sessions_spawn| ACC
    CMO -->|sessions_spawn| COPY
    CMO -->|sessions_spawn| SCOUT
    CSO -->|sessions_spawn| SDR
    CSO -->|sessions_spawn| CLOSER
    CSO -->|sessions_spawn| PARTNER
```

### Wie Agenten spawnen

Jeder Agent ist in `openclaw.json` definiert mit:
- **model**: primary + fallbacks
- **tools.allow/deny**: Welche Tools er nutzen darf
- **subagents.allowAgents**: Welche Agenten er spawnen darf
- **sandbox**: off/on (Isolation)

```mermaid
sequenceDiagram
    participant W as Wanda
    participant SS as sessions_spawn Tool
    participant GW as Gateway
    participant SA as Sub-Agent (z.B. CTO)
    participant AI as AI Provider

    W->>SS: sessions_spawn(task="...", agentId="cto")
    SS->>GW: Neue isolierte Session erstellen
    GW->>SA: System-Prompt + Task + Config
    SA->>AI: API Call mit CTO-Model
    AI-->>SA: Response + Tool Calls
    SA->>SA: Tools ausführen (read/write/exec)
    SA-->>GW: Finale Antwort
    GW-->>W: Result zurück an Wanda
    W->>W: Weiterverarbeitung / Relay an Jannis
```

---

## 6. Cron-System

```mermaid
graph LR
    CRONFILE[cron/jobs.json\nJob-Definitionen]
    SCHED[Cron Scheduler\nim Gateway]
    
    CRONFILE --> SCHED
    
    SCHED -->|"09:00 daily"| BRIEF[morning-briefing\nAgent: wanda]
    SCHED -->|"alle 30 min"| MARKET[market-hunter\nAgent: scout]
    SCHED -->|"04:00 daily"| JANITOR[system-janitor\nAgent: wanda]
    SCHED -->|"22:00 daily"| LEADS[nightly-lead-scan\nAgent: sdr]
    SCHED -->|"1h interval"| HB[Heartbeat\nAgent: wanda\nModel: Gemini Flash]

    BRIEF -->|System Message| WANDA[Wanda Session]
    MARKET -->|System Message| WANDA
    HB -->|Heartbeat Prompt| WANDA
    
    WANDA -->|Result| WA[WhatsApp → Jannis]
```

### Cron Job Schema (jobs.json)

```json
{
  "id": "morning-briefing",
  "name": "Daily CEO Briefing",
  "agentId": "wanda",
  "schedule": { "cron": "0 9 * * *", "tz": "Europe/Berlin" },
  "prompt": "Erstelle ein morgendliches CEO-Briefing...",
  "enabled": true,
  "model": "google-antigravity/gemini-3-flash"
}
```

**Kritisch:** Das `model`-Feld im Cron muss in der `agents.defaults.models` Allowlist stehen, sonst schlägt der Cron fehl mit `Unknown model`.

---

## 7. Memory-System

```mermaid
graph TD
    subgraph SESSION["Session Start"]
        WF[Workspace Files\ninject into System-Prompt]
        MEM0S[Mem0 Semantic Search\nÄhnliche Erinnerungen]
    end

    subgraph RUNTIME["Runtime"]
        CP[Context Pruning\ncache-ttl: 1h\nkeepLastAssistants: 3]
        MF[Memory Flush\nbei >40k Tokens\n→ memory/YYYY-MM-DD.md]
    end

    subgraph PERSIST["Persistent Memory"]
        SOUL[SOUL.md\nIdentität + Regeln]
        USERM[USER.md\nJannis Profil]
        MEMMD[MEMORY.md\nKey Facts + Blocker]
        AGENTS[AGENTS.md\nAgent Hierarchie]
        DAILY[memory/YYYY-MM-DD.md\nTagesnotizen]
        MEM0P[Mem0 Cloud\nAuto-Capture + Recall]
        HBST[heartbeat-state.json\nHeartbeat Tracking]
    end

    WF --> SOUL
    WF --> USERM
    WF --> MEMMD
    WF --> AGENTS
    MEM0S --> MEM0P
    CP --> DAILY
    MF --> DAILY
    MF --> MEM0P
```

### Wie Kontext in den System-Prompt kommt

1. **Workspace Files** → werden beim Session-Start als `## Project Context` injiziert (alle .md Files im workspace)
2. **Mem0** → semantische Suche nach ähnlichen Themen → Top-N Erinnerungen werden prepended
3. **Session History** → letzte Nachrichten (kontrolliert durch contextPruning)
4. **Skill Files** → wenn Skill matched, wird SKILL.md als zusätzliche Instruktion geladen

---

## 8. Skill-System

```mermaid
graph TD
    USER_MSG[User-Nachricht]
    
    USER_MSG --> SCAN[Skill Scanner\nprüft available_skills Tags]
    SCAN -->|Match| LOAD[Skill SKILL.md lesen]
    SCAN -->|Kein Match| NORMAL[Normal weiter]
    LOAD --> INJECT[In System-Prompt injizieren]
    INJECT --> AGENT[Agent folgt Skill-Anweisungen]

    subgraph SKILL_LOCATIONS["Skill Locations"]
        NPM[npm-global-persist/lib/node_modules/openclaw/skills/\nSystem-Skills: weather, github, gog, sag...]
        LOCAL[~/.openclaw/skills/\nCustom Skills: proposal-writer, voice-standups...]
    end
```

### Skill-Struktur

```
skills/
  mein-skill/
    SKILL.md          # Haupt-Instruktion (YAML frontmatter + Markdown)
    scripts/          # Hilfsskripte
    assets/           # Referenzdateien
```

**SKILL.md Frontmatter:**
```yaml
---
name: mein-skill
description: "Wann dieser Skill aktiviert wird (für Matching)"
version: "1.0"
---
# Skill Instruktionen
...
```

---

## 9. Tool-System

```mermaid
graph LR
    AG[Agent]

    AG -->|Shell-Command| EXEC[exec\nShell-Befehle\npty/background/timeout]
    AG -->|Playwright| BROWSER[browser\nSnapshot/Click/Navigate\nProfile: chrome/openclaw]
    AG -->|Brave/Gemini| WSRCH[web_search\nGoogle-grounded]
    AG -->|HTTP→Markdown| WFETCH[web_fetch\nURL lesen]
    AG -->|Spawn| SSPAWN[sessions_spawn\nSub-Agent erstellen\nmode: run/session]
    AG -->|Session-Ops| SSEND[sessions_send\nNachricht an andere Session]
    AG -->|Session-Ops| SLIST[sessions_list\nAlle Sessions auflisten]
    AG -->|Filesystem| FREAD[read\nDatei lesen]
    AG -->|Filesystem| FWRITE[write\nDatei schreiben]
    AG -->|Filesystem| FEDIT[edit\nPräzise Änderungen]
    AG -->|TTS| TTS_T[tts\nText-to-Speech]

    subgraph PERMISSIONS["Tool-Permissions (per Agent)"]
        ALLOW[tools.allow: Liste]
        DENY[tools.deny: Liste]
    end
```

### Tool-Permissions (Beispiele)

| Agent | Erlaubt | Verboten |
|-------|---------|---------|
| Wanda (CEO) | Alles | — |
| Builder | read, write, edit, exec | browser, web_search |
| Scout | read, web_search, web_fetch, sessions_send | exec, write, browser |
| Reviewer | read, sessions_history | exec, write, browser, web |
| Accountant | read, write, edit | exec, browser, web |

---

## 10. Plugin-System

```mermaid
graph TD
    subgraph PLUGINS["openclaw.json → plugins"]
        WA_PLUG[whatsapp Plugin\nWA-Verbindung + Webhooks]
        MEM0_PLUG[openclaw-mem0 Plugin\nSemantisches Gedächtnis]
        AG_AUTH[google-antigravity-auth\nOAuth für AG-Provider]
        GEMINI_AUTH[google-gemini-cli-auth\nOAuth für Gemini CLI]
        BROWSER_RELAY[Browser Relay Plugin\nChrome Extension Connect]
    end

    subgraph SLOTS["Plugin Slots"]
        MEM_SLOT[memory: openclaw-mem0\nAktives Memory-Backend]
    end

    WA_PLUG -->|Slot: channel| CHAN[Channel Manager]
    MEM0_PLUG -->|Slot: memory| MEM_SLOT
    AG_AUTH -->|OAuth Token| PROVIDERS[AI Providers]
```

**Plugin-Slot System:** OpenClaw hat austauschbare Slots für memory (mem0, lancedb, core), channel (whatsapp, telegram), etc. Nur ein Plugin pro Slot aktiv.

---

## 11. Gateway-Architektur

```mermaid
graph TD
    subgraph GATEWAY["OpenClaw Gateway :63362"]
        API[REST API\n/api/*]
        WS[WebSocket\nReal-time]
        UI[Control UI\n/ui/]
        AUTH_MW[Auth Middleware\nToken / Bearer]
        
        API --> CHAN_MGR[Channel Manager]
        API --> AGENT_MGR[Agent Manager]
        API --> CRON_MGR[Cron Manager]
        API --> CFG_MGR[Config Manager]
        WS --> REAL_TIME[Real-time Events\nSession Updates]
    end

    subgraph NETWORK["Netzwerk"]
        NGINX[Nginx\nwanda.lazytechlab.de\nSSL + BasicAuth]
        SOCAT1[socat :63363→:63362\nWebSocket Proxy]
        UFW[UFW Firewall\n22,80,443,63362,63363]
    end

    NGINX --> AUTH_MW
    SOCAT1 --> API
    UFW --> NGINX
    UFW --> SOCAT1
```

---

## 12. Session-System

```mermaid
graph TD
    SESSION_SCOPE[session.dmScope\nper-channel-peer]
    
    SESSION_SCOPE -->|Eine Session pro| SCOPE[Kombination aus:\nKanal + Peer/Gruppe]
    
    subgraph SESSION_CONTENT["Session-Inhalt"]
        HIST[Message History]
        CTX[Injected Context\nWorkspace Files + Mem0]
        STATE[Session State\nCompaction Count etc.]
        TOOLS_STATE[Tool Results Cache]
    end

    subgraph COMPACTION["Context Management"]
        PRUNE[Context Pruning\ncache-ttl: 1h\ntrimmt alte Tool-Outputs]
        COMPACT[Compaction\nbei Annäherung an Limit\nflusht nach memory/]
    end

    HIST --> PRUNE
    PRUNE --> COMPACT
    COMPACT -->|Memory Flush| DAILY_NOTES[memory/YYYY-MM-DD.md]
```

---

## 13. TTS / Voice-Pipeline

```mermaid
graph LR
    INPUT[User sendet\nVoice-Nachricht]
    STT[STT\nWhisper tiny\n--fp16 False]
    WANDA_PROC[Wanda verarbeitet Text]
    
    subgraph TTS_OUT["TTS Output (wenn explizit requested)"]
        SAG[sag CLI\nElevenLabs Jessica\nSpeed 1.02]
        EDGE[Edge TTS Fallback\nde-DE-Seraphina\nRate +15%]
    end
    
    INPUT -->|auto: inbound| STT
    STT --> WANDA_PROC
    WANDA_PROC -->|Text-Antwort\nnormal| WA_OUT[WhatsApp Text]
    WANDA_PROC -->|explicit: Sprachmemo| SAG
    SAG -->|/data/.openclaw/workspace/reply.mp3| MEDIA[MEDIA: Pfad\nan WhatsApp]
    EDGE -->|Fallback| MEDIA
```

**Config-Regel:** `tts.auto: "off"` → kein auto-TTS. Nur wenn Jannis explizit "Sprachmemo" sagt → `sag speak -v cgSgspJ2msm6clMCkdW9 --speed 1.02`

---

## 14. Heartbeat-System

```mermaid
sequenceDiagram
    participant SCHED as Cron Scheduler (1h)
    participant HB as Heartbeat Session
    participant GF as Gemini Flash
    participant FILES as Workspace Files
    participant MEM as Memory Files
    participant WA as WhatsApp (Jannis)

    SCHED->>HB: Heartbeat Prompt senden
    HB->>FILES: HEARTBEAT.md lesen
    HB->>FILES: KILL_SWITCH.md prüfen
    HB->>GF: API Call (Gemini Flash, günstig)
    GF-->>HB: Analyse + Entscheidung
    HB->>HB: Nachtruhe Check (23:00-07:00?)
    
    alt Nichts wichtiges / Nachtruhe
        HB-->>SCHED: HEARTBEAT_OK (kein Output)
    else Wichtiges gefunden
        HB->>MEM: memory/heartbeat-state.json updaten
        HB->>WA: Alert-Nachricht an Jannis
    end
```

---

## 15. Auth-System (Multi-Provider)

```mermaid
graph TD
    subgraph AUTH["auth.profiles in openclaw.json"]
        ANTH[anthropic:profile\nmode: token\nAPI Key]
        AG[google-antigravity:email\nmode: oauth\nGoogle OAuth]
        GEM[google-gemini-cli:email\nmode: oauth\nGemini CLI OAuth]
        GH[github-copilot:github\nmode: token\nGH Token]
        OAI[openai-codex:default\nmode: oauth\nOpenAI OAuth]
    end

    subgraph PROVIDERS["Provider Routing"]
        ANTH -->|Direct API| CLAUDE_API[Claude API]
        AG -->|Antigravity Proxy\nGemini + Claude ohne direkte Keys| AG_API[Google Antigravity]
        GEM -->|Gemini CLI OAuth| GEMINI_API[Gemini API]
        GH -->|Copilot API| COPILOT_API[GitHub Copilot]
        OAI -->|Codex API| CODEX_API[OpenAI Codex]
    end
```

**Besonderheit Antigravity:** Google Antigravity ist ein Proxy-Provider der sowohl Gemini als auch Claude-Modelle ohne direkte Anthropic-Keys bereitstellt (über Google Cloud).

---

## 16. Kompletter Build-Stack (zum Nachbauen)

```mermaid
graph TD
    subgraph INFRA["Infrastruktur"]
        VPS[VPS Ubuntu 24.04\n4GB RAM min.\nDocker + Docker Compose]
        DOMAIN[Domain\nDNS auf VPS-IP]
        SSL[SSL via Certbot\nLet's Encrypt]
    end

    subgraph CORE["Core Installation"]
        OC_INSTALL[npm install -g openclaw\noder Binary-Download]
        OC_RUN[openclaw start\nGateway Daemon]
        OC_CFG[openclaw.json\n/data/.openclaw/]
    end

    subgraph CHANNELS["Channel-Verbindung"]
        WA_AUTH[openclaw auth whatsapp\nQR-Code scannen]
        TG_AUTH[openclaw auth telegram\nBot Token]
    end

    subgraph AI_AUTH["AI Provider Auth"]
        ANTH_KEY[Anthropic API Key\nopenclaw auth anthropic]
        GOOGLE_OAUTH[Google OAuth\nopenclaw auth google-antigravity]
        GH_TOKEN[GitHub Token\nopenclaw auth github-copilot]
    end

    subgraph WORKSPACE["Workspace Setup"]
        SOUL_F[SOUL.md erstellen\nAgent-Identität]
        AGENTS_F[AGENTS.md\nAgent-Hierarchie]
        USER_F[USER.md\nUser-Profil]
        HEARTBEAT_F[HEARTBEAT.md\nHeartbeat-Logik]
        MEMORY_F[MEMORY.md\nKey Facts]
    end

    subgraph SKILLS["Skills & Plugins"]
        SKILL_INST[Skills installieren\nclawhub install <skill>]
        PLUGIN_INST[Plugins installieren\nopenclaw plugin install]
        MEM0_SETUP[Mem0 Setup\nAPI Key + User ID]
    end

    subgraph PROXY["Reverse Proxy"]
        NGINX_CONF[Nginx Config\nSSL + BasicAuth]
        UFW_RULES[UFW Firewall\nPorts freigeben]
        SOCAT_SVC[systemd socat Service\nWebSocket-Proxy]
    end

    VPS --> OC_INSTALL
    OC_INSTALL --> OC_CFG
    OC_CFG --> OC_RUN
    OC_RUN --> WA_AUTH
    OC_RUN --> AI_AUTH
    AI_AUTH --> WORKSPACE
    WORKSPACE --> SKILLS
    VPS --> PROXY
```

---

## 17. Warum kam das Briefing nicht als Memo? (Root Cause)

```mermaid
graph LR
    CRON[Cron: morning-briefing\nläuft auf Gemini Flash]
    CRON -->|System Message| WANDA_SESS[Wanda Session\nEmpfängt Result]
    WANDA_SESS -->|Text-Reply| WA_OUT[WhatsApp Text]

    WANDA_SESS -. FEHLT .-> TTS_STEP[TTS-Schritt\nkein sag-Call\nim Cron-Output]
    TTS_STEP -. wäre nötig .-> VOICE[Voice Memo]
```

**Problem:** Der Cron produziert Text → OpenClaw liefert diesen als System-Message an Wanda → Wanda leitet ihn als Text weiter, weil `tts.auto: "off"` und der Cron keine `sag`-Instruktion hat.

**Fix-Optionen:**
1. **Cron-Prompt erweitern:** Dem Cron sagen, er soll am Ende `sag speak ...` ausführen und `MEDIA:/data/.openclaw/workspace/reply.mp3` zurückgeben
2. **Wanda-Relay-Regel:** In HEARTBEAT.md / SOUL.md definieren: "Briefings immer als Voice-Memo delivern"
3. **TTS-Auto für Briefing-Channel:** `tts.auto: "inbound"` für WhatsApp setzen (aber dann IMMER Voice, auch normal)

---

## 18. Daten-Flow: Alles auf einen Blick

```mermaid
graph TD
    MSG_IN[📱 Nachricht eingehend]
    
    MSG_IN --> POLICY{dmPolicy\nallowlist?}
    POLICY -->|Nein| DROP[🚫 Verwerfen]
    POLICY -->|Ja| ROUTE[Session Router]
    
    ROUTE --> CTX[Context Builder\nFiles + Mem0 + History]
    CTX --> PROMPT[System-Prompt Assembly\nSOUL + USER + MEMORY + SKILL]
    PROMPT --> AI_CALL[AI API Call\nprimary model]
    
    AI_CALL --> TOOL_CHECK{Tool Calls\nin Response?}
    TOOL_CHECK -->|Ja| TOOL_EXEC[Tool ausführen\nexec/browser/web/spawn]
    TOOL_EXEC --> AI_CALL
    TOOL_CHECK -->|Nein| FINAL[Finale Antwort]
    
    FINAL --> CONTEXT_MGR[Context Manager\nPruning + Flush]
    FINAL --> TTS_CHECK{TTS auto\n= on?}
    TTS_CHECK -->|Ja| TTS_GEN[TTS generieren\nEdge/ElevenLabs]
    TTS_CHECK -->|Nein| TEXT_OUT[Text Output]
    TTS_GEN --> VOICE_OUT[Voice Memo]
    
    TEXT_OUT --> DELIVERY[Channel Delivery]
    VOICE_OUT --> DELIVERY
    DELIVERY --> MSG_OUT[📱 Antwort beim User]
```

---

## 19. Minimaler Build (Eigenes OpenClaw)

Wenn du das nachbauen willst, brauchst du diese Kern-Komponenten:

| Komponente | Technologie | Zweck |
|------------|-------------|-------|
| **Gateway** | Node.js + Express | HTTP/WS Server, Config-Management |
| **Channel Plugin** | WA-Web/Baileys oder WA-Business API | WhatsApp-Verbindung |
| **Session Manager** | In-Memory + Persist | Gesprächs-Context verwalten |
| **Agent Runner** | LLM API Clients | Modelle aufrufen, Tool-Loop |
| **Tool Executor** | child_process + Playwright | exec/browser/etc. |
| **Cron Engine** | node-cron oder agenda | Scheduled Jobs |
| **Skill Loader** | fs + YAML parser | SKILL.md Dateien laden |
| **Memory System** | Markdown Files + Embeddings DB | Persistentes Gedächtnis |
| **Config Engine** | JSON Schema + Zod | openclaw.json validieren |
| **Plugin System** | Dynamic require/import | Erweiterbare Slots |

**Kritische Design-Entscheidungen:**
1. **Tool-Loop:** Agent → AI → Tool Call → Result → AI → ... (bis kein Tool mehr)
2. **Context Injection:** Workspace Files werden als System-Prompt Teil injiziert (nicht als User-Message)
3. **Session Isolation:** Sub-Agents haben eigene Sessions (kein Context-Leak nach oben)
4. **Tool-Permissions:** Per-Agent allow/deny List, erzwungen vor Tool-Execution
5. **Channel Security:** dmPolicy allowlist zuerst prüfen, bevor irgendwas verarbeitet wird

---

_Erstellt von Wanda · Stand: Live-System 2026-02-26 · Für Jannis' OpenClaw-Klon-Projekt_
