# PAIRING WALKTHROUGH

Stand: 2026-02-25

## Ziel

Pairing-Flow reproduzierbar validieren (unknown user -> pending -> admin approve -> approved).

## Automatischer Baseline-Check (erledigt)

- Test: `packages/channels/tests/pairing.test.ts`
- Ergebnis: unknown user bleibt unapproved bis OTP-Approval; Admin-Bootstrap vorhanden
- Lauf enthalten in: `pnpm run validate:basics`

## Manueller Telegram Check

Voraussetzung:
- `TELEGRAM_BOT_TOKEN` gesetzt
- `TELEGRAM_ALLOWED_USERS` gesetzt

Flow:
1. Bot starten: `pnpm run debug:bot`
2. Ungepairte User-Nachricht senden (keine direkte Antwort erwartet)
3. Admin erhält OTP-Hinweis
4. Admin führt `/pair approve <otp>` aus
5. User sendet erneut und erhält Antwort

Hinweis:
- In dieser Session war der manuelle Telegram-Check ohne gesetzte `TELEGRAM_*` Variablen nicht ausführbar.
