#!/usr/bin/env bash
# 一键运行全部自动化检查：单元测试、浏览器端到端测试、install.sh 测试、C9 脚本自测
set -u
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
FAIL=0
step() { printf '\n== %s ==\n' "$1"; }

step "同步示例目录里的模板副本"
for s in realtime-billing go-channel sql-tuning; do
  cp interview-sprint/assets/course.html "examples/$s/course.html"
done
cp interview-sprint/assets/index.html examples/index.html
echo "已复制 course.html ×3、index.html"

step "单元测试（node --test）"
node --test tests/unit || FAIL=1

step "浏览器测试（Chrome 打开 file://，逐个文件串行执行）"
LOG="$(mktemp)"
node --test --test-concurrency=1 --test-timeout=180000 tests/e2e 2>&1 | tee "$LOG"
[ "${PIPESTATUS[0]}" -eq 0 ] || FAIL=1
SKIPPED="$(grep -E '^ℹ skipped [0-9]+' "$LOG" | awk '{print $3}')"
if [ -n "$SKIPPED" ] && [ "$SKIPPED" -gt 0 ]; then
  echo "✖ 有 $SKIPPED 项浏览器测试被跳过（原因见上方 SKIP 行），B 组验收不完整，按未通过处理。"
  FAIL=1
fi
rm -f "$LOG"

step "install.sh"
bash tests/install.test.sh || FAIL=1

step "C9 哈希脚本自测"
TMP="$(mktemp -d)"
mkdir -p "$TMP/.interview_points"
cp interview-sprint/assets/index.html "$TMP/.interview_points/index.html"
for s in realtime-billing go-channel sql-tuning; do
  mkdir -p "$TMP/.interview_points/$s"
  cp "examples/$s/course.html" "examples/$s/course-data.js" "$TMP/.interview_points/$s/"
done
c9() { bash tests/c9-hash-check.sh "$TMP" "$ROOT/interview-sprint" >/dev/null 2>&1; echo $?; }
[ "$(c9)" = 0 ] && echo "✔ 未修改时通过" || { echo "✖ 未修改时应通过"; FAIL=1; }
printf ' ' >> "$TMP/.interview_points/go-channel/course.html"
[ "$(c9)" = 1 ] && echo "✔ 修改后报 CHANGED" || { echo "✖ 修改后应报 CHANGED"; FAIL=1; }
rm -rf "$TMP/.interview_points"
[ "$(c9)" = 2 ] && echo "✔ 没有工作区时退出码 2" || { echo "✖ 没有工作区时应退出码 2"; FAIL=1; }
rm -rf "$TMP"

if [ "$FAIL" -eq 0 ]; then printf '\n全部通过。\n'; else printf '\n有检查未通过，见上方输出。\n'; fi
exit "$FAIL"
