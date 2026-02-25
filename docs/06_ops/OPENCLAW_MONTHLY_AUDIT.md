# OPENCLAW MONTHLY AUDIT

Stand: 2026-02-25

## Ziel

Monatlichen Security-Snapshot mit Diff gegen den letzten Monatsstand erzeugen.

## Kommando

```bash
cd /home/jannis/Schreibtisch/Work-OS/40_Products
./scripts/monthly_openclaw_security_snapshot.sh
```

## Output

- Snapshot: `research/openclaw_vps/monthly-YYYY-MM/`
- Security Summary: `security_audit.summary.json`
- Diff gegen letzten Monatsstand: `security_audit.diff.txt` (falls vorhanden)

## Cron (VPS)

```cron
# Monatlicher Security Snapshot + Diff (Tag 1 um 06:20 Europe/Berlin)
20 6 1 * * cd /home/jannis/Schreibtisch/Work-OS/40_Products && ./scripts/monthly_openclaw_security_snapshot.sh >> /var/log/wanda-security-monthly.log 2>&1
```

## Related Weekly Retention Job (VPS)

```cron
# Woechentliche Bereinigung alter Cron-Sessions (So 03:40 Europe/Berlin)
40 3 * * 0 /root/scripts/prune_openclaw_vps_cron_sessions.sh >> /var/log/openclaw-cron-prune.log 2>&1
```

- Script: `/root/scripts/prune_openclaw_vps_cron_sessions.sh`
- Archive output: `/data/.openclaw/archive/cron-session-cleanup/YYYYMMDDHHMMSS/`
- Retention: es bleiben nur die letzten 8 Snapshot-Ordner erhalten
