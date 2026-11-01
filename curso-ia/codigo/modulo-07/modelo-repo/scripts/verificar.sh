#!/usr/bin/env bash
# "Definição de pronto": o que precisa passar para uma mudança (humana ou de agente) ser aceita.
# Usado pelo agente (CLAUDE.md), pelo hook de fim de tarefa e pelo CI.
set -euo pipefail
cd "$(dirname "$0")/.."

echo "▶ typecheck"
npx tsc --noEmit

echo "▶ testes"
npx tsx --test test/*.test.ts

echo "▶ segurança do código"
python3 ../python/checar_codigo_gerado.py src

echo "✓ pronto"
