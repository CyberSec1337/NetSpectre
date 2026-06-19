#!/bin/bash
# ═══════════════════════════════════════════════════════════
#  EvilLimiter Web — Demo Mode Launcher (No sudo needed)
# ═══════════════════════════════════════════════════════════

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PYTHON="$SCRIPT_DIR/backend/venv/bin/python"
APP="$SCRIPT_DIR/backend/app.py"

echo ""
echo "  ⚠️  DEMO MODE — Simulated network data"
echo "  💡 For real network data run: sudo bash start_real.sh"
echo ""

cd "$SCRIPT_DIR/backend"
"$PYTHON" "$APP"
