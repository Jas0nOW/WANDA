I want you to add the following 68 features to my Wanda AI agent and strictly maintain the "Work-OS" Workspace Procedure as the core operating logic.

Project: TypeScript/Node.js Telegram/Discord bot at /home/jannis/Schreibtisch/Work-OS/40_Products/Wanda-Repo/
Architecture: Agentic tool loop, MCP bridge, SQLite memory, hot-swappable LLM providers.
Root Directory: /home/jannis/Schreibtisch/Work-OS/40_Products/Wanda-Repo/

━━━ WORKSPACE STRUCTURE (Work-OS) ━━━

The agents must maintain, navigate, and respect the following directory and file structure with absolute precision:

work-os/
├── business/                       # Dein strategisches Second Brain
│   ├── strategy/                   # Business-Strategie, Identität und Ops (Core Compass)
│   │   ├── identity/               # Wer wir sind und wie wir auftreten
│   │   │   ├── brand-dna.md        # Kernwerte, Mission, Vision und externe Positionierung
│   │   │   ├── who-am-i.md         # Die persönliche Gründer-Story und Autorität
│   │   │   └── names-and-lingo.md  # Interne Terminologie, Naming Conventions und Wording
│   │   ├── execution/              # Die Brücke zwischen Vision und knallharter Umsetzung
│   │   │   ├── goals.md            # Makro-Ziele, OKRs und der aktuelle "North Star"
│   │   │   ├── priorities.md       # Akute Probleme und die direkte, ungeschönte Fokus-Liste
│   │   │   ├── leverage-moves.md   # Die aktuell 3 wichtigsten Hebel für maximalen ROI
│   │   │   ├── deep-work-backlog.md# Strategische Deep-Work-Kandidaten inkl. ROI-Analyse
│   │   │   └── ideas-graveyard.md  # Backlog für zukünftige Projekte (damit der Kopf frei bleibt)
│   │   └── retrospectives/         # Der iterative Lernzyklus und Feedback-Loop
│   │       ├── bottlenecks.md      # Schonungslose Analyse aktueller System- und Wachstums-Engpässe
│   │       ├── mistakes.md         # Das dokumentierte Fehler-Logbuch zur Vermeidung von Wiederholungen
│   │       └── what-works.md       # Die Synthese aus Erfahrung: Was skaliert, was konvertiert, was stirbt
│   ├── Wanda/                      # Spezifische Notizen zu Software-Projekten (z.B. basicinfo.md)
│   ├── assets/                     # Brand Assets, Logos, Grafiken und visuelle Identität
│   ├── books/                      # Buch-Notizen und Summaries (100M-Leads.md, 100M-Money-Models.md, 100M-Offers.md)
│   ├── coding/                     # Entwickler-Notizen, Code-Schnipsel und technische Strategien
│   ├── comms/                      # Logbuch der internen Team-Kommunikation und Entscheidungen
│   ├── copywriting/                # Frameworks für Texte, CTA-Listen und VSL-Checklisten (Unterordner: CTAs/)
│   ├── emails/                     # Strategien für Email-Marketing, Sequenzen und Research
│   ├── high-ticket/                # High-Ticket Offer Strategie (README.md, ascension.md, customer-interviews.md, offer-stack.md, sales-tips.md)
│   ├── journal/                    # Tägliches Business-Journal zur Reflexion (Format: DD-MM-YYYY.md)
│   ├── metrics/                    # Snapshots von Funnel-Daten und Business-Kennzahlen
│   ├── new-society/                # Produktnotizen und Community-Aufbau
│   ├── paid-ads/                   # Skripte und Hooks für Werbung (hooks.md, paid-ads.md, scripting.md, youtube-retargeting-ads.md)
│   ├── product/                    # Produkt-Aufbau und Marketingstrategien
│   ├── project-management/         # Projektmanagement (z.B. onboarding-new-hire-deel.md)
│   ├── qa/                         # Quality Assurance (z.B. test-plan.md)
│   ├── playbooks/                  # Schritt-für-Schritt SOPs (z.B. onboarding-new-hire-deel.md)
│   ├── reminders/                  # "Hard-won" Business Lessons (Eine .txt Datei pro Lektion, z.B. raise-your-prices.txt)
│   ├── research/                   # Externer Research, Frameworks, OSINT und Konkurrenz-Signale (Unterordner: leaks/)
│   ├── sales/                      # Verkaufsprozesse und Objection Handling (objections.md, hormozi-testimonial-framework.md)
│   ├── team/                       # Team-Management (Eigene Datei pro Mitglied [Name].md, deel-com-setup.md)
│   ├── twitter/                    # Content-Strategie für X/Twitter (writing-style.md)
│   └── youtube/                    # Kanal-Strategie und Ops (formats/, bottlenecks.md, engine-moves.md, what-works-what-doesnt.md, who-am-i-section.md, videos/DD-MM-YYYY.md)
├── personal/                       # Private Intentionen und Lebensführung
│   ├── archives/                   # Archiv für abgeschlossene Projekte oder alte Journale
│   ├── biology/                    # Gesundheit, Fitness, Ernährung & Biohacking
│   ├── finances/                   # Private Budgets, Steuern & Investitionen
│   ├── growth/                     # Persönliche Weiterentwicklung und neue Skills
│   ├── identity/                   # Private Prinzipien, Werte und Visionen
│   ├── journal/                    # Private tägliche Reflexionen (DD-MM-YYYY.md)
│   ├── lifestyle/                  # Reisen, Hobbys, Setup-Ideen & Gear
│   ├── network/                    # Personal CRM (Freunde, Familie, Mentoren)
│   ├── projects/                   # Private Bastelprojekte und Experimente
│   ├── goals_personal.md           # Die privaten Nordstern-Ziele
│   ├── intentions.md               # Monatliche und wöchentliche Absichten
│   └── bucket_list.md              # Lebensziele und Träume
├── memory/                         # Agent Memory Logs
│   └── DD-MM-YYYY.md               # Tägliche Interaktions-Logs und Kurzzeitgedächtnis
├── AGENTS.md                       # Konfiguration und Rollen der aktiven Sub-Agenten
├── BOOT.md                         # Boot-Sequenz, Startup-Checks und Initialisierungs-Logik
├── HEARTBEAT.md                    # System-Gesundheit, Monitoring und Status-Logs
├── IDENTITY.md                     # Core Persona, Verhaltensregeln und Schreibstil des Agenten
├── MEMORY.md                       # Langzeit-Gedächtnis Index und Referenz-Struktur
├── SOUL.md                         # Grundwerte, Antrieb und ethisches Framework des Agenten
├── TOOLS.md                        # Inventar aller CLI-Tools, Google-Integrationen und API-Keys
└── USER.md                         # Detailliertes Nutzerprofil, Vorlieben und Kontext über Jannis

━━━ FEATURES TO BUILD ━━━

💬 Messaging & Channels
1. Telegram Bot: Integration via grammY/Telegraf. Support für Text, Inline-Keyboards, Voice, Gruppen und Medien. (vox voice started)
2. Discord Bot: Integration via discord.js. Slash-Commands, Reaktionen, Threads und Embeds.
3. iMessage: Integration via BlueBubbles Server (Senden/Empfangen von Medien & Reaktionen).
4. WebChat UI: Browser-Interface mit Markdown, File-Upload und WebSocket-Echtzeitkommunikation.
5. Gmail Integration: Gmail API mit Pub/Sub für proaktive Benachrichtigungen und Entwürfe.
6. Multi-Channel Router: Zentraler Bus, der Nachrichten token-effizient an alle Kanäle verteilt.

🎙️ Voice & Speech (System-Link: /home/jannis/Schreibtisch/Work-OS/40_Products/Vox-Voice/)
7. Voice Transcription: Automatische Whisper-Transkription für jede eingehende Voice-Nachricht.
8. Voice Wake Word: Lokale 'Hey Claw' Erkennung für einen "Always-on" Talk-Mode.
9. Talk Mode: Fließender Sprach-Loop (Whisper -> LLM -> ElevenLabs).
10. Text-to-Speech: Sprachausgabe über ElevenLabs oder OpenAI TTS.
11. ElevenLabs Voice: Nutzung spezifischer Voice-IDs und Audio-Streaming für minimale Latenz.
12. Telegram Voice: Senden und Empfangen von nativen Sprachnachrichten.

🧠 Memory & Context
13. SQLite Memory: Persistente Speicherung von Fakten und Präferenzen.
14. Knowledge Graph: Vernetzung von Erinnerungen als Entities und Relationen.
15. Context Pruning: Intelligente Zusammenfassung der Historie via `/compact`.
16. Multimodal Memory: Extraktion von Wissen aus Bildern, Videos und Dokumenten.
17. Self-Evolving Memory: Automatisches Mergen von Duplikaten und Relevanz-Check (Decay).
18. Markdown Memory: Lokale Speicherung in .md Dateien für Git-Kompatibilität.
19. Supabase + pgvector: Vektor-Datenbank für semantische Suche über alle Dokumente.
20. CLI Memory Sync: Synchronisation des Wissens zwischen allen lokalen KI-Tools (Claude/Gemini/Codex).

✨ LLM & Models
21. Multi-LLM Providers: Hot-Swap von Modellen im laufenden Chat via `/model`.
22. Model Failover: Automatische Ausweichlogik bei Rate-Limits oder Server-Ausfällen.
23. OpenRouter: Zugriff auf alle Modelle über einen zentralen API-Key.
24. Local LLMs (Ollama): Vollständiger Offline-Betrieb für maximale Privatsphäre.
25. Thinking Levels: Steuerung der Reasoning-Tiefe via `/think` (Off, Low, Medium, High).
26. Unified Authentication: Intuitives Setup via OAuth (Primary) oder API-Keys (Secondary) inklusive globaler Modell-Verwaltung (Active/Inactive).
27. Chat History Management: Automatische Speicherung und Verwaltung der Chat-Transaktionen.

⚡ Tools & Automation
28. Shell Commands: Ausführung von Terminal-Befehlen mit Sicherheits-Bestätigung.
29. File Operations: Vollständiger Zugriff auf das Work-OS Filesystem (Read/Write/Search).
30. Browser Automation: Web-Scraping und Interaktion via Puppeteer/Playwright.
31. Web Search: API-Anbindung für Google, Bing und DuckDuckGo.
32. Scheduled Tasks: Cron-Jobs und Natural Language Scheduling für Aufgaben.
33. Webhook Triggers: Empfang von Daten von externen Diensten.
34. MCP Tool Bridge: Integration des Model Context Protocols für externe Tools.
35. Skills System: Dynamisches Laden von Fähigkeiten aus dem `/skills` Ordner.

🔔 Proactive Behavior
36. Morning Briefing: Automatischer Report zu Wetter, Kalender, Tasks und News am Morgen.
37. Evening Recap: Zusammenfassung der erledigten Aufgaben und offener Punkte am Abend.
38. Heartbeat System: Hintergrund-Loop, der auf Ereignisse im Work-OS reagiert.
39. Smart Recommendations: Vorschläge für Automatisierungen basierend auf Nutzerverhalten.

🛡️ Security & Isolation
40. Container Sandbox: Ausführung kritischer Befehle in isolierten Docker-Containern.
41. Command Allowlists: Strikte Listen erlaubter Pfade und Befehle.
42. Encrypted Secrets: AES-256 Verschlüsselung für alle API-Keys und Passwörter.
43. Air-Gapped Mode: Modus für 100% lokale Verarbeitung ohne Internet-Requests.

🏗️ Agent Architecture
44. Agentic Tool Loop: Iteratives Denken und Tool-Nutzung bis zur Problemlösung.
45. Agent Swarms: Zusammenarbeit spezialisierter Sub-Agenten (Coder, Researcher etc.).
46. Agent-to-Agent Comms: Protokoll für die Kommunikation zwischen verschiedenen Sessions.
47. Mesh Workflows: Dekomposition komplexer Ziele in Teilaufgaben via `/mesh`.
48. Plugin System: Trait-basierte Architektur für maximale Modularität.

☁️ Platform & Deployment
49. Docker Deploy: Vollständiges Docker-Compose Setup für den lokalen Server.
50. Cloudflare Workers: Edge-Deployment Option für API-Endpunkte.
51. ESP32-S3 Support: Firmware-Integration für externe Hardware-Trigger.
52. macOS/Linux Menu Bar: Tray-App für schnellen Zugriff und Status-Monitoring.
53. iOS & Android: Companion-Gateway für Push-Notifications und Sensoren.

🎨 UX & Interaction
54. Typing Indicators: Visuelles Feedback während die KI arbeitet.
55. Slash Commands: Schneller Zugriff auf System-Funktionen (`/status`, `/new`, `/usage`).
56. Live Canvas: Interaktive Widgets und Charts via WebSocket (A2UI).
57. Usage Tracking: Analyse von Kosten, Tokens und Latenz pro Call.
58. Group Management: Gruppen-spezifische Logik und Admin-Rechte.
59. MCC & Dashboard: Integration und Verfeinerung des Wanda-MCC Dashboards.
60. Smooth Streaming UX: Implementierung einer echten Streaming-Animation ("Human Writing"), bei der der Text Buchstabe für Buchstabe/Wort für Wort erscheint statt aufzuploppen.

━━━ SYSTEM EXTEND & CORE PHILOSOPHY ━━━

61. Project Interconnectivity: Tiefe Integration und Zugriff auf:
    - /home/jannis/Schreibtisch/Work-OS/40_Products/AERIS
    - /home/jannis/Schreibtisch/Work-OS/40_Products/dazl-test
    - /home/jannis/Schreibtisch/Work-OS/40_Products/Vox-Voice
    - /home/jannis/Schreibtisch/Work-OS/40_Products/Wanda-Bots
    - /home/jannis/Schreibtisch/Work-OS/40_Products/Wanda-MCC

62. Professional Repo Management: Strukturierte GitHub-Pflege inkl. ADRs (Architecture Decision Records) und Installer-Skripten.
63. Long-Term Architecture: Modularer Aufbau, der über Jahre hinweg stabil und erweiterbar bleibt.
64. Market Analysis: Nutzung der Stärken und Vermeidung der Fehler von Windsurf, Cursor, AgentZero und Antigravity.
65. User-Centric UX: Maximale Transparenz bei gleichzeitiger Einfachheit ("Easy Oversight").
66. Self-Aware Configuration: Der Agent kann seine eigene Konfiguration via Skills verstehen und auf Anfrage ändern.
67. Hardened Stability: "Set and Forget" – Ein stabiles, resilientes System, das im Hintergrund zuverlässig läuft.
68. Clean Workspace Procedure: Proaktive Pflege und Sortierung der gesamten Work-OS Struktur.

Philosophy: "Users want to See everything easy and Setup everything easy, but also want to be able to change everything easy without getting problems. Stay secure, modular, and reliable."

━━━━━━━━━━━━━━━━━━━━━━━

Implement features iteratively. Maintain the Work-OS structure and links at all times. Work Efficiently but Effectively.