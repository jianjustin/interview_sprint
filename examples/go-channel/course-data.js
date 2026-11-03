window.INTERVIEW_COURSE = {
  version: 1,
  topic: "讲述一个 Go channel 使用场景",
  slug: "go-channel",
  type: "knowledge",
  updatedAt: "2026-11-03T15:05:00+08:00",
  resume: { lesson: "evolution", note: "讲完 worker pool（v2），下一步：用 context 让 worker 可取消（v3）" },
  review: ["for range 一个没人 close 的 channel 会怎样"],

  growth: [
    {
      kind: "code",
      title: "批量任务处理：写法演进",
      versions: [
        { id: "v1", since: "scenario", label: "v1 无缓冲 channel", language: "go",
          note: "一个生产者、一个消费者，close 通知结束",
          code: [
            "func main() {",
            "    jobs := make(chan int)",
            "    done := make(chan struct{})",
            "",
            "    go func() {",
            "        for j := range jobs {",
            "            fmt.Println(\"handle\", j)",
            "        }",
            "        close(done)",
            "    }()",
            "",
            "    for i := 0; i < 5; i++ {",
            "        jobs <- i",
            "    }",
            "    close(jobs)",
            "    <-done",
            "}"
          ].join("\n") },
        { id: "v2", since: "evolution", label: "v2 worker pool", language: "go",
          note: "多个 worker 并发消费，WaitGroup 等全部结束",
          code: [
            "func run(jobs []Job, workers int) {",
            "    ch := make(chan Job, 100)",
            "    var wg sync.WaitGroup",
            "",
            "    for i := 0; i < workers; i++ {",
            "        wg.Add(1)",
            "        go func() {",
            "            defer wg.Done()",
            "            for j := range ch {",
            "                handle(j)",
            "            }",
            "        }()",
            "    }",
            "",
            "    for _, j := range jobs {",
            "        ch <- j",
            "    }",
            "    close(ch)",
            "    wg.Wait()",
            "}"
          ].join("\n") },
        { id: "v3", since: "evolution", label: "v3 context 取消", language: "go",
          note: "select 同时等任务和取消信号，生产者也要能退出",
          code: [
            "func run(ctx context.Context, jobs []Job, workers int) {",
            "    ch := make(chan Job, 100)",
            "    var wg sync.WaitGroup",
            "",
            "    for i := 0; i < workers; i++ {",
            "        wg.Add(1)",
            "        go func() {",
            "            defer wg.Done()",
            "            for {",
            "                select {",
            "                case <-ctx.Done():",
            "                    return",
            "                case j, ok := <-ch:",
            "                    if !ok {",
            "                        return",
            "                    }",
            "                    handle(j)",
            "                }",
            "            }",
            "        }()",
            "    }",
            "",
            "send:",
            "    for _, j := range jobs {",
            "        select {",
            "        case ch <- j:",
            "        case <-ctx.Done():",
            "            break send",
            "        }",
            "    }",
            "    close(ch)",
            "    wg.Wait()",
            "}"
          ].join("\n") },
        { id: "v4", since: "evolution", label: "v4 errgroup 收集错误", language: "go",
          note: "任一 worker 出错就取消其余，并把第一个错误返回给调用方",
          code: [
            "func run(ctx context.Context, jobs []Job, workers int) error {",
            "    g, ctx := errgroup.WithContext(ctx)",
            "    ch := make(chan Job)",
            "",
            "    g.Go(func() error {",
            "        defer close(ch)",
            "        for _, j := range jobs {",
            "            select {",
            "            case ch <- j:",
            "            case <-ctx.Done():",
            "                return ctx.Err()",
            "            }",
            "        }",
            "        return nil",
            "    })",
            "",
            "    for i := 0; i < workers; i++ {",
            "        g.Go(func() error {",
            "            for j := range ch {",
            "                if err := handle(ctx, j); err != nil {",
            "                    return err",
            "                }",
            "            }",
            "            return nil",
            "        })",
            "    }",
            "    return g.Wait()",
            "}"
          ].join("\n") }
      ]
    },
    {
      kind: "architecture",
      title: "channel 内部结构（概念图）",
      nodes: [
        { id: "sender", label: "发送方 G", col: 1, row: 1, kind: "external", since: "internals" },
        { id: "hchan", label: "hchan", col: 3, row: 1, kind: "service", since: "internals" },
        { id: "receiver", label: "接收方 G", col: 5, row: 1, kind: "external", since: "internals" },
        { id: "buf", label: "环形缓冲 buf", col: 2, row: 2, kind: "store", since: "internals" },
        { id: "sendq", label: "sendq 等待发送", col: 3, row: 2, kind: "store", since: "internals" },
        { id: "recvq", label: "recvq 等待接收", col: 4, row: 2, kind: "store", since: "internals" }
      ],
      edges: [
        { from: "sender", to: "hchan", label: "ch <- v", since: "internals" },
        { from: "hchan", to: "receiver", label: "<-ch", since: "internals" },
        { from: "hchan", to: "buf", label: "有空位", style: "dashed", since: "internals" },
        { from: "hchan", to: "sendq", label: "满了", style: "dashed", since: "internals" },
        { from: "hchan", to: "recvq", label: "空了", style: "dashed", since: "internals" }
      ],
      groups: [
        { id: "runtime", label: "runtime.hchan", members: ["hchan", "buf", "sendq", "recvq"], since: "internals" }
      ],
      annotations: [
        { node: "hchan", text: "lock 保护所有字段", since: "internals" },
        { node: "recvq", text: "有等待者就直接拷贝", since: "internals" }
      ]
    }
  ],

  lessons: [
    {
      id: "what",
      title: "channel 是什么、解决什么问题",
      summary: "goroutine 之间传数据并同步的管道：用通信来共享内存",
      status: "done",
      cards: [
        { type: "points", items: [
          "channel = 带锁的队列 + 阻塞/唤醒机制",
          "解决两件事：**传数据**和**同步时机**",
          "无缓冲 channel 是一次同步交接；有缓冲 channel 解耦生产和消费速度",
          "close 是广播：所有接收者都会收到零值和 `ok=false`"
        ] },
        { type: "quote", text: "channel 我理解为 goroutine 之间的管道，它同时解决传数据和同步两件事。Go 提倡用通信来共享内存，而不是用共享内存来通信。" },
        { type: "compare", title: "channel 还是 mutex", options: [
          { name: "channel", pros: ["表达所有权转移和流水线很自然", "配合 select 能做超时、取消"], cons: ["只为保护一个计数器时开销偏大", "用错容易死锁或 goroutine 泄漏"] },
          { name: "sync.Mutex", pros: ["保护共享状态最直接", "开销小"], cons: ["不表达时序和事件", "锁粒度设计不好会成为瓶颈"] }
        ], conclusion: "传递数据所有权、编排流程用 channel；保护一小块共享状态用 mutex。" },
        { type: "interview", question: "什么时候用 channel，什么时候用 mutex？",
          approach: "先给判断标准，再各举一个例子",
          answer: "看要表达的是什么。如果是数据在 goroutine 之间流动、或者要编排「谁先谁后」，用 channel，比如任务分发、结果汇总；如果只是多个 goroutine 读写同一份状态，比如计数器、缓存 map，用 mutex 更简单、开销更小。" }
      ]
    },
    {
      id: "internals",
      title: "底层原理",
      summary: "hchan 结构、环形缓冲和两个等待队列，发送和接收各三种情况",
      status: "done",
      cards: [
        { type: "points", items: [
          "`make(chan T, n)` 在堆上分配 hchan，所有字段由一把 lock 保护",
          "发送时：有等待的接收者 → 直接拷贝给它；缓冲有空位 → 入队；否则挂到 sendq 休眠",
          "接收与发送对称；关闭时唤醒 sendq 和 recvq 里的所有 G"
        ] },
        { type: "code", title: "hchan 主要字段", language: "go", code: [
          "type hchan struct {",
          "    qcount   uint           // 缓冲里现有元素数",
          "    dataqsiz uint           // 缓冲容量",
          "    buf      unsafe.Pointer // 环形缓冲",
          "    closed   uint32",
          "    sendx    uint           // 下一个写入位置",
          "    recvx    uint           // 下一个读取位置",
          "    recvq    waitq          // 等待接收的 G",
          "    sendq    waitq          // 等待发送的 G",
          "    lock     mutex",
          "}"
        ].join("\n") },
        { type: "quote", text: "底层是 runtime 里的 hchan：一个环形缓冲加两个等待队列，用一把锁保护。发送分三种情况：有人在等就直接交给他，缓冲有空位就放进去，否则自己挂起等待。" },
        { type: "html", title: "不同状态下的操作结果", html: "<table style=\"width:100%;border-collapse:collapse;font-size:.82rem\"><tr><th style=\"text-align:left\">操作</th><th style=\"text-align:left\">nil channel</th><th style=\"text-align:left\">已关闭</th><th style=\"text-align:left\">正常</th></tr><tr><td>发送</td><td>永久阻塞</td><td style=\"color:var(--danger)\">panic</td><td>阻塞或成功</td></tr><tr><td>接收</td><td>永久阻塞</td><td>零值, ok=false</td><td>阻塞或成功</td></tr><tr><td>关闭</td><td style=\"color:var(--danger)\">panic</td><td style=\"color:var(--danger)\">panic</td><td>成功</td></tr></table>" },
        { type: "qa", items: [
          { q: "有缓冲 channel 是无锁的吗？", a: "不是，所有操作都要先拿 hchan.lock，只是持锁时间很短。" },
          { q: "为什么向等待中的接收者发送时直接拷贝？", a: "跳过缓冲少一次拷贝，并且能立刻唤醒对方。" }
        ] }
      ]
    },
    {
      id: "scenario",
      title: "典型场景：批量任务处理",
      summary: "从一个真实 case 出发：把一批任务并发处理完，再汇总结果",
      status: "done",
      cards: [
        { type: "points", items: [
          "场景：后台一次要处理几万条对账任务，串行太慢",
          "先写最小版本：一个生产者、一个消费者、用 close 通知结束",
          "`done` channel 让 main 等消费者退出，避免提前返回"
        ] },
        { type: "quote", text: "我讲一个用过的场景：对账服务每天要处理几万条任务，我用 channel 把任务分发给一组 worker 并发处理。先从最简单的版本说起。" },
        { type: "interview", question: "举一个你在项目里用 channel 的场景？",
          approach: "场景 → 为什么用 channel → 怎么写 → 遇到的坑，四步讲",
          answer: "对账服务每天要跑几万条任务。我用一个带缓冲的 channel 当任务队列，起固定数量的 worker 并发消费，用 WaitGroup 等全部完成；后来加了 context，超时或上游取消时 worker 能及时退出；最后换成 errgroup，任何一条失败都能把错误带回来。" }
      ]
    },
    {
      id: "evolution",
      title: "写法演进",
      summary: "worker pool → context 取消 → errgroup 收集错误",
      status: "current",
      cards: [
        { type: "note", title: "正在讲", text: "已讲完 v2 worker pool。下一步：v3 为什么要在 select 里同时等 `ctx.Done()`，以及生产者为什么也要能退出。" },
        { type: "interview", question: "worker pool 里，谁负责 close 任务 channel？",
          approach: "说原则（发送方关闭），再说多个发送方时怎么办",
          answer: "由唯一的发送方在发完之后关闭，接收方永远不要关闭 channel。如果有多个发送方，用 WaitGroup 等所有发送方结束后，由一个单独的 goroutine 来关闭。" }
      ]
    },
    {
      id: "pitfalls",
      title: "常见坑",
      summary: "goroutine 泄漏、重复关闭、nil channel、range 不退出",
      status: "todo",
      cards: []
    },
    {
      id: "compare",
      title: "与相近方案对比",
      summary: "channel、mutex、sync.Cond、atomic 各自适合什么",
      optional: true,
      status: "todo",
      cards: []
    },
    {
      id: "backpressure",
      title: "背压与并发控制",
      summary: "用缓冲大小和信号量 channel 控制并发度、反压上游",
      optional: true,
      status: "todo",
      cards: []
    },
    {
      id: "pitch",
      title: "面试串讲",
      summary: "按「场景 → 写法演进 → 原理 → 坑」讲 5 分钟",
      status: "todo",
      cards: []
    }
  ]
};
