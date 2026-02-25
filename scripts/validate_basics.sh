#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

echo "[wanda] typecheck"
pnpm -r typecheck

echo "[wanda] unit tests"
pnpm -r test

echo "[wanda] oauth smoke"
./wanda auth status >/dev/null

echo "[wanda] router smoke"
./wanda test model "reply with exactly: ok" >/dev/null

echo "[wanda] validate: OK"
