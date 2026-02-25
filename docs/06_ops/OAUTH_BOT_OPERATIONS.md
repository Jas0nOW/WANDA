# OAUTH BOT OPERATIONS

Stand: 2026-02-25

## Flows

- Status: `wanda auth status`
- Login: `wanda auth login <gemini|openai|anthropic|github|kimi>`
- Logout: `wanda auth logout <provider>`

## Laufzeitverhalten

- Login kann Browser-OAuth triggern und bis zu 10 Minuten dauern.
- Bei Headless/Remote-Setups muss URL-Fallback (manuelles Einfuegen) verfuegbar bleiben.
- Bots sollten Login-Antworten in kompakter Form (Tail-Logs) an User geben.

## Debug

- `LOG_LEVEL=debug` fuer Bot-Laufzeit
- `wanda doctor` fuer Umgebung/Token/Key Diagnose

## Sicherheit

- Tokens/Keys nie in Channel-Antworten ausgeben.
- Nur Statusmetadaten (valide/abgelaufen, Provider, Ablaufzeit) anzeigen.
