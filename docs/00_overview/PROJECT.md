# PROJECT - Wanda-Repo

Stand: 2026-02-25

## Zweck

`Wanda-Repo` ist der Kern-Backbone fuer Routing, OAuth, Provider-Fallbacks und zentrale Bot-Laufzeit.

## Grenzen

- Kein Monolith fuer alle UIs/Channels
- Externe Channels (z. B. `Wanda-Bots`) greifen ueber klar definierte Schnittstellen/CLI-Bridges zu

## Betriebsziele (Basics)

- OAuth-Flows stabil
- Model-Router reproduzierbar
- Debug/Validate fuer KI-Agenten einfach triggerbar
