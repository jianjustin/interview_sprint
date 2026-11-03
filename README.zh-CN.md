# interview-sprint

[English](README.md) | 简体中文

一个在 **Claude Code、Codex、pi** 中通用的技术面试冲刺 skill。

给 agent 一个面试主题（如「设计一个实时计费系统」「讲述一个 Go channel 使用场景」「讲述一次 SQL 调优过程」），它会：

1. 先在对话里给出**突出重点**的课程大纲（非重点标「可选」，最后一课固定为「面试串讲」），你确认后才建文件；
2. 像讲师一样逐课**分段**讲解，每段停下等你插话，课中穿插面试题并先让你试答；
3. 为每个主题维护一个**离线 HTML 课程页**：左边是课程进度，右边是系统 / 代码 / 排查过程随课程一步步"长出来"，agent 更新数据后页面自动刷新；
4. 进度只存在主题目录的 `course-data.js` 里，换会话、换工具都能接着学。

经历复盘类主题由 agent 构造**示范案例**来讲，对话和页面都会提示「示范案例，请换成你自己的经历」。

## 安装

### 推荐：用 git 管理安装

```bash
git clone https://github.com/jianjustin/interview_sprint.git ~/.local/share/interview-sprint
~/.local/share/interview-sprint/install.sh
```

以后更新：

```bash
~/.local/share/interview-sprint/install.sh --update
```

`--update` 会执行 `git pull --ff-only` 并重新链接；clone 里有未提交的改动时会拒绝执行。有 SSH 权限也可以改用 `git@github.com:jianjustin/interview_sprint.git` 克隆。

如果你已经在别处有一份仓库，在那里运行 `./install.sh --git` 效果相同：它把仓库 clone（已存在则 pull）到 `~/.local/share/interview-sprint`（或 `./install.sh --git DIR` 指定的目录），再把各 skill 目录指向那份 clone。`--repo URL` 可以指定别的远程地址。

### 链接到哪里

skill 包是仓库里的 `interview-sprint/` 子目录，而各工具要求 `<skills 目录>/interview-sprint/SKILL.md`。所以安装脚本只保留**一份** git clone，再把各工具的 skill 目录链接到其中的包：

| 位置 | 给谁用 |
|---|---|
| `~/.claude/skills/interview-sprint` | Claude Code 桌面 App |
| `~/.claude-ccswitch/skills/interview-sprint` | 终端里的 `claude`（以 `CLAUDE_CONFIG_DIR=~/.claude-ccswitch` 运行时） |
| `~/.agents/skills/interview-sprint` | Codex（0.164.0 读取 `~/.agents/skills`，已用 `codex debug prompt-input` 核实）和 pi（1.5.0 支持 `~/.agents/skills`） |

- 可重复执行；目标位置已有同名的**非软链接**目录时会提示并退出，不覆盖任何东西。
- 设置了 `CLAUDE_CONFIG_DIR` 时额外安装到 `$CLAUDE_CONFIG_DIR/skills/`；`--claude-dir DIR` 替换默认的 Claude 目录，`--add-claude-dir DIR` 追加。
- `--dry-run` 预览，`--uninstall` 卸载（只删除指向这份仓库的软链接）。
- 已在运行的会话需要重启后才能看到新 skill。

### 开发 skill 时

在你的工作副本里直接运行 `./install.sh`（不带参数），skill 目录会直接链接到工作副本，改动立即生效。

## 使用

| 工具 | 开新主题 | 续学 |
|---|---|---|
| Claude Code | `/interview-sprint 设计一个实时计费系统` | `/interview-sprint` 后选主题，或说「继续计费系统」 |
| Codex | `$interview-sprint 设计一个实时计费系统` | 同上 |
| pi | `/skill:interview-sprint 设计一个实时计费系统` | `/skill:interview-sprint` 后选主题，或说「继续计费系统」 |

也可以直接用自然语言：「我想准备 xx 面试」「帮我过一下 xx」「继续上次的计费系统」。

课程文件放在**启动 agent 时所在目录**的 `.interview_points/` 下：

```text
.interview_points/
├── index.html            # 多主题总览（双击打开）
├── index-data.js
└── realtime-billing/
    ├── course.html       # 课程页（双击打开，离线可用）
    └── course-data.js    # 课程内容与进度，agent 只编辑这个文件
```

课程页功能：课程时间线（已学 / 进行中 / 未开始 / 已跳过）、生长面板（架构图 / 代码演进 / 排查时间线）、「本课新增」、课程卡片、上一课 / 下一课 / 键盘 ← →、「播放生长」、每 2.5 秒自动刷新、数据错误提示、浅色 / 深色模式、窄屏单列。

**模板升级**：`course.html` / `index.html` 复制后不再改动。更新 skill 后，如需新模板，自行把 `interview-sprint/assets/` 下的文件重新复制到已有主题目录（数据格式带 `version` 字段）。

## 仓库结构

```text
interview_sprint/                 # 开发仓库
├── interview-sprint/             # skill 包本体（只链接这个目录）
│   ├── SKILL.md
│   ├── assets/course.html        # 课程页渲染器模板（内联 CSS/JS，无外部依赖）
│   ├── assets/index.html         # 总览页模板
│   ├── references/               # data-format / outline-patterns / lesson-guide
│   └── scripts/validate.mjs      # 可选：用 node 校验 course-data.js
├── examples/                     # 三个示例主题：realtime-billing、go-channel、sql-tuning
├── tests/                        # 自动化检查、端到端核对清单、C9 哈希脚本
├── docs/                         # 实现说明、交互样例、实现计划
├── install.sh
├── README.md                     # 英文版
└── README.zh-CN.md               # 本文件
```

直接双击 `examples/*/course.html` 或 `examples/index.html` 可以看到三个示例主题的效果。

## 开发与测试

```bash
bash tests/run-all.sh
```

依次执行：

- 同步 `examples/` 里的模板副本；
- 单元测试 `node --test tests/unit`：从 `course.html` 中抽出 `<script id="course-core">`（纯逻辑）在 Node 中执行，覆盖网格布局换算、`since` / `until`、分组扩展、路线编号、行级 diff、指标条比例、数据校验，以及 skill frontmatter 和中英文 README；
- 浏览器测试 `node --test tests/e2e`（逐个文件串行）：用本机 Chrome（找不到时用 Playwright 自带 Chromium）以 file:// 打开示例，覆盖 B1–B10——零网络请求、架构图生长、代码 diff 高亮、时间线比例、全部卡片与转义、html 卡片清洗、自动刷新、错误提示、键盘与播放、深浅色对比度与窄屏、总览页；截图写到 `tests/artifacts/`；
- `tests/install.test.sh`：在临时 HOME 中验证 install.sh，包括用本地仓库模拟远程的 git 安装与更新；
- C9 哈希脚本自测。

浏览器测试需要 `playwright-core`：会依次尝试本地依赖、`$PLAYWRIGHT_CORE_PATH`、全局安装的 `@playwright/mcp` 里自带的副本。都找不到时这些测试会被跳过并说明原因，`run-all.sh` 会把「有跳过」判为未通过，避免误报。

端到端流程（开题 → 讲课 → 换工具续学）的人工核对见 [tests/e2e-checklist.md](tests/e2e-checklist.md)，C9 用：

```bash
bash tests/c9-hash-check.sh <启动 agent 的目录>
```
