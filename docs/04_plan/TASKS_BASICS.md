# TASKS BASICS - Wanda-Repo

Stand: 2026-02-25

## Ziel (Basics)

Stabiles Kernsystem fuer Provider-Routing, OAuth, Channel-Bridge und reproduzierbaren Betrieb.

## Aufgaben

- [x] OAuth-CLI Flows vorhanden (`auth login/status/logout`)
- [x] Multi-Provider-Router vorhanden (Gemini/OpenAI/Anthropic/Kimi/GitHub)
- [x] Provider-Konfiguration bereinigen (Dummy Keys vermeiden, klare Enable-Regeln)
- [x] Modell-Fallback-Kette gegen echte Verfuegbarkeit validieren
- [x] Output-Token-Limits als env-gesteuerte Guardrails fuer OpenAI/Anthropic/Gemini
- [x] Channel-Adapter-Vertrag fuer externe Bots dokumentieren
- [x] Smoke-Test-Paket fuer `wanda auth status` + `wanda test model` + Fehlerpfade
- [x] Handbuch fuer OAuth-Betrieb mit Bots (Browser-Flow, Timeouts, Retry)
- [x] Repo-Readiness-Pack: `docs/00_overview/PROJECT.md`, `docs/04_plan/{TASKS,MILESTONES,HANDOFF}.md`, Release-Checkliste
- [x] Repo-Umzug auf `Wanda-Repo` in Doku + CLI Wrapper konsistent umgesetzt
- [x] Validation-Flow nach Umzug erneut gruen (`pnpm run validate:basics`)
- [x] P1 Testluecken geschlossen (`channels`, `secrets`, `memory`, `sandbox`)
- [x] OpenClaw Cron-Fehlerhistorie fuer kritische Jobs auf `ok` gedreht (Live-Runs + Job-Haertung)

## Nicht im Basics-Scope

- Vollstaendige Produkt-Finalisierung
- Neue Groß-Features ausser Stabilisierung
