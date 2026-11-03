window.INTERVIEW_COURSE = {
  version: 1, topic: "错误引用", slug: "bad-ref", type: "system-design",
  resume: { lesson: "a", note: "" }, review: [],
  growth: [{
    kind: "architecture", title: "架构",
    nodes: [
      { id: "n1", label: "服务", col: 1, row: 1, since: "a" },
      { id: "n2", label: "存储", col: 2, row: 1, kind: "store", since: "nope" }
    ],
    edges: [{ from: "n1", to: "ghost", since: "a" }]
  }],
  lessons: [
    { id: "a", title: "第一课", summary: "", status: "current", cards: [{ type: "points", items: ["要点"] }] },
    { id: "b", title: "面试串讲", summary: "", status: "todo", cards: [] }
  ]
};
