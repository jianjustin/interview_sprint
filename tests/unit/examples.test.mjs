import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { loadCore, loadCourseData, plain, ROOT } from '../helpers/load-core.mjs';

const C = loadCore();
const EXAMPLES = ['realtime-billing', 'go-channel', 'sql-tuning'];
const load = (dir) => loadCourseData(path.join(ROOT, dir, 'course-data.js'));
const examples = Object.fromEntries(EXAMPLES.map((s) => [s, load(`examples/${s}`)]));

for (const slug of EXAMPLES) {
  test(`example ${slug} is valid with no warnings`, () => {
    const d = examples[slug];
    assert.equal(d.slug, slug);
    assert.deepEqual(plain(C.validateCourse(d)), { errors: [], warnings: [] });
  });

  test(`example ${slug} follows lesson conventions`, () => {
    const d = examples[slug];
    assert.match(d.lessons.at(-1).title, /串讲/);
    for (const l of d.lessons.filter((x) => x.status === 'done')) {
      const types = l.cards.map((c) => c.type);
      assert.ok(types.includes('points'), `${slug}/${l.id} 缺少要点卡`);
      assert.ok(types.includes('quote'), `${slug}/${l.id} 缺少面试怎么讲卡`);
    }
    for (const l of d.lessons.filter((x) => x.status === 'todo')) {
      assert.equal((l.cards || []).length, 0, `${slug}/${l.id} 未开始的课不应有卡片`);
    }
    assert.ok(d.lessons.some((l) => l.optional), `${slug} 应至少有一门可选课`);
  });
}

test('examples cover all card types and panel kinds', () => {
  const cards = new Set();
  const panels = new Set();
  for (const d of Object.values(examples)) {
    d.lessons.forEach((l) => (l.cards || []).forEach((c) => cards.add(c.type)));
    d.growth.forEach((g) => panels.add(g.kind));
  }
  assert.deepEqual([...cards].sort(), [...C.CARD_TYPES].sort());
  assert.deepEqual([...panels].sort(), ['architecture', 'code', 'timeline']);
});

test('example shapes match the plan', () => {
  const rb = examples['realtime-billing'];
  assert.equal(rb.type, 'system-design');
  const arch = rb.growth.find((g) => g.kind === 'architecture');
  for (const id of ['biz', 'box', 'gw', 'mq', 'dlq', 'rate', 'price', 'bal', 'owe', 'redis', 'bill', 'db', 'recon']) {
    assert.ok(arch.nodes.some((n) => n.id === id), `realtime-billing 缺少节点 ${id}`);
  }
  const box = arch.nodes.find((n) => n.id === 'box');
  assert.equal(box.kind, 'placeholder');
  assert.equal(rb.lessons.find((l) => l.id === box.until).title, '系统架构', '黑盒应在「系统架构」课被拆开');
  assert.equal(arch.groups.length, 4);
  assert.ok(arch.annotations.length >= 5);
  assert.equal(arch.routes.length, 1);
  const last = rb.lessons.at(-1);
  assert.equal(last.status, 'current');
  assert.equal(arch.routes[0].lesson, last.id);
  assert.ok(rb.lessons.some((l) => l.optional && l.status === 'done'));
  assert.ok(rb.lessons.some((l) => l.optional && l.status === 'skipped'));

  const gc = examples['go-channel'];
  assert.equal(gc.type, 'knowledge');
  const code = gc.growth.find((g) => g.kind === 'code');
  assert.equal(code.versions.length, 4);
  assert.ok(code.versions.some((v) => v.code.includes('<-')));
  assert.ok(gc.growth.some((g) => g.kind === 'architecture'));
  assert.equal(gc.lessons.filter((l) => l.status === 'current').length, 1);
  const html = gc.lessons.flatMap((l) => l.cards || []).find((c) => c.type === 'html');
  assert.ok(html && !/<script/i.test(html.html));

  const sq = examples['sql-tuning'];
  assert.equal(sq.type, 'experience');
  assert.equal(sq.demoCase, true);
  const tl = sq.growth.find((g) => g.kind === 'timeline');
  assert.equal(tl.metricLabel, '订单列表接口 P99');
  assert.ok(sq.growth.some((g) => g.kind === 'code'));
  assert.equal(sq.lessons.at(-1).status, 'todo');
});

test('index-data lists the three examples', () => {
  const ctx = { window: {} };
  vm.runInNewContext(readFileSync(path.join(ROOT, 'examples/index-data.js'), 'utf8'), ctx);
  assert.deepEqual(plain(ctx.window.INTERVIEW_INDEX), {
    version: 1,
    topics: EXAMPLES.map((s) => ({ slug: s, dir: s }))
  });
});

test('all-cards fixture has every card type and hostile html', () => {
  const d = load('tests/fixtures/all-cards');
  assert.deepEqual(plain(C.validateCourse(d).errors), []);
  assert.deepEqual(plain(d.growth), []);
  const cards = d.lessons.flatMap((l) => l.cards || []);
  assert.deepEqual([...new Set(cards.map((c) => c.type))].sort(), [...C.CARD_TYPES].sort());
  const html = cards.find((c) => c.type === 'html').html;
  assert.ok(html.includes('<script>window.__pwned=1</script>'));
  assert.ok(html.includes('onerror="window.__pwned=2"'));
});

test('broken fixtures produce errors', () => {
  assert.ok(C.validateCourse(load('tests/fixtures/dup-id')).errors.some((e) => e.includes('重复')));
  assert.ok(C.validateCourse(load('tests/fixtures/bad-ref')).errors.some((e) => e.includes('不存在')));
  assert.throws(() => load('tests/fixtures/syntax-error'), { name: 'SyntaxError' });
});
