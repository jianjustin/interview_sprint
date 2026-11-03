#!/usr/bin/env bash
# C9：核对工作区里复制过去的 course.html / index.html 与 skill 模板是否逐字节一致（即从未被修改）。
# 用法：bash tests/c9-hash-check.sh [工作目录，默认当前目录] [skill 目录，默认 ~/.agents/skills/interview-sprint]
# 退出码：0 全部一致；1 有文件被改过；2 找不到工作区或模板
set -u
WS="${1:-.}"
SKILL="${2:-$HOME/.agents/skills/interview-sprint}"
P="$WS/.interview_points"

sha() {
  if command -v shasum >/dev/null 2>&1; then shasum -a 256 "$1" | cut -d' ' -f1
  else sha256sum "$1" | cut -d' ' -f1; fi
}

for f in "$SKILL/assets/course.html" "$SKILL/assets/index.html"; do
  [ -f "$f" ] || { echo "找不到模板 $f" >&2; exit 2; }
done
[ -d "$P" ] || { echo "找不到 $P（请传入启动 agent 时所在的目录）" >&2; exit 2; }

TC="$(sha "$SKILL/assets/course.html")"
TI="$(sha "$SKILL/assets/index.html")"
echo "模板 course.html sha256 = $TC"
echo "模板 index.html  sha256 = $TI"

found=0
bad=0
check() {
  local file="$1" want="$2" got
  got="$(sha "$file")"
  if [ "$got" = "$want" ]; then echo "OK       $file"
  else echo "CHANGED  $file (sha256 = $got)"; bad=1; fi
}
for f in "$P"/*/course.html; do
  [ -e "$f" ] || continue
  found=1
  check "$f" "$TC"
done
[ -e "$P/index.html" ] && check "$P/index.html" "$TI"

if [ "$found" -eq 0 ]; then echo "$P 下没有任何主题的 course.html" >&2; exit 2; fi
if [ "$bad" -eq 0 ]; then echo "C9 通过：所有复制的模板都未被修改。"; else echo "C9 未通过：有模板文件被修改。"; fi
exit "$bad"
