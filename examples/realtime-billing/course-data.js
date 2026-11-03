window.INTERVIEW_COURSE = {
  version: 1,
  topic: "设计一个实时计费系统",
  slug: "realtime-billing",
  type: "system-design",
  updatedAt: "2026-11-03T16:40:00+08:00",
  resume: { lesson: "pitch", note: "讲完 10 分钟路线和开场白，下一步：常见追问与应对" },
  review: ["预扣和实扣的区别", "Kafka 分区数怎么定"],

  growth: [
    {
      kind: "architecture",
      title: "系统架构",
      nodes: [
        { id: "biz", label: "业务服务", col: 1, row: 2, kind: "external", since: "requirements" },
        { id: "box", label: "计费系统（黑盒）", col: 3, row: 2, span: 3, kind: "placeholder", since: "requirements", until: "architecture" },
        { id: "mq", label: "Kafka", col: 3, row: 2, kind: "store", since: "architecture" },
        { id: "rate", label: "计价引擎", col: 4, row: 2, kind: "service", since: "architecture" },
        { id: "bal", label: "余额服务", col: 5, row: 2, kind: "service", since: "architecture" },
        { id: "bill", label: "账单服务", col: 6, row: 2, kind: "service", since: "architecture" },
        { id: "price", label: "价格中心", col: 4, row: 1, kind: "service", since: "boundaries" },
        { id: "owe", label: "欠费控制", col: 5, row: 1, kind: "service", since: "boundaries" },
        { id: "redis", label: "Redis 余额", col: 5, row: 3, kind: "store", since: "boundaries" },
        { id: "db", label: "MySQL 流水", col: 6, row: 3, kind: "store", since: "boundaries" },
        { id: "dlq", label: "死信队列", col: 3, row: 3, kind: "store", since: "degradation" },
        { id: "gw", label: "限流网关", col: 2, row: 2, kind: "service", since: "traffic" },
        { id: "recon", label: "对账任务", col: 7, row: 2.5, kind: "service", since: "consistency" }
      ],
      edges: [
        { from: "biz", to: "box", label: "用量事件", since: "requirements", until: "architecture" },
        { from: "biz", to: "mq", label: "用量事件", since: "architecture", until: "traffic" },
        { from: "mq", to: "rate", since: "architecture" },
        { from: "rate", to: "bal", label: "扣费请求", since: "architecture" },
        { from: "bal", to: "bill", since: "architecture", until: "boundaries" },
        { from: "price", to: "rate", label: "规则", style: "dashed", since: "boundaries" },
        { from: "bal", to: "owe", label: "余额不足", since: "boundaries" },
        { from: "bal", to: "redis", since: "boundaries" },
        { from: "bal", to: "db", since: "boundaries" },
        { from: "db", to: "bill", label: "汇总", since: "boundaries" },
        { from: "mq", to: "dlq", label: "失败", style: "dashed", since: "degradation" },
        { from: "biz", to: "gw", label: "用量事件", since: "traffic" },
        { from: "gw", to: "mq", since: "traffic" },
        { from: "recon", to: "db", label: "核对", style: "dashed", since: "consistency" },
        { from: "recon", to: "bill", style: "dashed", since: "consistency" }
      ],
      groups: [
        { id: "metering", label: "计量域", members: ["gw", "mq", "dlq"], since: "boundaries" },
        { id: "rating", label: "计价域", members: ["rate", "price"], since: "boundaries" },
        { id: "account", label: "账户域", members: ["bal", "owe", "redis"], since: "boundaries" },
        { id: "billing", label: "账单域", members: ["bill", "db", "recon"], since: "boundaries" }
      ],
      annotations: [
        { node: "biz", text: "峰值 10w 事件/s", since: "capacity" },
        { node: "bal", text: "Redis 挂 → DB 扣", since: "degradation" },
        { node: "gw", text: "令牌桶 10w/s", since: "traffic" },
        { node: "mq", text: "分区 ×64", since: "traffic" },
        { node: "mq", text: "按账户 ID 分区", since: "concurrency" },
        { node: "redis", text: "Lua 原子扣减", since: "concurrency" },
        { node: "db", text: "流水号唯一键", since: "concurrency" },
        { node: "recon", text: "差异自动冲正", since: "consistency" }
      ],
      routes: [
        { lesson: "pitch", steps: ["biz", "gw", "mq", "rate", "bal", "redis", "db", "recon"] }
      ]
    }
  ],

  lessons: [
    {
      id: "requirements",
      title: "需求澄清",
      summary: "先问清楚计什么费、多实时、量多大，再动手画图",
      status: "done",
      cards: [
        { type: "chips", title: "需求清单", items: ["预付费：余额不足要停服", "上报峰值 10w 事件/s", "扣费延迟 < 1s", "金额零误差、可追溯", "账单按小时 / 天出", "计费规则可配置、可回溯"] },
        { type: "points", items: [
          "**计费模式**决定实时性：预付费要实时扣、实时拦截；后付费可以周期出账",
          "**量级和峰值**决定要不要削峰：上报量远大于扣费能力时必须异步",
          "**准确性**决定账本设计：零误差、可追溯 → 流水是唯一账本",
          "把不做的也说清楚：支付渠道、发票不在这次范围"
        ] },
        { type: "quote", text: "我先确认几个问题：预付费还是后付费？上报量级和峰值多少？对扣费实时性和金额准确性的要求是什么？这几点决定后面走实时扣费还是周期出账。" },
        { type: "interview", question: "预付费和后付费在架构上差别大吗？",
          approach: "先给结论（差别很大），再从实时性、拦截、出账周期三点对比，最后说你会怎么确认",
          answer: "差别很大。预付费要求实时扣费，余额不足时要**实时拦截**，所以系统必须在线维护余额；后付费可以先记录用量，按周期批量计价出账，对实时性的要求低得多。所以我会先确认计费模式，它决定整套架构要不要走实时链路。" },
        { type: "questions", items: [
          { q: "需求澄清一般花多长时间？", a: "控制在 1–2 分钟，问 3–5 个关键问题；其余用合理假设补齐，并把假设说出来。" }
        ] }
      ]
    },
    {
      id: "capacity",
      title: "容量估算",
      summary: "用几组数字说明为什么需要削峰、为什么余额放缓存",
      optional: true,
      status: "done",
      cards: [
        { type: "table", title: "估算表", headers: ["指标", "估算", "推论"], rows: [
          ["上报 QPS", "日均 2w/s，峰值 10w/s", "峰谷差 5 倍 → MQ 削峰"],
          ["事件大小", "约 200B", "峰值约 20MB/s，Kafka 轻松承载"],
          ["账户数", "1000 万，日活 100 万", "热余额约 100 万条 → 放 Redis"],
          ["流水量", "按账户分钟聚合后约 1 亿条/天", "MySQL 按月分表"]
        ] },
        { type: "points", items: [
          "估算只为推出设计结论，数字取整即可",
          "先聚合再扣费：同一账户一分钟内的事件合并成一笔，扣费次数降两个数量级"
        ] },
        { type: "quote", text: "我简单估一下量级：峰值 10 万事件每秒，但同一账户一分钟内可以先聚合，真正落到扣费的写入是每秒几千笔，这个量级单库分表就能扛住。" }
      ]
    },
    {
      id: "architecture",
      title: "系统架构",
      summary: "拆成采集 → 计价 → 扣费 → 出账四段，用 MQ 把上报和计费解耦",
      status: "done",
      cards: [
        { type: "points", items: [
          "上报量远大于扣费能力 → Kafka 削峰、解耦",
          "计价无状态，可以横向扩容",
          "余额服务管钱，单独拆出来",
          "账单面向展示，允许分钟级延迟"
        ] },
        { type: "quote", text: "整体我拆成四段：业务上报用量事件进 Kafka，计价引擎消费并算出费用，余额服务扣费，账单服务出账。我先把数据流画出来，每段一句话，然后看您想深挖哪一段。" },
        { type: "interview", question: "为什么不让业务服务同步调用计费扣费？",
          approach: "从故障隔离、峰值、业务延迟三个角度回答",
          answer: "同步调用会把计费的延迟和故障直接传导给业务：计费一慢，业务接口跟着慢；计费一挂，业务就停了。上报量还有明显峰值，同步链路要按峰值配资源。用 Kafka 异步化后，业务只负责可靠上报，计费按自己的节奏消费。" },
        { type: "qa", items: [
          { q: "Kafka 会不会丢消息？", a: "acks=all、3 副本、消费端处理完再提交 offset，做到至少一次投递，重复靠幂等去重。" },
          { q: "异步了还怎么做到余额不足就停服？", a: "扣费延迟控制在秒级，配合单账户透支额度；欠费控制会主动通知业务停服。" }
        ] },
        { type: "questions", items: [
          { q: "预扣之后计价算错了怎么办？", a: "实扣以计价结果为准，差额走补扣或退款流水，不直接改余额。" }
        ] }
      ]
    },
    {
      id: "boundaries",
      title: "模块边界",
      summary: "按「谁对什么数据负责」划 4 个域，跨域只走接口或消息",
      status: "done",
      cards: [
        { type: "table", title: "边界划分", headers: ["域", "负责", "拥有的数据"], rows: [
          ["计量域", "收事件、去重、削峰", "原始用量事件"],
          ["计价域", "用量 × 规则 → 费用", "价格规则（带版本）"],
          ["账户域", "余额、预扣、欠费", "余额、冻结额度"],
          ["账单域", "流水、出账、对账", "扣费流水、账单"]
        ] },
        { type: "points", items: [
          "余额**只有账户域能改**，其他域要动钱只能发扣费请求",
          "价格规则带版本号，按事件发生时间取规则",
          "流水是账本，Redis 余额只是快照"
        ] },
        { type: "quote", text: "我按数据归属划边界：余额只有账户域能改，其他域要动钱只能发扣费请求；价格规则归计价域，并且带版本，这样规则变更不会影响已经算过的费用。" },
        { type: "compare", title: "欠费控制放哪个域", options: [
          { name: "放在计价域", pros: ["算完费用顺手判断"], cons: ["要读余额，跨域访问账户数据", "充值后恢复服务的逻辑也得放这里"] },
          { name: "放在账户域", pros: ["余额变化时就地判断，数据就在本域", "充值、扣费、停服在同一处闭环"], cons: ["账户域职责变多，需要控制复杂度"] }
        ], conclusion: "放在账户域：欠费是余额状态的结果，判断它所需的数据都在账户域。" },
        { type: "interview", question: "价格规则变了，已经算过的费用怎么办？",
          approach: "先说原则（按事件时间取规则版本），再说追溯场景怎么处理",
          answer: "规则带版本号和生效时间，计价时按**事件发生时间**取规则版本，所以规则变更不影响已算的费用。如果确实要追溯调价，走单独的重算任务，生成差额流水，而不是改历史记录。" }
      ]
    },
    {
      id: "degradation",
      title: "故障降级",
      summary: "每个依赖都问一句「它挂了怎么办」，给出降级路径",
      status: "done",
      cards: [
        { type: "steps", title: "逐个依赖过一遍", items: [
          "Kafka 不可用：业务端 SDK 本地落盘，恢复后补报",
          "计价引擎故障：事件堆积在 Kafka，恢复后追平；计价失败的事件进死信队列",
          "Redis 不可用：切到 MySQL 行锁扣费，并按单账户限额放行",
          "MySQL 主库故障：主从切换期间暂停落账，扣费请求留在 Kafka"
        ] },
        { type: "points", items: [
          "降级期间的流水标记为「待确认」，恢复后由对账核实",
          "死信队列要有重放工具和告警，不能只进不出"
        ] },
        { type: "quote", text: "我按依赖逐个过：Kafka 挂、Redis 挂、数据库挂，分别说影响面和降级方式。核心原则是用量不能丢、钱不能算错，实时性可以暂时让步。" },
        { type: "qa", items: [
          { q: "限额放行会不会亏钱？", a: "有少量敞口，用单账户限额加事后追缴控制住，比整体停服的损失小得多。" }
        ] }
      ]
    },
    {
      id: "traffic",
      title: "突发流量",
      summary: "入口限流、MQ 扩分区、消费端批量处理，三层吸收峰值",
      status: "done",
      cards: [
        { type: "points", items: [
          "网关令牌桶限流，超限事件在业务端缓冲重试，**只延迟不丢弃**",
          "分区数决定消费并行度上限，按峰值预留",
          "消费端按账户批量聚合，减少扣费次数"
        ] },
        { type: "quote", text: "峰值从哪来？大促、批任务补报、客户端重试风暴。我在入口、队列、消费端三个位置吸收它。" },
        { type: "interview", question: "大促时上报量涨 10 倍，你怎么扛？",
          approach: "按入口 → 队列 → 消费三层说，每层一个手段和一个数字",
          answer: "入口用令牌桶限流，超出部分让 SDK 本地缓冲重试；Kafka 提前把分区扩到 64，消费者跟着扩；消费端把同一账户一分钟内的事件聚合成一笔扣费，写入量能降两个数量级。这样峰值主要被队列吸收，扣费链路只是延迟变大。" },
        { type: "qa", items: [
          { q: "被限流的用量还计费吗？", a: "要计，不能丢只能延迟：本地落盘后重试上报，事件带唯一 ID 去重。" }
        ] }
      ]
    },
    {
      id: "concurrency",
      title: "并发控制",
      summary: "同一账户的扣费要串行：按账户分区 + Lua 原子扣减，防止超扣",
      status: "done",
      cards: [
        { type: "points", items: [
          "同一账户的事件进同一分区，消费天然串行",
          "Lua 脚本里「查余额 + 扣减」原子完成",
          "落账用流水号唯一键保证幂等"
        ] },
        { type: "quote", text: "超扣的根因是先读后写不原子。我用两层来保证：按账户分区让同一账户串行，Redis 里用 Lua 把检查和扣减做成一步。" },
        { type: "compare", title: "防超扣方案", options: [
          { name: "分布式锁", pros: ["通用，好理解"], cons: ["每笔扣费多一次网络往返", "锁超时、续期处理复杂"] },
          { name: "分区串行 + Lua 原子扣减", pros: ["无额外锁开销", "天然有序，便于幂等"], cons: ["热点账户集中在单分区"] }
        ], conclusion: "选分区串行 + Lua；热点账户单独拆子账户分摊。" },
        { type: "questions", items: [
          { q: "热点账户（比如一个大客户）会不会把一个分区打满？", a: "会。可以把大客户拆成多个子账户分别扣费，汇总时再合并。" }
        ] }
      ]
    },
    {
      id: "consistency",
      title: "一致性与可用性",
      summary: "扣费链路选最终一致，用对账和自动冲正兜底准确性",
      status: "done",
      cards: [
        { type: "points", items: [
          "Redis 余额是快照，**MySQL 流水才是账本**",
          "准实时对账 + T+1 全量对账",
          "差异自动冲正，超过阈值告警、人工介入"
        ] },
        { type: "quote", text: "可用性和准确性冲突时，我先保证不停服，再用对账保证最终准确：流水是唯一事实来源，Redis 余额随时可以按流水重建。" },
        { type: "interview", question: "CAP 里你选了什么？",
          approach: "不要只答字母，说清楚哪条链路选什么、靠什么兜底",
          answer: "扣费链路选可用性加最终一致：Redis 快速扣减，异步落流水，对账任务发现差异自动冲正。余额查询和充值读主库，保证用户看到的是准确值。" },
        { type: "qa", items: [
          { q: "对账发现 Redis 比流水多扣了怎么办？", a: "以流水为准生成冲正流水，把差额加回 Redis，并记录原因用于排查。" }
        ] }
      ]
    },
    {
      id: "observability",
      title: "可观测性",
      summary: "扣费延迟、对账差异率、死信堆积三类核心指标",
      optional: true,
      status: "skipped",
      cards: []
    },
    {
      id: "pitch",
      title: "面试串讲",
      summary: "把前面的课串成一条 10 分钟的讲述路线",
      status: "current",
      cards: [
        { type: "steps", title: "10 分钟路线", items: [
          "需求澄清（1 分钟）：计费模式、量级、准确性",
          "四段架构（2 分钟）：上报 → 计价 → 扣费 → 出账",
          "深挖扣费链路（3 分钟）：边界、并发控制",
          "故障与流量（2 分钟）：逐个依赖降级、三层削峰",
          "一致性兜底（1 分钟）：流水是账本，对账冲正",
          "留钩子等追问（1 分钟）"
        ] },
        { type: "quote", title: "开场白", text: "我先花一分钟确认需求，然后画出整体架构，再挑扣费这条最核心的链路深挖，最后讲故障和一致性怎么兜底。" },
        { type: "note", title: "正在讲", text: "下一步：常见追问与应对。讲完后可以让我扮演面试官，按这条路线追问一轮。" }
      ]
    }
  ]
};
