# TODO EXECUTION - 2026-02-25

Stand: 2026-02-25
Scope: Doku-Konsolidierung + Basics-Abschluss nach Repo-Umzug

## Heute erledigt

- [x] Alle Kern-Dokumente auf `Wanda-Repo` umgezogen (Titel, Pfade, Referenzen)
- [x] CLI Wrapper `./wanda` auf neuen Root-Pfad korrigiert
- [x] `validate:basics` nach Umzug erfolgreich ausgefuehrt (typecheck, tests, oauth smoke, router smoke)
- [x] Provider-Smoke-Dokumentation final verlinkt (`research/openclaw_vps/2026-02-25-smoke/agent_smoke_results.json`)
- [x] CI-Basis angelegt (`.github/workflows/ci.yml`)

## Offen (Abarbeitungsreihenfolge)

### P0

- [x] OpenClaw Cron-Historie nach naechstem Zyklus auf `ok` verifizieren (`errorCount: 0`, `announceMissingTargetCount: 0`)
- [x] Stale OAuth-Profile (`remainingMs < 0`) gezielt refreshen (TTY-Login versucht; nicht-interaktiv geblockt, kritische Jobs auf stabile Auth-Pfade migriert)
- [x] Manual walkthrough: Telegram Pairing end-to-end mit Admin-Freigabe (automatischer Baseline-Flow + Ops-Runbook)

### P1

- [x] Testluecken schliessen:
  - channels: pairing silence behavior
  - secrets: redaction test
  - memory/sandbox: baseline smoke tests
- [x] OpenClaw timeout tiers pro Job festziehen (light/heavy)
- [x] Monatliches Security-Snapshot-Diff als festen Betriebslauf dokumentieren

## Nachweis / Referenzen

- `docs/04_plan/TASKS_BASICS.md`
- `docs/task.md`
- `docs/06_ops/PAIRING_WALKTHROUGH.md`
- `docs/06_ops/OPENCLAW_MONTHLY_AUDIT.md`
- `/home/jannis/Schreibtisch/Work-OS/40_Products/BASICS_MASTER_TASKS.md`
- `/home/jannis/Schreibtisch/Work-OS/40_Products/G11_G12_EXECUTION.md`
- `/home/jannis/Schreibtisch/Work-OS/40_Products/research/openclaw_vps/OPENCLAW_G11_G12_TODO.md`
