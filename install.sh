#!/usr/bin/env bash
# 把 interview-sprint/ 以软链接方式安装到 Claude Code、Codex、pi 的 skill 目录。
#   Claude Code：<配置目录>/skills/（默认 ~/.claude 和 ~/.claude-ccswitch）
#   Codex / pi：~/.agents/skills/（codex 0.164.0 与 pi 1.5.0 均会读取）
# 两种来源：
#   默认      链接到本脚本所在的这份仓库（适合开发）
#   --git     先把仓库 clone 到固定目录（默认 ~/.local/share/interview-sprint），再链接到那份 clone；
#             之后用 --update（git pull --ff-only）更新
set -euo pipefail

NAME="interview-sprint"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SRC="$ROOT/$NAME"
DEFAULT_REPO="https://github.com/jianjustin/interview_sprint.git"
DEFAULT_GIT_DIR="$HOME/.local/share/$NAME"

usage() {
  cat <<EOF
用法：./install.sh [选项]

  （无参数）              把本仓库的 $NAME/ 软链接到：
                            ~/.claude/skills/$NAME
                            ~/.claude-ccswitch/skills/$NAME
                            ~/.agents/skills/$NAME
                          设置了 CLAUDE_CONFIG_DIR 时，额外安装到 \$CLAUDE_CONFIG_DIR/skills/$NAME
  --git [DIR]             用 git 管理安装：把仓库 clone 到 DIR（默认 $DEFAULT_GIT_DIR，
                          已存在则 git pull），再把上述位置链接到 DIR 里的 $NAME/
  --repo URL              --git 使用的仓库地址（默认取本仓库的 origin，否则 $DEFAULT_REPO）
  --update                在本仓库执行 git pull --ff-only 后重新链接（有未提交改动时拒绝）
  --claude-dir DIR        用 DIR 代替默认的 Claude Code 配置目录（可重复）
  --add-claude-dir DIR    在默认之外再追加一个 Claude Code 配置目录（可重复）
  --uninstall             删除上述位置中指向本仓库 $NAME/ 的软链接
  --dry-run               只打印将要执行的操作，不做改动
  -h, --help              显示本帮助
EOF
}

MODE=install
DRY=0
GIT_TARGET=""
REPO=""
OVERRIDE=()
EXTRA=()
FORWARD=()   # 转交给 clone 中 install.sh 的参数
while [ $# -gt 0 ]; do
  case "$1" in
    --uninstall) MODE=uninstall ;;
    --update) MODE=update ;;
    --dry-run) DRY=1; FORWARD+=("$1") ;;
    --git)
      if [ $# -ge 2 ] && [ -n "$2" ] && [ "${2#-}" = "$2" ]; then GIT_TARGET="$2"; shift
      else GIT_TARGET="$DEFAULT_GIT_DIR"; fi ;;
    --repo)
      if [ $# -lt 2 ] || [ -z "$2" ]; then echo "缺少参数：$1 URL" >&2; exit 2; fi
      REPO="$2"; shift ;;
    --claude-dir|--add-claude-dir)
      if [ $# -lt 2 ] || [ -z "$2" ]; then echo "缺少参数：$1 DIR" >&2; exit 2; fi
      if [ "$1" = "--claude-dir" ]; then OVERRIDE+=("$2"); else EXTRA+=("$2"); fi
      FORWARD+=("$1" "$2")
      shift ;;
    -h|--help) usage; exit 0 ;;
    *) echo "未知参数：$1" >&2; usage >&2; exit 2 ;;
  esac
  shift
done

act() {
  if [ "$DRY" -eq 1 ]; then echo "  [dry-run] $*"; else "$@"; fi
}

need_git() {
  command -v git >/dev/null 2>&1 || { echo "✗ 找不到 git 命令。" >&2; exit 1; }
}

# 在 git 仓库 $1 中执行 git pull --ff-only；不是仓库或有未提交改动时拒绝
git_pull() {
  local dir top
  dir="$(cd "$1" && pwd -P)"
  top="$(git -C "$dir" rev-parse --show-toplevel 2>/dev/null || true)"
  if [ "$top" != "$dir" ]; then
    echo "✗ $1 不是 git 仓库，无法用 git 更新。请用 ./install.sh --git 安装，或 git clone 本仓库后再运行 install.sh。" >&2
    exit 1
  fi
  if [ -n "$(git -C "$dir" status --porcelain --untracked-files=no)" ]; then
    echo "✗ $1 有未提交的改动。为避免覆盖已停止，请先提交或还原后重试。" >&2
    exit 1
  fi
  echo "更新      $1（git pull --ff-only）"
  act git -C "$dir" pull --ff-only || { echo "✗ git pull 失败，请到 $1 手动处理。" >&2; exit 1; }
}

# --git：准备好 clone，然后交给 clone 里的 install.sh 去链接
if [ -n "$GIT_TARGET" ]; then
  need_git
  if [ "$MODE" != install ]; then echo "--git 不能与 --update / --uninstall 同时使用。" >&2; exit 2; fi
  if [ -z "$REPO" ]; then
    REPO="$(git -C "$ROOT" config --get remote.origin.url 2>/dev/null || true)"
    [ -n "$REPO" ] || REPO="$DEFAULT_REPO"
  fi
  if [ -d "$GIT_TARGET/.git" ]; then
    git_pull "$GIT_TARGET"
  elif [ -e "$GIT_TARGET" ] && [ -n "$(ls -A "$GIT_TARGET" 2>/dev/null)" ]; then
    echo "✗ $GIT_TARGET 已存在且不是 git 仓库。为避免覆盖已停止，请换一个目录或先清空它。" >&2
    exit 1
  else
    echo "克隆      $REPO → $GIT_TARGET"
    act mkdir -p "$(dirname "$GIT_TARGET")"
    act git clone "$REPO" "$GIT_TARGET" || { echo "✗ git clone 失败。" >&2; exit 1; }
  fi
  if [ "$DRY" -eq 1 ]; then
    echo "  [dry-run] bash $GIT_TARGET/install.sh ${FORWARD[*]+${FORWARD[*]}}"
    exit 0
  fi
  exec bash "$GIT_TARGET/install.sh" ${FORWARD[@]+"${FORWARD[@]}"}
fi

# --update：先拉取，再用更新后的脚本重新链接（git pull 可能改动了正在执行的本脚本）
if [ "$MODE" = update ]; then
  need_git
  git_pull "$ROOT"
  if [ "$DRY" -eq 1 ]; then exit 0; fi
  exec bash "$ROOT/install.sh" ${FORWARD[@]+"${FORWARD[@]}"}
fi

if [ ! -f "$SRC/SKILL.md" ]; then
  echo "找不到 $SRC/SKILL.md，请在仓库根目录运行本脚本。" >&2
  exit 1
fi

# bash 3.2 下空数组配合 set -u 会报错，用 ${arr[@]+...} 展开
if [ ${#OVERRIDE[@]} -gt 0 ]; then
  CLAUDE_DIRS=("${OVERRIDE[@]}")
else
  CLAUDE_DIRS=("$HOME/.claude" "$HOME/.claude-ccswitch")
fi
if [ -n "${CLAUDE_CONFIG_DIR:-}" ]; then CLAUDE_DIRS+=("$CLAUDE_CONFIG_DIR"); fi
CLAUDE_DIRS+=(${EXTRA[@]+"${EXTRA[@]}"})

TARGETS=()
add_target() {
  local t="${1%/}"
  local x
  for x in ${TARGETS[@]+"${TARGETS[@]}"}; do [ "$x" = "$t" ] && return 0; done
  TARGETS+=("$t")
}
for d in "${CLAUDE_DIRS[@]}"; do add_target "${d%/}/skills/$NAME"; done
add_target "$HOME/.agents/skills/$NAME"

if [ "$MODE" = uninstall ]; then
  for t in "${TARGETS[@]}"; do
    if [ -L "$t" ] && [ "$(readlink "$t")" = "$SRC" ]; then
      act rm "$t"; echo "已删除  $t"
    elif [ -L "$t" ]; then
      echo "跳过    $t（软链接指向 $(readlink "$t")，不是本仓库）"
    elif [ -e "$t" ]; then
      echo "跳过    $t（不是软链接，未改动）"
    else
      echo "未安装  $t"
    fi
  done
  exit 0
fi

# 先检查全部目标，有冲突就整体退出，保证不会只装了一半
conflict=0
for t in "${TARGETS[@]}"; do
  if [ -e "$t" ] && [ ! -L "$t" ]; then
    echo "✗ $t 已存在且不是软链接。为避免覆盖已停止，请手动移走或删除后重试。" >&2
    conflict=1
  fi
done
[ "$conflict" -eq 0 ] || exit 1

for t in "${TARGETS[@]}"; do
  if [ -L "$t" ] && [ "$(readlink "$t")" = "$SRC" ]; then
    echo "已是最新  $t"
    continue
  fi
  if [ -L "$t" ]; then
    echo "更新      $t（原来指向 $(readlink "$t")）"
    act rm "$t"
  else
    echo "安装      $t"
  fi
  act mkdir -p "$(dirname "$t")"
  act ln -s "$SRC" "$t"
done

cat <<EOF

完成。调用方式：
  Claude Code：/$NAME <面试主题>   （或直接说「我想准备 xx 面试」）
  pi：         /skill:$NAME <面试主题>
  Codex：      \$$NAME <面试主题>   （或直接说「我想准备 xx 面试」）
已在运行的会话需要重启后才能看到新 skill。
EOF
