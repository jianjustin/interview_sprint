// 测试用：覆盖全部卡片类型，并放入需要转义 / 不能执行的内容
window.INTERVIEW_COURSE = {
  version: 1,
  topic: "卡片样例 <i>不应倾斜</i>",
  slug: "all-cards",
  type: "knowledge",
  updatedAt: "2026-11-03T10:00:00+08:00",
  resume: { lesson: "cards", note: "全部卡片" },
  review: [],
  growth: [],
  lessons: [
    {
      id: "cards",
      title: "全部卡片",
      summary: "每种卡片一张",
      status: "done",
      cards: [
        { type: "points", items: ["<b>不应加粗</b>", "**应加粗** 和 `<code>`", "第一行\n第二行"] },
        { type: "steps", items: ["第一步", "第二步"] },
        { type: "quote", text: "可以照着说的一段话 <script>window.__pwned=3</script>" },
        { type: "interview", question: "面试题？", approach: "答题思路", answer: "参考回答" },
        { type: "qa", items: [{ q: "追问一", a: "回答一" }] },
        { type: "questions", items: [{ q: "你问过的问题", a: "当时的回答" }] },
        { type: "table", headers: ["列一", "列二"], rows: [["a", "<b>b</b>"], ["c", "d"]] },
        { type: "compare", options: [{ name: "方案 A", pros: ["优点"], cons: ["缺点"] }, { name: "方案 B", pros: ["优点"], cons: [] }], conclusion: "选 A" },
        { type: "chips", items: ["标签一", "标签二"] },
        { type: "code", language: "go", code: "x := <-ch\nif a < b && c > d {}" },
        { type: "note", text: "提示内容" },
        { type: "html", title: "自定义", optional: true, html: "<p class=\"custom\">自定义 <em>HTML</em></p><script>window.__pwned=1</script><img src=\"data:image/gif;base64,R0lGODlhAQABAAAAACw=\" onerror=\"window.__pwned=2\" alt=\"\"><a href=\"javascript:window.__pwned=4\">链接</a><img src=\"http:evil1.example/a.png\" alt=\"\"><img src=\"https:\\\\evil2.example/b.png\" alt=\"\"><div class=\"bg1\" style=\"background:u\\72l(https://evil3.example/c.png)\">背景一</div><div class=\"bg2\" style=\"background-image:image-set('https://evil4.example/d.png' 1x)\">背景二</div><img srcset=\"x.png 1x, https://evil5.example/e.png 2x\" alt=\"\"><img class=\"local\" src=\"data:image/gif;base64,R0lGODlhAQABAAAAACw=\" alt=\"\">" }
      ]
    },
    { id: "later", title: "以后再讲", summary: "未开始", status: "todo", cards: [] }
  ]
};
