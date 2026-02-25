# CHANNEL ADAPTER CONTRACT

Stand: 2026-02-25

## Ziel

Stabile Schnittstelle zwischen externen Channels (z. B. `Wanda-Bots`) und `Wanda-Repo` Kern.

## Mindestfunktionen

- Auth-Status: `wanda auth status`
- Auth-Login: `wanda auth login <provider>`
- Auth-Logout: `wanda auth logout <provider>`
- Model-Routing-Test: `wanda test model <text>`

## Integrationsregeln

- CLI-Ausgaben duerfen geparst werden, aber nur ueber explizite Marker (`[OK]`, `[EXP]`, `[KEY]`, `Antwort:`).
- Timeouts pro Aufruf setzen (Standard 180s, Login bis 600s).
- Fehlertexte unverfaelscht weiterreichen; keine stillen Failures.
- Provider-/Model-Switches dokumentieren, da `model select` aktuell global wirkt.
