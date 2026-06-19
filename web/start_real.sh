#!/bin/bash
# ═══════════════════════════════════════════════════════════
#  EvilLimiter Web — Real Network Mode Launcher
# ═══════════════════════════════════════════════════════════
#
#  للتشغيل في REAL MODE (بيانات حقيقية من الشبكة):
#    sudo bash start_real.sh
#
#  للتشغيل في DEMO MODE (بيانات تجريبية):
#    bash start_demo.sh
# ═══════════════════════════════════════════════════════════

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PYTHON="$SCRIPT_DIR/backend/venv/bin/python"
APP="$SCRIPT_DIR/backend/app.py"

if [ "$EUID" -ne 0 ]; then
    echo ""
    echo "  ❌ يجب تشغيل هذا السكريبت بصلاحيات root لـ Real Mode"
    echo ""
    echo "  الحل: sudo bash $(basename "$0")"
    echo ""
    exit 1
fi

echo ""
echo "  ✅ يعمل بصلاحيات root — REAL NETWORK MODE ACTIVE"
echo ""

cd "$SCRIPT_DIR/backend"
"$PYTHON" "$APP"
