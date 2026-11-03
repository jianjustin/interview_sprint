#!/usr/bin/env bash
# install.sh 行为测试：全部在临时 HOME 里进行，不触碰真实的 skill 目录
set -u
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PKG="$ROOT/interview-sprint"
FAIL=0
pass() { echo "✔ $1"; }
fail() { echo "✖ $1"; FAIL=1; }
fresh_home() { HOME_DIR="$(mktemp -d)"; }
run() { env -u CLAUDE_CONFIG_DIR HOME="$HOME_DIR" bash "$ROOT/install.sh" "$@"; }
link_ok() { [ -L "$1" ] && [ "$(readlink "$1")" = "$PKG" ]; }

# 1. 首次安装：三个默认位置都是指向包目录的软链接
fresh_home
if run >/dev/null 2>&1 \
  && link_ok "$HOME_DIR/.claude/skills/interview-sprint" \
  && link_ok "$HOME_DIR/.claude-ccswitch/skills/interview-sprint" \
  && link_ok "$HOME_DIR/.agents/skills/interview-sprint"; then
  pass "首次安装创建 3 个软链接"
else fail "首次安装创建 3 个软链接"; fi

# 2. 重复执行：退出码 0，结果不变
if run >/dev/null 2>&1 && link_ok "$HOME_DIR/.agents/skills/interview-sprint"; then
  pass "重复执行幂等"
else fail "重复执行幂等"; fi

# 3. CLAUDE_CONFIG_DIR 追加一个 Claude 目录
fresh_home
if env HOME="$HOME_DIR" CLAUDE_CONFIG_DIR="$HOME_DIR/x" bash "$ROOT/install.sh" >/dev/null 2>&1 \
  && link_ok "$HOME_DIR/x/skills/interview-sprint" \
  && link_ok "$HOME_DIR/.claude/skills/interview-sprint"; then
  pass "CLAUDE_CONFIG_DIR 追加安装位置"
else fail "CLAUDE_CONFIG_DIR 追加安装位置"; fi

# 4. --claude-dir 覆盖默认 Claude 目录；--add-claude-dir 追加
fresh_home
if run --claude-dir "$HOME_DIR/only" --add-claude-dir "$HOME_DIR/more" >/dev/null 2>&1 \
  && link_ok "$HOME_DIR/only/skills/interview-sprint" \
  && link_ok "$HOME_DIR/more/skills/interview-sprint" \
  && link_ok "$HOME_DIR/.agents/skills/interview-sprint" \
  && [ ! -e "$HOME_DIR/.claude/skills/interview-sprint" ] \
  && [ ! -e "$HOME_DIR/.claude-ccswitch/skills/interview-sprint" ]; then
  pass "--claude-dir 覆盖、--add-claude-dir 追加"
else fail "--claude-dir 覆盖、--add-claude-dir 追加"; fi

# 5. 已有同名真实目录：退出码 1，提示原因，其他目标都没有被创建
fresh_home
mkdir -p "$HOME_DIR/.agents/skills/interview-sprint"
out="$(run 2>&1)"; code=$?
if [ "$code" -eq 1 ] && echo "$out" | grep -q "不是软链接" \
  && [ ! -e "$HOME_DIR/.claude/skills/interview-sprint" ] \
  && [ -d "$HOME_DIR/.agents/skills/interview-sprint" ] && [ ! -L "$HOME_DIR/.agents/skills/interview-sprint" ]; then
  pass "遇到同名真实目录时提示并退出、不半装"
else fail "遇到同名真实目录时提示并退出、不半装（code=$code）: $out"; fi

# 6. 指向别处的旧软链接：更新为本包
fresh_home
mkdir -p "$HOME_DIR/.claude/skills" "$HOME_DIR/old"
ln -s "$HOME_DIR/old" "$HOME_DIR/.claude/skills/interview-sprint"
if run >/dev/null 2>&1 && link_ok "$HOME_DIR/.claude/skills/interview-sprint"; then
  pass "更新指向别处的旧软链接"
else fail "更新指向别处的旧软链接"; fi

# 7. --uninstall 只删除指向本包的软链接
fresh_home
run >/dev/null 2>&1
mkdir -p "$HOME_DIR/other"
rm "$HOME_DIR/.claude-ccswitch/skills/interview-sprint"
ln -s "$HOME_DIR/other" "$HOME_DIR/.claude-ccswitch/skills/interview-sprint"
if run --uninstall >/dev/null 2>&1 \
  && [ ! -e "$HOME_DIR/.claude/skills/interview-sprint" ] \
  && [ ! -e "$HOME_DIR/.agents/skills/interview-sprint" ] \
  && [ -L "$HOME_DIR/.claude-ccswitch/skills/interview-sprint" ]; then
  pass "--uninstall 只删除本包的软链接"
else fail "--uninstall 只删除本包的软链接"; fi

# 8. --dry-run 不做任何改动
fresh_home
if run --dry-run >/dev/null 2>&1 && [ ! -e "$HOME_DIR/.claude" ] && [ ! -e "$HOME_DIR/.agents" ]; then
  pass "--dry-run 不改动文件"
else fail "--dry-run 不改动文件"; fi

# 9. 未知参数：退出码 2
fresh_home
run --bogus >/dev/null 2>&1; code=$?
if [ "$code" -eq 2 ]; then pass "未知参数退出码 2"; else fail "未知参数退出码 2（code=$code）"; fi

# 以下用临时的本地 git 仓库模拟远程，不访问网络
GITC=(git -c user.name=test -c user.email=test@example.com -c init.defaultBranch=main)
make_origin() {
  WORK="$(mktemp -d)"
  mkdir -p "$WORK/src"
  cp -R "$ROOT/install.sh" "$PKG" "$WORK/src/"
  "${GITC[@]}" -C "$WORK/src" init -q
  "${GITC[@]}" -C "$WORK/src" add -A
  "${GITC[@]}" -C "$WORK/src" commit -qm init
  git clone -q --bare "$WORK/src" "$WORK/origin.git"
}

# 10. --git：clone 到指定目录，链接指向 clone 里的包
fresh_home; make_origin
MANAGED="$HOME_DIR/managed"
if run --git "$MANAGED" --repo "$WORK/origin.git" >/dev/null 2>&1 \
  && [ -d "$MANAGED/.git" ] \
  && [ "$(readlink "$HOME_DIR/.agents/skills/interview-sprint")" = "$MANAGED/interview-sprint" ] \
  && [ "$(readlink "$HOME_DIR/.claude/skills/interview-sprint")" = "$MANAGED/interview-sprint" ]; then
  pass "--git clone 后链接到 clone"
else fail "--git clone 后链接到 clone"; fi

# 11. --update：拉取远程的新提交，链接保持有效
git clone -q "$WORK/origin.git" "$WORK/dev"
echo "<!-- update-marker -->" >> "$WORK/dev/interview-sprint/SKILL.md"
"${GITC[@]}" -C "$WORK/dev" commit -qam "update"
git -C "$WORK/dev" push -q origin HEAD 2>/dev/null
if env -u CLAUDE_CONFIG_DIR HOME="$HOME_DIR" bash "$MANAGED/install.sh" --update >/dev/null 2>&1 \
  && grep -q "update-marker" "$HOME_DIR/.agents/skills/interview-sprint/SKILL.md"; then
  pass "--update 拉取新提交"
else fail "--update 拉取新提交"; fi

# 12. 再次 --git：已存在的 clone 直接更新，不重复 clone
if run --git "$MANAGED" --repo "$WORK/origin.git" >/dev/null 2>&1 && [ -d "$MANAGED/.git" ]; then
  pass "--git 对已有 clone 幂等"
else fail "--git 对已有 clone 幂等"; fi

# 13. --update：有未提交改动时拒绝
echo "local edit" >> "$MANAGED/interview-sprint/SKILL.md"
out="$(env -u CLAUDE_CONFIG_DIR HOME="$HOME_DIR" bash "$MANAGED/install.sh" --update 2>&1)"; code=$?
if [ "$code" -eq 1 ] && echo "$out" | grep -q "未提交"; then
  pass "--update 遇到未提交改动时拒绝"
else fail "--update 遇到未提交改动时拒绝（code=$code）: $out"; fi

# 14. --update：不是 git 仓库时给出说明
fresh_home
PLAIN="$(mktemp -d)"
cp -R "$ROOT/install.sh" "$PKG" "$PLAIN/"
out="$(env -u CLAUDE_CONFIG_DIR HOME="$HOME_DIR" bash "$PLAIN/install.sh" --update 2>&1)"; code=$?
if [ "$code" -eq 1 ] && echo "$out" | grep -q "不是 git 仓库"; then
  pass "--update 在非 git 目录中给出说明"
else fail "--update 在非 git 目录中给出说明（code=$code）: $out"; fi

# 15. --git 目标已存在但不是 git 仓库：拒绝
fresh_home; make_origin
mkdir -p "$HOME_DIR/occupied"; echo x > "$HOME_DIR/occupied/file"
out="$(run --git "$HOME_DIR/occupied" --repo "$WORK/origin.git" 2>&1)"; code=$?
if [ "$code" -eq 1 ] && [ ! -e "$HOME_DIR/.agents/skills/interview-sprint" ]; then
  pass "--git 目标目录被占用时拒绝"
else fail "--git 目标目录被占用时拒绝（code=$code）: $out"; fi

exit $FAIL
