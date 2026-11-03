import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadCore, plain } from '../helpers/load-core.mjs';

const C = loadCore();

function course() {
  return {
    version: 1,
    topic: '测试主题',
    slug: 'test-topic',
    type: 'system-design',
    updatedAt: '2026-11-03T10:00:00+08:00',
    resume: { lesson: 'c', note: '讲到 c' },
    review: [],
    growth: [
      {
        kind: 'architecture',
        title: '架构',
        nodes: [
          { id: 'n1', label: '业务', col: 1, row: 2, kind: 'service', since: 'a' },
          { id: 'box', label: '黑盒', col: 2, row: 2, span: 2, kind: 'placeholder', since: 'a', until: 'b' },
          { id: 'n2', label: 'Kafka', col: 2, row: 2, kind: 'store', since: 'b' },
          { id: 'n3', label: '计价', col: 3, row: 2, kind: 'service', since: 'b' },
          { id: 'n4', label: '余额', col: 3, row: 1, kind: 'service', since: 'c' }
        ],
        edges: [
          { from: 'n1', to: 'box', since: 'a', until: 'b' },
          { from: 'n1', to: 'n2', since: 'b' },
          { from: 'n2', to: 'n3', label: '消费', since: 'b' },
          { from: 'n3', to: 'n2', style: 'dashed', since: 'c' }
        ],
        groups: [{ id: 'g1', label: '计价域', members: ['n3', 'n4'], since: 'b' }],
        annotations: [{ node: 'n2', text: '分区 ×64', since: 'c' }],
        routes: [{ lesson: 'd', steps: ['n1', 'n2', 'n3'] }]
      },
      {
        kind: 'code',
        title: '代码',
        versions: [
          { id: 'v1', label: 'v1', language: 'go', code: 'a\nb\nc', since: 'a' },
          { id: 'v2', label: 'v2', language: 'go', code: 'a\nB\nc\nd', since: 'b' },
          { id: 'v3', label: 'v3', language: 'go', code: 'a\nB\nc\nd\n<-ctx.Done()', since: 'c' }
        ]
      },
      {
        kind: 'timeline',
        title: '排查',
        metricLabel: 'P99',
        events: [
          { title: '告警', metric: { value: 3.2, unit: 's' }, since: 'a' },
          { title: '加索引', metric: { value: 400, unit: 'ms' }, since: 'b' },
          { title: '游标分页', metric: { value: 45, unit: 'ms' }, since: 'c' }
        ]
      }
    ],
    lessons: [
      { id: 'a', title: 'A', summary: 'a', status: 'done', cards: [{ type: 'points', items: ['x'] }] },
      { id: 'b', title: 'B', summary: 'b', status: 'done', cards: [] },
      { id: 'c', title: 'C', summary: 'c', status: 'current', cards: [] },
      { id: 'd', title: '面试串讲', summary: 'd', status: 'todo', cards: [] }
    ]
  };
}

const arch = (d) => d.growth[0];
const idxOf = (d, id) => d.lessons.findIndex((l) => l.id === id);
const has = (list, ...parts) => list.some((m) => parts.every((p) => m.includes(p)));

test('inline escapes html', () => {
  assert.equal(C.inline('a <b> & **x** `<-ch`'), 'a &lt;b&gt; &amp; <strong>x</strong> <code>&lt;-ch</code>');
  assert.equal(C.inline('第一行\n第二行'), '第一行<br>第二行');
  assert.equal(C.inline('`**不加粗**`'), '<code>**不加粗**</code>');
});

test('node position stable across lessons', () => {
  const d = course();
  const sizes = new Set();
  d.lessons.forEach((_, i) => {
    const lay = C.layoutArchitecture(arch(d), d.lessons, i);
    sizes.add(`${lay.width}x${lay.height}`);
    for (const n of lay.nodes) {
      const box = C.nodeBox(arch(d).nodes.find((x) => x.id === n.id));
      assert.deepEqual(plain({ x: n.x, y: n.y, w: n.w, h: n.h }), plain(box), `节点 ${n.id} 在第 ${i} 课位置变化`);
    }
  });
  assert.equal(sizes.size, 1, '画布尺寸跨课变化');
  const wide = C.nodeBox(arch(d).nodes[1]);
  const one = C.nodeBox(arch(d).nodes[0]);
  assert.equal(wide.w, one.w + C.GRID.COL_W, 'span 2 的节点应多一列宽');
});

test('until hides element', () => {
  const d = course();
  const ids = (i) => C.layoutArchitecture(arch(d), d.lessons, i).nodes.map((n) => n.id);
  assert.ok(ids(0).includes('box'));
  assert.ok(!ids(1).includes('box'));
  assert.ok(!ids(3).includes('box'));
  const el = { since: 'a', until: 'c' };
  const map = C.lessonIndex(d);
  assert.deepEqual([0, 1, 2, 3].map((i) => C.isVisible(el, i, map)), [true, true, false, false]);
});

test('new elements flagged at their since lesson', () => {
  const d = course();
  const lay = C.layoutArchitecture(arch(d), d.lessons, 1);
  assert.deepEqual(plain(lay.nodes.filter((n) => n.isNew).map((n) => n.id).sort()), ['n2', 'n3']);
  assert.ok(lay.edges.find((e) => e.from === 'n2' && e.to === 'n3').isNew);
  assert.ok(lay.groups[0].isNew);
});

test('edges are clipped to node borders', () => {
  const d = course();
  const lay = C.layoutArchitecture(arch(d), d.lessons, 1);
  const e = lay.edges.find((x) => x.from === 'n1' && x.to === 'n2');
  const a = C.nodeBox(arch(d).nodes[0]);
  const b = C.nodeBox(arch(d).nodes[2]);
  assert.ok(e.x1 > a.x + a.w && e.x1 < a.x + a.w + 10, '起点应在源节点右边框外侧');
  assert.ok(e.x2 < b.x && e.x2 > b.x - 10, '终点应在目标节点左边框外侧');
});

test('group grows with members', () => {
  const d = course();
  const g1 = C.layoutArchitecture(arch(d), d.lessons, 1).groups[0];
  const g2 = C.layoutArchitecture(arch(d), d.lessons, 2).groups[0];
  assert.ok(g2.w * g2.h > g1.w * g1.h, '加入成员后分组框应变大');
  assert.equal(C.layoutArchitecture(arch(d), d.lessons, 0).groups.length, 0, 'since 之前不显示分组');
});

test('annotations attach above their node', () => {
  const d = course();
  const lay = C.layoutArchitecture(arch(d), d.lessons, 2);
  assert.equal(lay.annotations.length, 1);
  const n2 = C.nodeBox(arch(d).nodes[2]);
  assert.ok(lay.annotations[0].y < n2.y, '标注应在节点上方');
  assert.equal(C.layoutArchitecture(arch(d), d.lessons, 1).annotations.length, 0);
});

test('route numbers', () => {
  const d = course();
  assert.equal(C.layoutArchitecture(arch(d), d.lessons, 2).route.length, 0);
  const r = C.layoutArchitecture(arch(d), d.lessons, 3).route;
  assert.deepEqual(plain(r.map((x) => x.n)), [1, 2, 3]);
  assert.deepEqual(plain(r.map((x) => x.node)), ['n1', 'n2', 'n3']);
});

test('layout stable after lesson insertion and removal', () => {
  const before = course();
  const after = course();
  after.lessons.splice(2, 0, { id: 'x', title: 'X', summary: 'x', status: 'todo', cards: [] });
  const lb = C.layoutArchitecture(arch(before), before.lessons, idxOf(before, 'c'));
  const la = C.layoutArchitecture(arch(after), after.lessons, idxOf(after, 'c'));
  assert.deepEqual(plain(la.nodes), plain(lb.nodes));
  assert.deepEqual(plain(la.edges), plain(lb.edges));
  assert.deepEqual(plain(la.groups), plain(lb.groups));
  // 删除一个没有生长元素引用的课程，其余课程的图不变
  const removed = course();
  removed.growth[0].routes = [];
  const ref = course();
  ref.growth[0].routes = [];
  removed.lessons = removed.lessons.filter((l) => l.id !== 'd');
  assert.deepEqual(
    plain(C.layoutArchitecture(arch(removed), removed.lessons, 2)),
    plain(C.layoutArchitecture(arch(ref), ref.lessons, 2))
  );
});

test('diff highlights added and modified lines', () => {
  assert.deepEqual(plain(C.diffLines('a\nb\nc', 'a\nB\nc\nd').map((l) => l.changed)), [false, true, false, true]);
  assert.deepEqual(plain(C.diffLines(null, 'a\nb').map((l) => l.changed)), [false, false]);
  assert.deepEqual(plain(C.diffLines('a\nb', 'a\nb').map((l) => l.text)), ['a', 'b']);
});

test('code state follows lesson and picked version', () => {
  const d = course();
  const panel = d.growth[1];
  const s1 = C.codeStateAt(panel, d.lessons, 1);
  assert.equal(s1.active.id, 'v2');
  assert.deepEqual(plain(s1.versions.map((v) => [v.id, v.isNew])), [['v1', false], ['v2', true]]);
  assert.deepEqual(plain(s1.lines.map((l) => l.changed)), [false, true, false, true]);
  const picked = C.codeStateAt(panel, d.lessons, 2, 'v1');
  assert.equal(picked.active.id, 'v1');
  assert.ok(picked.lines.every((l) => !l.changed));
  const s3 = C.codeStateAt(panel, d.lessons, 2);
  assert.deepEqual(plain(s3.lines.filter((l) => l.changed).map((l) => l.text)), ['<-ctx.Done()']);
});

test('metric units normalize', () => {
  assert.equal(C.metricToBase({ value: 3.2, unit: 's' }), 3200);
  assert.equal(C.metricToBase({ value: 45, unit: 'ms' }), 45);
  assert.equal(C.metricToBase({ value: 2, unit: 'min' }), 120000);
  assert.equal(C.metricToBase({ value: 1, unit: 'KB' }), 1024);
  assert.equal(C.metricToBase({ value: 5, unit: '次' }), 5);
});

test('timeline pct proportional', () => {
  const d = course();
  const t = C.timelineAt(d.growth[2], d.lessons, 2);
  assert.equal(t.metricLabel, 'P99');
  assert.deepEqual(plain(t.events.map((e) => e.pct)), [100, 12.5, 2]);
  assert.deepEqual(plain(t.events.map((e) => e.good)), [false, true, true]);
  assert.deepEqual(plain(t.events.map((e) => e.isNew)), [false, false, true]);
  assert.equal(t.events[0].metricText, '3.2s');
  assert.equal(C.timelineAt(d.growth[2], d.lessons, 0).events.length, 1);
  // 刻度用全部事件的最大值，后续课程加入事件不会改变已有条的长度
  const higher = course();
  higher.growth[2].better = 'higher';
  assert.deepEqual(plain(C.timelineAt(higher.growth[2], higher.lessons, 2).events.map((e) => e.good)), [false, false, false]);
});

test('added summary lists this lesson elements', () => {
  const d = course();
  const b = C.addedAt(d, 1);
  for (const s of ['Kafka', '计价', '业务 → Kafka', 'Kafka → 计价', '计价域 边界', 'v2', '加索引']) {
    assert.ok(b.includes(s), `缺少 ${s}：${b.join('、')}`);
  }
  assert.ok(!b.includes('业务'));
  assert.ok(C.addedAt(d, 2).includes('分区 ×64'));
  assert.ok(C.addedAt(d, 3).includes('讲述路线 ①→③'));
});

test('progress counts required optional skipped separately', () => {
  const d = course();
  d.lessons = [
    { id: 'a', title: 'A', status: 'done' },
    { id: 'b', title: 'B', status: 'done', optional: true },
    { id: 'c', title: 'C', status: 'skipped', optional: true },
    { id: 'd', title: 'D', status: 'current' },
    { id: 'e', title: 'E', status: 'todo' }
  ];
  assert.deepEqual(plain(C.progressOf(d)), {
    required: 3, requiredDone: 1, optional: 1, optionalDone: 1, skipped: 1, currentIdx: 3
  });
});

test('valid course has no errors or warnings', () => {
  const r = C.validateCourse(course());
  assert.deepEqual(plain(r), { errors: [], warnings: [] });
});

test('validate catches broken data', () => {
  const cases = [
    [(d) => { d.lessons[1].id = 'a'; }, ['lessons[1].id', '重复', '"a"']],
    [(d) => { arch(d).nodes[2].id = 'n1'; }, ['growth[0].nodes[2].id', '重复', '"n1"']],
    [(d) => { arch(d).nodes[0].since = 'zz'; }, ['growth[0].nodes[0].since', '不存在的课程', '"zz"']],
    [(d) => { delete arch(d).nodes[0].since; }, ['growth[0].nodes[0]', '缺少 since']],
    [(d) => { arch(d).edges[1].until = 'a'; }, ['growth[0].edges[1].until', '之后']],
    [(d) => { arch(d).edges[1].to = 'zz'; }, ['growth[0].edges[1].to', '不存在的节点', '"zz"']],
    [(d) => { arch(d).groups[0].members.push('zz'); }, ['growth[0].groups[0].members', '"zz"']],
    [(d) => { arch(d).routes[0].steps.push('zz'); }, ['growth[0].routes[0].steps', '"zz"']],
    [(d) => { arch(d).routes[0].lesson = 'zz'; }, ['growth[0].routes[0].lesson', '"zz"']],
    [(d) => { arch(d).annotations[0].node = 'zz'; }, ['growth[0].annotations[0].node', '"zz"']],
    [(d) => { d.growth[1].versions[1].id = 'v1'; }, ['growth[1].versions[1].id', '重复']],
    [(d) => { d.resume.lesson = 'zz'; }, ['resume.lesson', '"zz"']],
    [(d) => { d.lessons[3].status = 'current'; }, ['current', '2']],
    [(d) => { d.lessons[0].status = 'finished'; }, ['lessons[0].status', '"finished"']],
    [(d) => { d.growth[0].kind = 'sequence'; }, ['growth[0].kind', '"sequence"']],
    [(d) => { d.type = 'other'; }, ['type', '"other"']],
    [(d) => { d.lessons = []; }, ['lessons']]
  ];
  for (const [mutate, parts] of cases) {
    const d = course();
    mutate(d);
    const { errors } = C.validateCourse(d);
    assert.ok(has(errors, ...parts), `期望错误包含 ${parts.join(' / ')}，实际：${JSON.stringify(errors)}`);
  }
  assert.ok(C.validateCourse(undefined).errors.length > 0);
});

test('validate warns on soft problems', () => {
  const cases = [
    [(d) => { d.lessons[0].cards[0].type = 'foo'; }, ['lessons[0].cards[0].type', '"foo"']],
    [(d) => { d.type = 'experience'; }, ['demoCase']],
    [(d) => { arch(d).nodes[3].col = 2; }, ['"n2"', '"n3"', '重叠']]
  ];
  for (const [mutate, parts] of cases) {
    const d = course();
    mutate(d);
    const { errors, warnings } = C.validateCourse(d);
    assert.deepEqual(plain(errors), []);
    assert.ok(has(warnings, ...parts), `期望警告包含 ${parts.join(' / ')}，实际：${JSON.stringify(warnings)}`);
  }
});

test('warns on overlapping nodes only when visible together', () => {
  // box(col 2-3,row 2) 与 n2(col 2,row 2) 位置重叠，但 box 在 n2 出现时已消失
  assert.deepEqual(plain(C.validateCourse(course()).warnings), []);
});

test('layout tolerates broken references', () => {
  const d = course();
  arch(d).edges.push({ from: 'n1', to: 'ghost', since: 'a' });
  arch(d).groups[0].members.push('ghost');
  arch(d).annotations.push({ node: 'ghost', text: 'x', since: 'a' });
  const lay = C.layoutArchitecture(arch(d), d.lessons, 2);
  assert.ok(lay.edges.every((e) => e.to !== 'ghost'));
  assert.equal(lay.annotations.length, 1);
});

test('edge labels sit on opposite sides for reverse edges', () => {
  const d = course();
  arch(d).edges[2].label = '请求';
  arch(d).edges[3].label = '结果';
  const lay = C.layoutArchitecture(arch(d), d.lessons, 2);
  const fwd = lay.edges.find((e) => e.from === 'n2' && e.to === 'n3');
  const rev = lay.edges.find((e) => e.from === 'n3' && e.to === 'n2');
  for (const e of [fwd, rev]) assert.ok(typeof e.lx === 'number' && typeof e.ly === 'number' && e.anchor, '连线应带标签坐标');
  // 水平双向连线：两个标签分在线的上下两侧，互不重叠
  assert.ok(Math.abs(fwd.ly - rev.ly) >= 16, `双向连线标签应分开：${fwd.ly} vs ${rev.ly}`);
  const mid = (fwd.y1 + rev.y1) / 2;
  assert.ok((fwd.ly - mid) * (rev.ly - mid) < 0, '两个标签应在中线两侧');
  // 单向水平连线：标签在线上方居中
  const one = lay.edges.find((e) => e.from === 'n1' && e.to === 'n2');
  assert.equal(one.anchor, 'middle');
  assert.ok(one.ly < one.y1);
});

test('warns on crowded annotations', () => {
  // 同一节点同时可见 4 条标注
  const many = course();
  for (let i = 0; i < 3; i++) arch(many).annotations.push({ node: 'n2', text: `标注${i}`, since: 'c' });
  const w1 = C.validateCourse(many);
  assert.deepEqual(plain(w1.errors), []);
  assert.ok(has(w1.warnings, '"n2"', '标注'), JSON.stringify(w1.warnings));
  // 标注堆叠压住正上方的节点：n4 在 n3 正上方（row 1），n3 挂 5 条标注
  const over = course();
  for (let i = 0; i < 5; i++) arch(over).annotations.push({ node: 'n3', text: `能力${i}`, since: 'c' });
  const w2 = C.validateCourse(over);
  assert.ok(has(w2.warnings, '"n3"', '"n4"'), JSON.stringify(w2.warnings));
  // 标注文字过长
  const long = course();
  arch(long).annotations[0].text = '这是一条明显太长的标注文字会压住相邻列';
  assert.ok(has(C.validateCourse(long).warnings, '过长'));
  // 正常数据不警告
  assert.deepEqual(plain(C.validateCourse(course()).warnings), []);
});

test('non-array growth fields do not throw', () => {
  const d = course();
  arch(d).nodes = { n1: {} };
  arch(d).edges = 'oops';
  d.growth[1].versions = {};
  d.growth[2].events = 3;
  assert.doesNotThrow(() => C.addedAt(d, 1));
  assert.doesNotThrow(() => C.layoutArchitecture(arch(d), d.lessons, 1));
  assert.doesNotThrow(() => C.codeStateAt(d.growth[1], d.lessons, 1));
  assert.doesNotThrow(() => C.timelineAt(d.growth[2], d.lessons, 1));
  assert.ok(C.validateCourse(d).errors.some((e) => e.includes('必须是数组')));
});

test('numeric version ids can be picked', () => {
  const d = course();
  d.growth[1].versions.forEach((v, i) => { v.id = i + 1; });
  assert.equal(C.codeStateAt(d.growth[1], d.lessons, 2, '1').active.id, 1);
});
