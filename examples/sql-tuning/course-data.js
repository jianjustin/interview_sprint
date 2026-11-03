window.INTERVIEW_COURSE = {
  version: 1,
  topic: "讲述一次 SQL 调优过程",
  slug: "sql-tuning",
  type: "experience",
  demoCase: true,
  updatedAt: "2026-11-03T14:10:00+08:00",
  resume: { lesson: "reflect", note: "讲完上线后的数据，下一步：怎么防止同类慢查询再出现" },
  review: [],

  growth: [
    {
      kind: "timeline",
      title: "排查时间线（示范案例）",
      metricLabel: "订单列表接口 P99",
      better: "lower",
      events: [
        { since: "background", title: "慢查询告警：订单列表接口 P99 超过 3 秒", detail: "大促前压测发现，翻页越往后越慢", metric: { value: 3.2, unit: "s" } },
        { since: "locate", title: "EXPLAIN：全表扫描 + Using filesort", detail: "rows 约 120 万，没有可用索引", metric: { value: 3.2, unit: "s" } },
        { since: "locate", title: "慢日志确认：深分页 LIMIT 100000, 20", detail: "扫描 10 万行后丢弃，只返回 20 行" },
        { since: "fix", title: "加联合索引 (user_id, created_at)", detail: "过滤和排序都走索引，去掉 filesort", metric: { value: 400, unit: "ms" } },
        { since: "fix", title: "深分页改游标分页", detail: "按上一页最后一条的 (created_at, id) 继续往后取", metric: { value: 45, unit: "ms" } },
        { since: "result", title: "全量上线：P99 稳定在 45ms", detail: "数据库 CPU 从 70% 降到 25%", metric: { value: 45, unit: "ms" } },
        { since: "reflect", title: "补上 SQL 审核和慢查询看板", detail: "上线前检查执行计划，慢查询按周复盘" }
      ]
    },
    {
      kind: "code",
      title: "SQL 演进",
      versions: [
        { id: "sql-v1", since: "background", label: "原始查询", language: "sql",
          code: [
            "SELECT *",
            "FROM orders",
            "WHERE user_id = ?",
            "  AND status IN (1, 2, 3)",
            "ORDER BY created_at DESC",
            "LIMIT 100000, 20;"
          ].join("\n") },
        { id: "sql-v2", since: "fix", label: "加索引 + 只查需要的列", language: "sql",
          code: [
            "ALTER TABLE orders ADD INDEX idx_user_created (user_id, created_at);",
            "",
            "SELECT id, order_no, amount, status, created_at",
            "FROM orders",
            "WHERE user_id = ?",
            "  AND status IN (1, 2, 3)",
            "ORDER BY created_at DESC",
            "LIMIT 100000, 20;"
          ].join("\n") },
        { id: "sql-v3", since: "fix", label: "游标分页", language: "sql",
          code: [
            "ALTER TABLE orders ADD INDEX idx_user_created (user_id, created_at);",
            "",
            "SELECT id, order_no, amount, status, created_at",
            "FROM orders",
            "WHERE user_id = ?",
            "  AND status IN (1, 2, 3)",
            "  AND (created_at < ? OR (created_at = ? AND id < ?))",
            "ORDER BY created_at DESC, id DESC",
            "LIMIT 20;"
          ].join("\n") }
      ]
    }
  ],

  lessons: [
    {
      id: "background",
      title: "背景与现象",
      summary: "什么系统、什么接口、慢到什么程度、影响了谁",
      status: "done",
      cards: [
        { type: "note", title: "示范案例", text: "下面的系统、数据和过程都是示范，用来练习讲述结构。面试时请换成你自己的经历和真实数字。" },
        { type: "points", items: [
          "系统：电商订单服务，orders 表约 2 亿行",
          "现象：订单列表接口翻页越往后越慢，P99 超过 3 秒",
          "影响：大促前压测不达标，客服后台查询经常超时"
        ] },
        { type: "quote", text: "这是我在订单服务做的一次调优。当时订单列表接口翻到后面几页 P99 超过 3 秒，大促前压测不达标，所以我来负责把它降下来。" },
        { type: "interview", question: "先用一分钟介绍一下这个问题的背景？",
          approach: "STAR 里的 S 和 T：系统规模、问题现象、业务影响、你的职责，各一句",
          answer: "订单服务的 orders 表大约 2 亿行。订单列表接口翻页越往后越慢，P99 超过 3 秒，大促前压测没过。我负责定位并在一周内把 P99 降到 100ms 以内。" }
      ]
    },
    {
      id: "locate",
      title: "定位过程",
      summary: "从告警到具体 SQL，再到执行计划，一步步缩小范围",
      status: "done",
      cards: [
        { type: "steps", title: "定位步骤", items: [
          "看监控：慢的是订单列表接口，且只在翻页靠后时慢",
          "查慢查询日志：找到对应 SQL，rows_examined 约 120 万",
          "EXPLAIN：type=ALL 全表扫描，Extra 里有 Using filesort",
          "结论：缺少合适索引 + 深分页扫描大量丢弃的行"
        ] },
        { type: "code", title: "EXPLAIN 输出（节选）", language: "text", code: [
          "id: 1  select_type: SIMPLE  table: orders",
          "type: ALL  possible_keys: NULL  key: NULL",
          "rows: 1203448  filtered: 3.33",
          "Extra: Using where; Using filesort"
        ].join("\n") },
        { type: "points", items: [
          "先确认慢在**数据库**，而不是网络或应用层",
          "EXPLAIN 重点看 `type`、`key`、`rows`、`Extra` 四列"
        ] },
        { type: "quote", text: "我先从监控确认慢在数据库，再从慢日志拿到具体 SQL，用 EXPLAIN 看到它走了全表扫描还要额外排序，同时 LIMIT 的偏移量很大，每次要扫描十万行再丢掉。" },
        { type: "interview", question: "你是怎么定位到具体是哪条 SQL 慢的？",
          approach: "按「监控 → 慢日志 → 执行计划」三层说，每层说看了什么、得出什么",
          answer: "先看接口监控，发现只有订单列表慢、而且翻页越往后越慢；再查 MySQL 慢查询日志，按接口时间段找到对应 SQL；最后对这条 SQL 做 EXPLAIN，看到 type=ALL、没有用到索引、还有 filesort，结合 LIMIT 100000 的偏移量，就能解释为什么越往后越慢。" }
      ]
    },
    {
      id: "fix",
      title: "解决手段",
      summary: "先加联合索引解决扫描和排序，再用游标分页解决深分页",
      status: "done",
      cards: [
        { type: "table", title: "两步改动", headers: ["改动", "解决了什么", "注意点"], rows: [
          ["加联合索引 (user_id, created_at)", "过滤和排序走索引，去掉 filesort", "大表加索引用 Online DDL，选低峰期"],
          ["只查需要的列", "减少回表数据量", "前端要同步确认字段"],
          ["游标分页", "不再扫描并丢弃前面的行", "不支持随机跳页，需要产品确认"]
        ] },
        { type: "points", items: [
          "索引列顺序：等值条件在前（user_id），排序列在后（created_at）",
          "游标用 (created_at, id) 组合，避免同一时间的多条记录漏掉或重复"
        ] },
        { type: "quote", text: "我分两步改：先加 user_id 加 created_at 的联合索引，让过滤和排序都走索引，P99 从 3.2 秒降到 400 毫秒；再把深分页改成游标分页，每次只取下一页，最后稳定在 45 毫秒左右。" },
        { type: "questions", items: [
          { q: "status 为什么没放进索引？", a: "status 只有几个值、区分度低，而且是 IN 条件，放在 created_at 前面会破坏排序；放在后面收益也有限。" }
        ] }
      ]
    },
    {
      id: "result",
      title: "结果与数据",
      summary: "用前后对比的数字收尾：延迟、资源、业务影响",
      status: "done",
      cards: [
        { type: "table", title: "前后对比", headers: ["指标", "调优前", "调优后"], rows: [
          ["接口 P99", "3.2s", "45ms"],
          ["单次扫描行数", "约 120 万", "20"],
          ["数据库 CPU（高峰）", "70%", "25%"]
        ] },
        { type: "points", items: [
          "数字要成对出现：调优前 → 调优后",
          "补一句业务结果：大促压测通过，客服后台不再超时"
        ] },
        { type: "quote", text: "上线后接口 P99 从 3.2 秒降到 45 毫秒，高峰期数据库 CPU 从 70% 降到 25%，大促压测顺利通过。" }
      ]
    },
    {
      id: "reflect",
      title: "反思与预防",
      summary: "为什么会出现这个问题，以后怎么提前发现",
      status: "current",
      cards: [
        { type: "note", title: "正在讲", text: "下一步：上线前的 SQL 审核要检查什么，以及慢查询看板怎么用起来。" },
        { type: "points", items: [
          "根因：早期数据量小，分页写法没人关注；数据涨到亿级后才暴露"
        ] }
      ]
    },
    {
      id: "sharding",
      title: "数据量继续增长怎么办",
      summary: "归档历史订单、按用户分库分表的取舍",
      optional: true,
      status: "todo",
      cards: []
    },
    {
      id: "pitch",
      title: "面试串讲",
      summary: "按「背景 → 定位 → 解决 → 结果 → 反思」讲 3 分钟",
      status: "todo",
      cards: []
    }
  ]
};
