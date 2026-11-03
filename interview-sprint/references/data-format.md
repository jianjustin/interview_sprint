# course-data.js 数据格式

课程页 `course.html` 每 2.5 秒重新加载同目录的 `course-data.js`，内容有变化就重新渲染。这个文件是课程内容和进度的**唯一来源**。

## 1. 文件形态

```js
window.INTERVIEW_COURSE = {
  version: 1,
  // ……字段见下文
};
```

- 必须是合法 JavaScript（浏览器在 file:// 下只能用 `<script>` 加载，不能读 JSON）。
- 推荐写成 JSON 风格：键可以不加引号，字符串一律用双引号；字符串里的双引号写成 `\"`，换行写成 `\n`。
- 多行代码可以写成 `["第一行", "第二行"].join("\n")`，比一长串 `\n` 更好改。
- **卡片和时间线里的文本**支持极简行内格式：`**粗体**`、`` `代码` ``、换行（`\n`）——包括卡片的 `items`、`text`、`question` / `approach` / `answer`、`q` / `a`、表格单元格、对比的 `name` / `pros` / `cons` / `conclusion`，时间线事件的 `title` / `detail`，版本的 `note`，以及 `review` 的每一条。
- 以下字段是**纯文本**，写 `**` 会原样显示星号：`topic`、课程 `title` / `summary`、`resume.note`、卡片 `title`、架构图节点 `label`、连线 `label`、分组 `label`、标注 `text`、版本 `label`、`metricLabel`。
- 任何字段里的 HTML 都按原文显示（会被转义），只有 `html` 卡片例外。

## 2. 顶层字段

| 字段 | 必填 | 说明 |
|---|---|---|
| `version` | 是 | 固定为 `1` |
| `topic` | 是 | 主题，如 `"设计一个实时计费系统"` |
| `slug` | 是 | 英文 kebab-case，与目录名一致，如 `"realtime-billing"` |
| `type` | 是 | `"system-design"` / `"knowledge"` / `"experience"` |
| `demoCase` | experience 必填 | `true` 时页面显示「示范案例，请换成你自己的经历」提示条 |
| `updatedAt` | 建议 | ISO 8601 带时区，如 `"2026-11-03T15:20:00+08:00"`；每次修改都更新 |
| `resume` | 建议 | `{ lesson: "<课程 id>", note: "讲到哪、下一步讲什么" }`；`note` 一句话、约 60 字以内（页头只显示两行）；页面打开时定位到 `resume.lesson`，它变了页面会自动跳过去 |
| `review` | 否 | 待回顾的问题，字符串数组，显示在课程列表下方 |
| `growth` | 是 | 生长面板数组，可以是 `[]`（此时页面没有生长区） |
| `lessons` | 是 | 课程数组，顺序即课程顺序 |

## 3. lessons：课程

```js
{
  id: "boundaries",          // 稳定 id：英文 kebab-case，创建后不再改；生长元素用它引用课程
  title: "模块边界",
  summary: "按「谁对什么数据负责」划 4 个域",   // 一句话说明本课讲什么
  optional: false,           // true 显示「可选」
  status: "done",            // todo | current | done | skipped
  cards: [ /* 卡片，见第 5 节 */ ]
}
```

- 同一时间**最多一个** `current`。
- `todo` 的课不写卡片（页面只显示标题、说明和「讲到时生成」）。
- 跳过的课设为 `skipped`，保留在数组里。

## 4. growth：生长面板

一个主题通常一个面板，最多建议两个（如 SQL 调优：时间线 + SQL 代码演进）。每个面板有 `kind` 和 `title`。

**所有生长元素都用课程 id 声明出现时机**：

- `since`（必填）：在这一课出现，之后一直显示；本课新增的元素会高亮并带出现动画，并自动列进「本课新增」。
- `until`（可选）：从这一课开始消失（必须在 `since` 之后）。

### 4.1 architecture：方框 + 箭头（系统设计默认；也用于知识点的概念图）

```js
{
  kind: "architecture",
  title: "系统架构",
  nodes: [
    { id: "biz", label: "业务服务", col: 1, row: 2, kind: "external", since: "requirements" },
    { id: "box", label: "计费系统（黑盒）", col: 3, row: 2, span: 3, kind: "placeholder", since: "requirements", until: "architecture" },
    { id: "mq", label: "Kafka", col: 3, row: 2, kind: "store", since: "architecture" }
  ],
  edges: [
    { from: "biz", to: "mq", label: "用量事件", since: "architecture" },
    { from: "price", to: "rate", label: "规则", style: "dashed", since: "boundaries" }
  ],
  groups: [
    { id: "metering", label: "计量域", members: ["gw", "mq", "dlq"], since: "boundaries" }
  ],
  annotations: [
    { node: "mq", text: "分区 ×64", since: "traffic" }
  ],
  routes: [
    { lesson: "pitch", steps: ["biz", "gw", "mq", "rate", "bal"] }
  ]
}
```

- **网格**：`col` 第几列、`row` 第几行，都从 1 开始，可以用 0.5 这样的小数微调；`span` 占几列（默认 1）。模板换算像素：列宽 160、行高 130，节点宽 112、高 40。
- **位置一旦确定就不要改**：同一节点在所有课程中位置不变，这是"生长"感的来源。开题时先规划好整张图的大致布局：主数据流放在同一行从左到右；上下行放依赖（配置、存储、旁路）。
- 整张图控制在约 **7 列 × 4 行**以内（列越多图越小）；相连的节点尽量同行或同列，少用跨好几列的长斜线。
- 同时可见的两个节点不能占同一格（页面会给出警告）。第一课的黑盒（`placeholder`）可以占后来组件的位置，用 `until` 在拆开的那一课移除。
- 节点 `kind`：`service`（默认）、`store`（存储 / 队列，圆角更大）、`external`（外部系统 / 调用方）、`placeholder`（虚线黑盒）。
- `label` 尽量 ≤ 8 个汉字；需要两行时用 `\n` 分隔。
- `edges.style`：`solid`（默认）/ `dashed`（异步、旁路、配置）。`label` 尽量 ≤ 4 个字。
- `groups`：边界框按当前课可见的成员自动计算，成员越多框越大。分组本身也要 `since`。
- `annotations`：挂在已有节点上的小标签（"Lua 原子扣减"），体现能力叠加在已有组件上。同一节点最多建议 3 条。
- `routes`：串讲课的讲述路线，`lesson` 填串讲课 id，`steps` 按顺序列出节点 id，页面会在节点上标出 1、2、3……

### 4.2 code：代码演进（知识点默认）

```js
{
  kind: "code",
  title: "批量任务处理：写法演进",
  versions: [
    { id: "v1", since: "scenario", label: "v1 无缓冲 channel", language: "go", note: "一个生产者一个消费者", code: "..." },
    { id: "v2", since: "evolution", label: "v2 worker pool", language: "go", code: "..." }
  ]
}
```

- 页面默认显示当前课可见的最后一个版本，可以点版本标签切换。
- 每个版本自动和数组里的**前一个版本**对比，新增或修改的行高亮。所以每个版本都写**完整代码**，不要只写片段。
- 一课可以加多个版本；版本 id 在面板内唯一。

### 4.3 timeline：排查过程（经历复盘默认）

```js
{
  kind: "timeline",
  title: "排查时间线（示范案例）",
  metricLabel: "订单列表接口 P99",
  better: "lower",            // 指标越低越好（默认）；吞吐类指标写 "higher"
  events: [
    { since: "background", title: "慢查询告警", detail: "翻页越往后越慢", metric: { value: 3.2, unit: "s" } },
    { since: "fix", title: "加联合索引", metric: { value: 400, unit: "ms" } }
  ]
}
```

- 有 `metric` 的事件画出与数值成比例的条；`s`/`ms`/`us`/`min`、`B`/`KB`/`MB`/`GB` 会自动换算到同一单位后比较，其他单位按原值比较（同一面板请用同一类单位）。
- 比第一个指标更好的条显示为绿色。

## 5. cards：课程卡片

所有卡片都可以带 `title`（省略时用默认标题）和 `optional: true`（显示「可选」并弱化）。

| type | 默认标题 | 字段 | 示例 |
|---|---|---|---|
| `points` | 要点 | `items: string[]` | `{ type: "points", items: ["**余额只有账户域能改**", "规则带版本号"] }` |
| `steps` | 步骤 | `items: string[]` | `{ type: "steps", title: "10 分钟路线", items: ["需求（1 分钟）", "架构（2 分钟）"] }` |
| `quote` | 面试怎么讲 | `text` | `{ type: "quote", text: "我先确认几个问题：……" }` |
| `interview` | 面试题 | `question`、`approach`、`answer` | `{ type: "interview", question: "为什么不同步扣费？", approach: "从故障隔离和峰值两点答", answer: "……" }` |
| `qa` | 常见追问 | `items: [{ q, a }]` | `{ type: "qa", items: [{ q: "Kafka 会丢消息吗？", a: "acks=all + 手动提交 offset" }] }` |
| `questions` | 你问过的 | `items: [{ q, a }]` | `{ type: "questions", items: [{ q: "用户的原问题", a: "你的回答要点" }] }` |
| `table` | 表格 | `headers?: string[]`、`rows: string[][]` | `{ type: "table", title: "边界划分", headers: ["域", "负责"], rows: [["计量域", "收事件"]] }` |
| `compare` | 方案对比 | `options: [{ name, pros, cons }]`、`conclusion` | `{ type: "compare", options: [{ name: "分布式锁", pros: ["通用"], cons: ["多一次往返"] }], conclusion: "选分区串行" }` |
| `chips` | 标签 | `items: string[]` | `{ type: "chips", title: "需求清单", items: ["预付费", "峰值 10w/s"] }` |
| `code` | 代码 | `code`、`language?` | `{ type: "code", language: "sql", code: "EXPLAIN SELECT ..." }` |
| `note` | 提示 | `text` | `{ type: "note", title: "正在讲", text: "下一步：……" }` |
| `html` | 补充 | `html` | 模板没覆盖的呈现才用。`<script>`、事件属性、外部链接和资源都会被移除；颜色可用 `var(--danger)`、`var(--muted)` 等 |

**约定**：每个 `done` 的课至少有 `points` 和 `quote`；穿插过面试题的课有 `interview`；用户插过话的课有 `questions`。

## 6. 写入清单

### 开题（用户确认大纲之后）

```js
window.INTERVIEW_COURSE = {
  version: 1,
  topic: "设计一个实时计费系统",
  slug: "realtime-billing",
  type: "system-design",
  updatedAt: "2026-11-03T10:00:00+08:00",
  resume: { lesson: "requirements", note: "准备开始第 1 课：需求澄清" },
  review: [],
  growth: [{ kind: "architecture", title: "系统架构", nodes: [], edges: [], groups: [], annotations: [], routes: [] }],
  lessons: [
    { id: "requirements", title: "需求澄清", summary: "先问清楚计什么费、多实时、量多大", status: "current", cards: [] },
    { id: "capacity", title: "容量估算", summary: "几组数字说明为什么要削峰", optional: true, status: "todo", cards: [] },
    { id: "pitch", title: "面试串讲", summary: "串成 10 分钟讲述路线", status: "todo", cards: [] }
  ]
};
```

experience 类再加 `demoCase: true`。同时更新 `index-data.js`（第 7 节）。

### 开课

1. 本课 `status: "current"`（上一课应已是 `done`）。
2. 往面板里追加本课的生长元素，`since` 填本课 id；需要移除的旧元素加 `until: "<本课 id>"`。
3. `resume = { lesson: "<本课 id>", note: "开始第 N 课：……" }`，更新 `updatedAt`。

### 每讲完一段

- 只改 `resume.note`（一句话：讲到哪、下一步讲什么，约 60 字以内）和 `updatedAt`。
- 想让用户看到"正在讲"，可以在本课放一张 `note` 卡，课末删掉或改成正式卡片。

### 课末

1. 写入本课 `cards`（至少 `points` + `quote`，按需加 `interview`、`questions` 等）。
2. 本课 `status: "done"`，下一课 `status: "current"`。
3. `resume = { lesson: "<下一课 id>", note: "第 N 课已完成，下一课：……" }`，更新 `updatedAt`。

### 调整大纲

- 新增课程：插到数组对应位置，新 id 不与已有 id 重复。
- 删除课程：先处理 `since` / `until` / `routes.lesson` 引用了它的元素（改挂到别的课或删除），再删课程。
- 跳过：`status: "skipped"`。
- 不动已学课程的卡片和生长元素。

## 7. index-data.js

```js
window.INTERVIEW_INDEX = {
  version: 1,
  topics: [
    { slug: "realtime-billing", dir: "realtime-billing" },
    { slug: "sql-tuning", dir: "sql-tuning" }
  ]
};
```

- 只列 slug 和目录（相对 `.interview_points/` 的路径）；进度由总览页读各主题的 `course-data.js` 计算，不在这里重复。
- 只在新增或删除主题时修改。

## 8. 自查

- 文件以 `window.INTERVIEW_COURSE = {` 开头、以 `};` 结尾；括号、逗号、引号成对。
- 所有课程 id 唯一；`since`、`until`、`members`、`steps`、`resume.lesson` 引用的 id 都存在。
- 有 node 时可选运行：`node <skill 目录>/scripts/validate.mjs .interview_points/<slug>/course-data.js`。
- 页面打开时如果顶部出现红色错误框，按提示修正即可，页面会自动恢复。
