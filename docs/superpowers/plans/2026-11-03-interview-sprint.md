# interview-sprint Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 交付可在 Claude Code / Codex / pi 中加载的 `interview-sprint` skill：固定模板 `course.html` + agent 只编辑的 `course-data.js`，离线 file:// 打开即可看到课程流动与系统生长。

**Architecture:** `assets/course.html` 是自包含渲染器，内含两段脚本：`<script id="course-core">`（纯逻辑 `CourseCore`，不碰 DOM，可在 Node `vm` 中单测）和 `<script id="course-app">`（DOM 渲染、加载、轮询）。数据通过 `<script src="course-data.js?t=…">` 加载（file:// 不能 fetch）。`index.html` 依次加载各主题数据计算进度。开发期测试用 `node --test`（单测）+ Playwright 驱动本机 Chrome 打开 file://（端到端）。

**Tech Stack:** 原生 HTML/CSS/JS（无依赖、无构建）；Bash（install.sh）；开发期 Node 26 `node:test`、playwright-core（从全局 `@playwright/mcp` 解析）、Google Chrome。

**Spec:** `docs/specs/2026-11-03-interview-sprint-design.md`（下称「说明」）；视觉参照 `docs/mockups/course-flow.html`。

## Global Constraints

- skill `name: interview-sprint`；`description` 必填且 ≤ 1024 字符；目录名 = name；name 只含小写字母/数字/单个连字符。
- 模板内联全部 CSS/JS；不引用 CDN、字体、任何外部资源；file:// 下零网络请求（SVG 的 `xmlns` 命名空间不算请求）。
- 运行时零依赖：Node/Python 只出现在 `tests/` 和可选校验脚本里，流程不依赖它们。
- agent 只编辑 `course-data.js` / `index-data.js`；复制过去的 `course.html` / `index.html` 永不修改。
- 数据全局变量：`window.INTERVIEW_COURSE`（课程）、`window.INTERVIEW_INDEX`（总览）；`version: 1`。
- 课程状态 `todo | current | done | skipped`；主题类型 `system-design | knowledge | experience`；面板 `architecture | code | timeline`。
- 卡片类型（12 种）：`points steps quote interview qa questions table compare chips code note html`。
- 文本字段只支持 `**粗体**`、`` `代码` ``、换行；除 `html` 卡片外一律转义；`html` 卡片不执行脚本。
- 页面文字、SKILL.md 正文用简体中文；`description` 中英混合。
- SKILL.md 正文 ≤ 约 300 行，不把任何工具专属工具名写成必需步骤。
- 当前目录不是 git 仓库，任务说明未要求提交 → 本计划不含 commit 步骤。
- 已核实：codex 0.164.0 的 skill roots 含 `~/.codex/skills` 与 `~/.agents/skills`（`codex debug prompt-input` 输出的 Skill roots 表），因此只链接 `~/.agents/skills`。

## Review Focus

1. **agent 写文件到一半时页面轮询到半截文件**（语法错误）→ 保留上一次成功渲染、顶部显示错误，下一次轮询读到完整文件后错误自动消失。→ Task 3 测试 `syntax error then recovery`。
2. **代码与标签里的 `<`、`&`、`<-ch`**（Go/SQL 常见）→ 在架构图 SVG 文本、代码面板、卡片里原样显示，不被当成 HTML。→ Task 1 `inline escapes html`、Task 3 `code panel shows <- literally`。
3. **中途删除一课**（C8）→ 引用被删课程的元素报出具体路径；未受影响元素在已学课程中的坐标不变。→ Task 1 `layout stable after lesson removal`。
4. **两个节点落在同一网格位置**或同一节点挂多条标注 → 校验给出警告；标注堆叠不压住节点。→ Task 1 `warns on overlapping nodes`。
5. **总览页某个主题的数据文件缺失或损坏** → 其余主题照常列出，坏的那行显示错误。→ Task 4 `index tolerates broken topic`。

---

## 文件结构

```text
interview-sprint/                    # skill 包
  SKILL.md                           # 流程说明（中文）
  assets/course.html                 # 渲染器模板（core + app 两段脚本）
  assets/index.html                  # 总览页模板
  references/data-format.md          # course-data.js / index-data.js 完整格式、每课写入清单、示例
  references/outline-patterns.md     # 三类主题大纲骨架 + 大纲输出格式
  references/lesson-guide.md         # 讲课循环、面试题、串讲、续学、调整大纲的细则与话术示例
  scripts/validate.mjs               # 可选：node 下用 CourseCore 校验数据文件（非必需步骤）
examples/{realtime-billing,go-channel,sql-tuning}/course.html + course-data.js
examples/index.html + index-data.js  # 总览页示例（列出三个主题）
tests/helpers/load-core.mjs          # 从 course.html 抽出 course-core 脚本在 vm 中执行
tests/helpers/browser.mjs            # 解析 playwright-core、启动 Chrome、临时目录工具
tests/unit/core.test.mjs             # B2–B4、B7 的纯逻辑
tests/unit/examples.test.mjs         # 示例数据零错误 + 覆盖面
tests/unit/skill-lint.test.mjs       # A2 + 模板无外部资源 + SKILL.md 行数/工具名
tests/e2e/course.e2e.test.mjs        # B1、B2、B3、B4、B5、B6、B7、B8、B9
tests/e2e/index.e2e.test.mjs         # B10
tests/fixtures/                      # all-cards、dup-id、bad-ref、syntax-error 数据
tests/install.test.sh                # install.sh 在临时 HOME 下的行为
tests/c9-hash-check.sh               # C9：主题目录模板 vs skill 模板的 sha256
tests/e2e-checklist.md               # C1–C11 逐项核对清单（三个工具）
tests/run-all.sh                     # 一键跑全部自动化检查
install.sh
README.md
```

`examples/*/course.html` 由 `tests/run-all.sh` 开头从 `interview-sprint/assets/` 复制（与用户侧行为一致），单测断言它们与模板字节一致。

---

### Task 1: CourseCore 纯逻辑 + 单测

**Files:**
- Create: `interview-sprint/assets/course.html`（本任务只放 `<script id="course-core">` 和最小骨架）
- Create: `tests/helpers/load-core.mjs`, `tests/unit/core.test.mjs`

**Interfaces:**
- Produces（`window.CourseCore`，全部纯函数）：
  - `escapeHtml(s: any) -> string`；`inline(text: string) -> html`（先转义，再 `` `x` ``→`<code>`，再 `**x**`→`<strong>`，`\n`→`<br>`；代码片段内不处理粗体）
  - `lessonIndex(data) -> Map<id, idx>`；`isVisible(el, idx, lessonIdx) -> bool`（`idx(since) <= idx && (until 缺省 || idx < idx(until))`）
  - `nodeBox(node) -> {x,y,w,h}`：网格 1 起算，`COL_W=150, ROW_H=130, NODE_W=124, NODE_H=40, PAD_X=24, PAD_TOP=70`；`x = PAD_X + (col-1)*COL_W + (COL_W-NODE_W)/2`，`w = NODE_W + (span-1)*COL_W`；col/row 可为小数
  - `layoutArchitecture(panel, lessons, idx) -> { width, height, nodes[{id,label,kind,x,y,w,h,isNew}], edges[{from,to,label,style,x1,y1,x2,y2,isNew}], groups[{id,label,x,y,w,h,isNew}], annotations[{node,text,x,y,w,isNew}], route[{node,n,x,y}] }`。width/height 由**全部**节点（不只可见）算出，保证画布与坐标跨课不变。连线端点裁剪到节点边框外 4px；同一对节点双向连线各自垂直偏移 6px。分组框 = 可见成员外包 + 14px，顶边再预留 `26 + 18×该组成员中最多可见标注数`。标注在节点上方从下往上堆叠，每条 18px。路线编号显示在 `idx >= idx(route.lesson)` 的课，圆心在节点左上角，同一节点多次出现横向错开。
  - `diffLines(prev: string|null, next: string) -> [{text, changed}]`：按行 LCS；`prev` 为 null 时全部 `changed:false`
  - `codeStateAt(panel, lessons, idx, pickId?) -> { versions[{id,label,isNew}], active: version, lines: diffLines(上一版本.code, active.code) }`：默认 active = 可见版本中最后一个；`pickId` 用于点版本切换；「上一版本」= `versions` 数组中 active 的前一个
  - `metricToBase(metric) -> number`：时间 `ns/us/µs/ms/s/min/h` 归一到 ms，大小 `B/KB/MB/GB` 归一到 B，其他单位原值
  - `timelineAt(panel, lessons, idx) -> { metricLabel, events[{title,detail,metricText,pct,good,isNew}] }`：`pct = base/最大base(面板全部事件) ×100`，最小 2；`better` 缺省 `"lower"`，比第一个带指标事件更好时 `good:true`
  - `addedAt(data, idx) -> string[]`：since 为本课的节点 label、`A → B` 连线、`<label> 边界`、标注 text、版本 label、事件 title、`讲述路线 ①→⑥`
  - `progressOf(data) -> { required, requiredDone, optional, optionalDone, skipped, currentIdx }`（skipped 不计入 required/optional）
  - `validateCourse(data) -> { errors: string[], warnings: string[] }`：消息为中文并带路径，例 `growth[0].edges[3].to 引用了不存在的节点 "mqx"`
  - `TYPE_LABEL`, `STATUS_LABEL`, `CARD_TYPES`, `DEFAULT_CARD_TITLE`（points 要点 / steps 步骤 / quote 面试怎么讲 / interview 面试题 / qa 常见追问 / questions 你问过的 / table 表格 / compare 方案对比 / chips 标签 / code 代码 / note 提示 / html 补充）
- `loadCore() -> CourseCore`（`tests/helpers/load-core.mjs`）：正则抽取 `<script id="course-core">…</script>`，`vm.runInNewContext(src, { window: {} })` 后返回 `ctx.window.CourseCore`。

- [ ] **Step 1: 写失败测试** `tests/unit/core.test.mjs`，至少：
  - `inline escapes html`：`inline('a <b> & **x** \`<-ch\`')` === `'a &lt;b&gt; &amp; <strong>x</strong> <code>&lt;-ch</code>'`
  - `node position stable across lessons`：同一 panel 在 idx 0..n 的 `layoutArchitecture` 中，每个可见节点 `{x,y,w,h}` 都等于 `nodeBox(node)`；`width/height` 各课相同
  - `until hides element`：`{since:'a', until:'c'}` 在 a、b 可见，c、d 不可见
  - `group grows with members`：成员 b 在第 2 课加入后组框 `w*h` 严格大于第 1 课
  - `route numbers`：`route` 长度等于 `steps.length`，`n` 依次为 1..k，route 课之前为空
  - `diff highlights added and modified lines`：`diffLines('a\nb\nc','a\nB\nc\nd')` 的 changed 序列为 `[false,true,false,true]`
  - `timeline pct proportional`：3.2s / 400ms / 45ms → pct 100 / 12.5 / ≈1.41→2（最小值）
  - `validate catches`：重复课程 id、重复节点 id、`since` 引用不存在课程、`until` 早于 `since`、edge/members/steps/annotation 引用不存在节点、`resume.lesson` 不存在、两个 `current`、未知卡片 type（warning）、experience 缺 `demoCase`（warning）
  - `warns on overlapping nodes`：两个节点同 col/row 且同时可见 → warning
  - `layout stable after lesson removal`：从数据中删去一个 todo 课后，所有已学课的节点坐标与删前相同
- [ ] **Step 2: 运行确认失败** `node --test tests/unit/core.test.mjs` → FAIL（找不到 course-core 脚本）
- [ ] **Step 3: 实现 `course-core` 脚本**（IIFE，`window.CourseCore = {...}`，不访问 `document`）
- [ ] **Step 4: 运行通过** `node --test tests/unit/core.test.mjs` → 全部 PASS

### Task 2: 三个示例主题 + 全卡片 fixture

**Files:**
- Create: `examples/realtime-billing/course-data.js`, `examples/go-channel/course-data.js`, `examples/sql-tuning/course-data.js`, `examples/index-data.js`
- Create: `tests/fixtures/all-cards/course-data.js`, `tests/fixtures/dup-id/course-data.js`, `tests/fixtures/bad-ref/course-data.js`, `tests/fixtures/syntax-error/course-data.js`
- Test: `tests/unit/examples.test.mjs`

**Interfaces:**
- Consumes: `CourseCore.validateCourse`, `CARD_TYPES`
- Produces: e2e 测试使用的课程 id 与节点 id（下表），`window.INTERVIEW_INDEX = { version: 1, topics: [{ slug, dir }] }`

| 示例 | 类型 | 面板 | 状态分布 | 必须包含 |
|---|---|---|---|---|
| realtime-billing | system-design | architecture（节点 `biz box gw mq dlq rate price bal owe redis bill db recon`，`box` 为 placeholder 且在第 2 课 `until` 消失；4 个组；≥5 条标注） | 已学若干、可选课「容量估算」done、可选课「可观测性」skipped、末课「面试串讲」current 且带 `routes` | chips quote interview questions points qa table compare note steps |
| go-channel | knowledge | code（4 个版本 v1 无缓冲→v4 errgroup，代码含 `<-`）+ architecture 概念图（hchan：buf / sendq / recvq / lock） | 2 课 done、「写法演进」current、其余 todo，含可选课 | code html（无脚本） compare interview |
| sql-tuning | experience，`demoCase: true` | timeline（`metricLabel: "订单列表接口 P99"`，3.2s→0.4s→45ms）+ code（SQL 演进） | 4 课 done、「反思与预防」current、「面试串讲」todo | steps table interview questions |

- [ ] **Step 1: 写失败测试** `tests/unit/examples.test.mjs`：三个示例 `validateCourse` 无 error 且无 warning；三者合起来覆盖 12 种卡片类型和 3 种面板；每个 `done` 课至少有 `points` 和 `quote`；sql-tuning 有 `demoCase: true`；最后一课标题含「串讲」；`all-cards` fixture 含 12 种类型且 html 卡片含 `<script>window.__pwned=1</script>` 与 `<img src=x onerror="window.__pwned=2">`；`dup-id`/`bad-ref` 校验后 errors 非空。
- [ ] **Step 2: 运行确认失败** `node --test tests/unit/examples.test.mjs` → FAIL（文件不存在）
- [ ] **Step 3: 编写数据文件**（内容真实、可直接用于学习；realtime-billing 的拓扑沿用 mockup，换算为网格）
- [ ] **Step 4: 运行通过** `node --test tests/unit/` → PASS

### Task 3: 课程页渲染器、自动刷新、错误提示

**Files:**
- Modify: `interview-sprint/assets/course.html`（加 CSS 与 `<script id="course-app">`）
- Create: `tests/helpers/browser.mjs`, `tests/e2e/course.e2e.test.mjs`

**Interfaces:**
- Consumes: Task 1 全部 `CourseCore` 函数；Task 2 示例与 fixture
- Produces（e2e 依赖的 DOM 契约）：`#errors`（错误列表，`li` 每条一项）、`#demo-banner`、`#progress`、`.tl-item[data-lesson]`（含 `.active`、状态类）、`#lesson-title`、`#btn-prev #btn-next #btn-play`、`svg .node[data-id]` 内 `rect` 的 x/y/width、`.group[data-id] rect`、`.annot`、`.route-num`、`.code-line.changed`、`.version-chip[data-version]`、`.tl-event .bar`（style width 百分比）、`.card[data-type]`、`#toast`
- `tests/helpers/browser.mjs`：`launchBrowser() -> {browser}`（依次尝试 `import('playwright-core')`、`$PLAYWRIGHT_CORE_PATH`、`$(npm root -g)/@playwright/mcp/node_modules/playwright-core`；优先 `channel:'chrome'`，失败回退内置 chromium；都不可用时测试 `skip` 并打印原因）、`makeTopicDir(srcDataPath) -> dir`（临时目录里放模板副本 + 数据副本）、`fileUrl(path)`

渲染要求（照搬 mockup 的配色变量与组件样式，补深色模式与窄屏）：
- 页头：主题、类型、进度（`已学 x / y 课`，另起一行列出 `可选 a/b`、`跳过 c`）、最后更新时间；`demoCase` 时页头下方提示条「示范案例，请换成你自己的经历」。
- 左侧时间线：状态圆点 + 「可选」标记；点击切换；`todo` 课主区只显示标题、说明与「讲到时生成」。
- 主区：标题/状态/说明 → 每个面板依次渲染（本课新增元素加 `.new`，带出现动画）→「本课新增」→ 卡片。`interview` 卡的参考回答放在默认收起的 `<details>`。宽卡片（interview / compare / table / code / html）占满一行。
- `html` 卡片：用 `<template>` 解析后删除 `script iframe object embed link meta base form`、所有 `on*` 属性、`javascript:` 链接、`http(s):`/`//` 开头的 `src`/`href`/`srcset`。
- 控制：上一课/下一课、← →（焦点在输入框时不处理）、播放生长（从第一课到 `currentIdx`，无 current 则到最后一个 done，每课 1.8s，可停止；任何手动导航都会停止播放）。
- 初始视图：`resume.lesson`，没有则 `currentIdx`，再没有则第 0 课。
- 加载/轮询：每 2500ms 插入新 `<script src="course-data.js?t=<now>">`，加载前置 `window.INTERVIEW_COURSE = undefined`，完成后移除该 script 元素；`onload` 后取不到数据 → 「course-data.js 有语法错误或没有给 window.INTERVIEW_COURSE 赋值」（若 `window` 的 `error` 事件给出行号一并显示）；`onerror` → 「找不到 course-data.js」。读到数据后 `JSON.stringify` 与上次比较，相同不重渲染；不同则重渲染并显示 `#toast`「已更新」；`resume.lesson` 变了跳到新课，否则保留当前查看的课。加载失败时保留上次成功的渲染。

- [ ] **Step 1: 写失败测试** `tests/e2e/course.e2e.test.mjs`（每个示例用 `makeTopicDir` 复制后以 file:// 打开）：
  - B1 `renders offline`：三例无 console error；所有请求 URL 以 `file:` 开头；`#lesson-title` 非空
  - B2 `architecture growth`：逐课点击，`[data-id=mq] rect` 的 x/y 始终相同；`box` 在第 2 课起不存在；「账户域」组框宽高在加入 `owe`/`redis` 后变大；`.annot` 文本包含示例中的标注；串讲课 `.route-num` 数量 = steps 长度
  - B3 `code diff`：go-channel 点 v2 chip，`.code-line.changed` 文本集合等于 `diffLines(v1,v2)` 的 changed 行；`<-` 原样显示
  - B4 `timeline bars`：sql-tuning 各 `.bar` 宽度百分比与 `timelineAt` 的 pct 相差 < 0.5
  - B5 `all cards`（fixture 的 `growth: []`，页面不出现生长区）：12 种 `.card[data-type]` 都存在；`points` 中的 `<b>` 以文本出现；`window.__pwned` 为 undefined；html 卡片里没有 `script`、没有 `onerror` 属性
  - B6 `auto refresh`：打开 realtime-billing，点第 2 课；改写数据（第 2 课新增一张 note 卡）→ 5s 内出现且仍在第 2 课、`#toast` 出现；再把 `resume.lesson` 改成第 3 课 → 跳到第 3 课
  - B7 `errors`：dup-id、bad-ref 打开后 `#errors li` ≥ 1 且时间线仍渲染；syntax-error 打开后显示「语法错误」且不白屏；`syntax error then recovery`：页面打开时先写半截文件再写完整文件，错误条出现后消失、内容更新
  - B8 `controls`：下一课/上一课按钮、ArrowRight/ArrowLeft 改变 `.tl-item.active`；点播放后按钮文字变为「停止」，2s 后 active 已前进，再点停止后不再变化
  - B9 `dark and narrow`：`emulateMedia({colorScheme:'dark'})` 下 body 文字与背景对比度 ≥ 4.5，节点文字与节点底色对比度 ≥ 4.5；视口 390×844 时时间线在主区上方（单列）且 `document.documentElement.scrollWidth <= 390`；把浅/深/窄三张截图写到 `tests/artifacts/`
- [ ] **Step 2: 运行确认失败** `node --test tests/e2e/course.e2e.test.mjs` → FAIL
- [ ] **Step 3: 实现 CSS 与 `course-app` 脚本**
- [ ] **Step 4: 运行通过** `node --test tests/e2e/course.e2e.test.mjs` → PASS；目视检查 `tests/artifacts/` 截图

### Task 4: 总览页 index.html

**Files:**
- Create: `interview-sprint/assets/index.html`, `tests/e2e/index.e2e.test.mjs`

**Interfaces:**
- Consumes: `window.INTERVIEW_INDEX.topics[{slug, dir}]`；各主题 `course-data.js`
- Produces: `.topic[data-slug]`（含 `a[href="<dir>/course.html"]`、`.topic-progress`、`.topic-resume`），坏主题为 `.topic.broken`

依次加载每个 `<dir>/course-data.js`（加载前清空全局变量，onload 取走），渲染主题名、类型、进度（与 `progressOf` 同口径，index 内置一份小实现）、最后更新时间、`resume.note`；按 `updatedAt` 倒序；每 5s 重新加载；`INTERVIEW_INDEX` 缺失时显示可读提示。

- [ ] **Step 1: 写失败测试**：临时目录放 index.html + 三个示例 + 一个不存在的 dir → 3 个正常 `.topic`、1 个 `.topic.broken`；进度文本与 `CourseCore.progressOf` 一致；点 realtime-billing 链接后 URL 以 `realtime-billing/course.html` 结尾且课程页渲染成功（`index tolerates broken topic`）
- [ ] **Step 2: 运行确认失败** → FAIL
- [ ] **Step 3: 实现 index.html**（样式与 course.html 同一套变量）
- [ ] **Step 4: 运行通过** `node --test tests/e2e/index.e2e.test.mjs` → PASS

### Task 5: SKILL.md、references、可选校验脚本、lint

**Files:**
- Create: `interview-sprint/SKILL.md`, `interview-sprint/references/{data-format,outline-patterns,lesson-guide}.md`, `interview-sprint/scripts/validate.mjs`
- Test: `tests/unit/skill-lint.test.mjs`

**Interfaces:**
- Consumes: CourseCore（validate.mjs 与 load-core 用同一抽取方式，从 `../assets/course.html` 读取）
- Produces: `node interview-sprint/scripts/validate.mjs <course-data.js>` → 退出码 0/1，打印 errors/warnings

SKILL.md 必须覆盖（说明 5.3、5.7）：skill 目录 = 本 SKILL.md 所在目录；工作区 = 当前目录 `.interview_points/`；触发与无参数调用；开题 5 步（含相近主题检查、类型判断、experience 示范案例在开题时说一次、确认前不建文件、建文件后给绝对路径并尝试 `open`/`xdg-open`）；讲课循环 6 步（开课先写生长增量、分段 ≤ 约 300 字 + 至多一张简图、段末停下、插话记录、面试题先让用户试答、每段更新 `resume`、课末小结与卡片）；面试串讲（路线编号 + 可选模拟追问，experience 再提醒一次示范案例）；续学（读文件、两三句回顾、提 `review`）；调整大纲（按 id 引用、已学内容不动）；文件规则（模板只复制不改、编辑前先读、保持合法 JS、大改动前确认、找不到 `.interview_points/` 且用户说继续时先问目录）；对话图示规则（ASCII 或 ≤ 8 行 mermaid）；何时读哪个 reference。`description` 覆盖开题与续学、含「面试 interview 系统设计 system design 八股 准备面试 继续学习 mock interview prep」等词。

- [ ] **Step 1: 写失败测试** `skill-lint.test.mjs`：frontmatter `name` 匹配 `^[a-z0-9]+(-[a-z0-9]+)*$` 且 ≤ 64、等于目录名；`description` 存在且 ≤ 1024 字符，同时含中文与英文；SKILL.md 正文 ≤ 320 行；正文不含 `AskUserQuestion|TodoWrite|apply_patch|request_user_input|Task tool|Skill tool`；SKILL.md 中引用的 `references/*`、`assets/*` 文件都存在；两个模板不含 `http://`/`https://`（`http://www.w3.org/2000/svg` 除外）、不含 `@import`、`<link`；`examples/*/course.html` 与模板字节一致；`validate.mjs` 对三个示例退出码 0、对 bad-ref 退出码 1
- [ ] **Step 2: 运行确认失败** → FAIL
- [ ] **Step 3: 编写 SKILL.md、三个 reference、validate.mjs**（data-format.md 给出每个字段、每种面板/卡片的最小示例、「开课写入清单」与「课末写入清单」、index-data.js 格式）
- [ ] **Step 4: 运行通过** `node --test tests/unit/` → PASS

### Task 6: install.sh + README

**Files:**
- Create: `install.sh`, `README.md`, `tests/install.test.sh`

**Interfaces:**
- `install.sh [--uninstall] [--dry-run] [--claude-dir DIR]... [--add-claude-dir DIR]...`
  - 默认 Claude 目录：`$HOME/.claude`、`$HOME/.claude-ccswitch`；`--claude-dir` 覆盖默认列表；`--add-claude-dir` 与环境变量 `CLAUDE_CONFIG_DIR` 追加；去重
  - 目标：每个 Claude 目录的 `skills/interview-sprint` + `$HOME/.agents/skills/interview-sprint`（父目录不存在则创建）
  - 目标是指向本包的软链接 → 跳过；指向别处的软链接 → 更新并提示；非软链接已存在 → 打印原因并以退出码 1 结束，不改动任何目标
  - `--uninstall` 只删除指向本包的软链接

- [ ] **Step 1: 写失败测试** `tests/install.test.sh`（`HOME=$(mktemp -d)`）：首次安装 3 个链接都指向包目录；重复执行退出码 0 且结果不变；`CLAUDE_CONFIG_DIR=$HOME/x` 追加第 4 个；`--claude-dir $HOME/only` 只装 only + agents；预置真实目录 `$HOME/.agents/skills/interview-sprint` 时退出码 1 且其他目标未创建；`--uninstall` 删除链接且不碰别处的软链接
- [ ] **Step 2: 运行确认失败** `bash tests/install.test.sh` → FAIL
- [ ] **Step 3: 实现 install.sh**（先全部检查再动手，保证失败时不半装）；README 写安装、三个工具的调用方式（Claude Code `/interview-sprint <主题>`；pi `/skill:interview-sprint <主题>`；Codex 在输入中写 `$interview-sprint <主题>` 或自然语言）、目录结构、开发与测试命令
- [ ] **Step 4: 运行通过** `bash tests/install.test.sh` → PASS

### Task 7: C9 哈希脚本、端到端核对清单、一键检查

**Files:**
- Create: `tests/c9-hash-check.sh`, `tests/e2e-checklist.md`, `tests/run-all.sh`

**Interfaces:**
- `tests/c9-hash-check.sh [工作目录=.] [skill目录=~/.agents/skills/interview-sprint]`：对 `.interview_points/*/course.html` 与 `.interview_points/index.html` 逐个和模板比 sha256，打印每行 `OK|CHANGED <path>`，任一 CHANGED 退出码 1，找不到主题目录退出码 2
- `tests/run-all.sh`：复制模板到 `examples/*/` 与 `examples/index.html` → `node --test tests/unit tests/e2e` → `bash tests/install.test.sh` → C9 脚本自测（对 examples 构造的临时工作区跑一次 OK、改一个字节后跑一次 CHANGED）

e2e-checklist.md：三个工具各一列；C1–C11 每项写「怎么做 / 期望看到什么 / 判定标准」；C3 判定「单段 ≤ 约 300 字、段末明确停下等待」，C4 判定「先出题且等待用户作答或『直接讲』后才给答案」；附三个工具的启动与调用命令、C7 换工具步骤、C9 命令。

- [ ] **Step 1: 写 C9 脚本自测进 run-all.sh**，运行确认因脚本不存在而失败
- [ ] **Step 2: 实现 c9-hash-check.sh、run-all.sh、e2e-checklist.md**
- [ ] **Step 3: 运行** `bash tests/run-all.sh` → 全部 PASS

### Task 8: 验收（A、B 全组 + 本工具 C1–C11）

- [ ] **Step 1: 安装** `./install.sh`；核对三个链接；`codex debug prompt-input hi` 输出中出现 `interview-sprint`（A1 Codex 发现）；`ls ~/.claude/skills ~/.claude-ccswitch/skills ~/.agents/skills`
- [ ] **Step 2: B 组** `bash tests/run-all.sh` 全绿；Safari：`open -a Safari examples/*/course.html` 目视三例（能自动截图则截图存证，否则在报告中说明交给用户）
- [ ] **Step 3: C 组（Claude Code）** 在临时工作目录用 `CLAUDE_CONFIG_DIR=~/.claude-ccswitch claude -p` 多轮对话（`--resume <session_id>` 续接）跑：系统设计主题开题 → 确认大纲 → 第一课分段讲 + 插话 + 面试题 → 课末；新会话「继续」；中途加/删一课；experience 主题开题（C11）。每步按 `e2e-checklist.md` 判定并记录证据；最后 `tests/c9-hash-check.sh <工作目录>`
- [ ] **Step 4: 修复** 发现的问题回到对应任务修复并重跑 `tests/run-all.sh`
- [ ] **Step 5: 汇报** 结果写入共享笔记目录；告诉用户 Codex、pi 需按 `tests/e2e-checklist.md` 手动验证
