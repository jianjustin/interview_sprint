// 课程页端到端检查：本机 Chrome 以 file:// 打开模板副本（B1–B9）
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { loadCore, loadCourseData, plain } from '../helpers/load-core.mjs';
import {
  launchBrowser, makeTopicDir, example, fixture, fileUrl, openPage, rewriteData, ARTIFACTS
} from '../helpers/browser.mjs';

const C = loadCore();
let browser, skipReason;
const opened = [];

before(async () => {
  const r = await launchBrowser();
  browser = r.browser;
  skipReason = r.skip;
});
after(async () => {
  for (const c of opened) await c.close().catch(() => {});
  if (browser) await browser.close();
});

function bt(name, fn) {
  test(name, async (t) => {
    if (!browser) { t.skip(skipReason); return; }
    await fn(t);
  });
}

async function open(dataFile, opts = {}) {
  const dir = makeTopicDir(dataFile);
  const r = await openPage(browser, fileUrl(path.join(dir, 'course.html')), opts);
  opened.push(r.context);
  if (dataFile && !opts.noWait) await r.page.waitForFunction(() => document.querySelector('#lesson-title')?.textContent.trim());
  return { ...r, dir, data: path.join(dir, 'course-data.js') };
}

const activeLesson = (page) => page.$eval('.tl-item.active', (el) => el.dataset.lesson);
const goLesson = (page, id) => page.click(`.tl-item[data-lesson="${id}"]`);
const errorsText = (page) => page.$$eval('#errors li', (els) => els.map((e) => e.textContent));

bt('B1 renders offline without network or console errors', async () => {
  for (const slug of ['realtime-billing', 'go-channel', 'sql-tuning']) {
    const { page, consoleErrors, requests } = await open(example(slug));
    await page.waitForTimeout(300);
    assert.deepEqual(consoleErrors, [], `${slug} 有 console 错误`);
    assert.ok(requests.length > 0);
    assert.deepEqual(requests.filter((u) => !u.startsWith('file:') && !u.startsWith('data:')), [], `${slug} 有网络请求`);
    assert.equal((await errorsText(page)).length, 0, `${slug} 不应显示错误`);
    const data = loadCourseData(example(slug));
    assert.equal(await page.textContent('#topic'), data.topic);
    assert.equal(await activeLesson(page), data.resume.lesson, '打开时应定位到 resume.lesson');
  }
});

bt('B2 architecture growth keeps positions and grows', async () => {
  const { page } = await open(example('realtime-billing'));
  const data = loadCourseData(example('realtime-billing'));
  const pos = new Set();
  const groupArea = {};
  for (const l of data.lessons) {
    await goLesson(page, l.id);
    const r = await page.$('svg [data-id="mq"] rect');
    if (r) pos.add(await r.evaluate((e) => `${e.getAttribute('x')},${e.getAttribute('y')}`));
    const g = await page.$('svg .group[data-id="metering"] rect');
    groupArea[l.id] = g ? await g.evaluate((e) => e.getAttribute('width') * e.getAttribute('height')) : 0;
    const hasBox = !!(await page.$('svg [data-id="box"]'));
    assert.equal(hasBox, l.id === 'requirements' || l.id === 'capacity', `黑盒在 ${l.id} 的可见性不对`);
  }
  assert.equal(pos.size, 1, 'Kafka 节点位置跨课变化');
  assert.ok(groupArea.degradation > groupArea.boundaries, '计量域应在加入死信队列后变大');
  assert.ok(groupArea.traffic > groupArea.degradation, '计量域应在加入限流网关后变大');

  await goLesson(page, 'boundaries');
  assert.ok(await page.$('svg .node.new[data-id="price"]'), '本课新增节点应高亮');
  assert.equal(await page.$('svg .node.new[data-id="mq"]'), null, '旧节点不应高亮');
  const added = await page.$$eval('#added .chip-new', (els) => els.map((e) => e.textContent));
  assert.ok(added.some((t) => t.includes('价格中心')), `本课新增缺少价格中心：${added}`);

  await goLesson(page, 'concurrency');
  const annots = await page.$$eval('svg .annot', (els) => els.map((e) => e.textContent));
  for (const t of ['按账户 ID 分区', 'Lua 原子扣减', '分区 ×64']) assert.ok(annots.includes(t), `缺少标注 ${t}`);

  await goLesson(page, 'pitch');
  const nums = await page.$$eval('svg .route-num', (els) => els.map((e) => e.textContent));
  assert.deepEqual(nums, ['1', '2', '3', '4', '5', '6', '7', '8']);
});

bt('B3 code panel highlights changed lines and shows <- literally', async () => {
  const { page } = await open(example('go-channel'));
  const data = loadCourseData(example('go-channel'));
  const versions = data.growth.find((g) => g.kind === 'code').versions;
  await page.click('.version-chip[data-version="v2"]');
  const changed = await page.$$eval('.code-line.changed', (els) => els.map((e) => e.textContent));
  const expected = plain(C.diffLines(versions[0].code, versions[1].code).filter((l) => l.changed).map((l) => l.text));
  assert.ok(expected.length > 0);
  assert.deepEqual(changed, expected);
  await page.click('.version-chip[data-version="v1"]');
  const lines = await page.$$eval('.code-line', (els) => els.map((e) => e.textContent));
  assert.ok(lines.includes('        jobs <- i'), '`<-` 应原样显示');
  assert.equal(await page.$$eval('.code-line.changed', (els) => els.length), 0, '第一个版本没有对比对象');
});

bt('B4 timeline bars are proportional to metrics', async () => {
  const { page } = await open(example('sql-tuning'));
  const data = loadCourseData(example('sql-tuning'));
  const idx = data.lessons.findIndex((l) => l.id === data.resume.lesson);
  const expected = C.timelineAt(data.growth[0], data.lessons, idx).events.filter((e) => e.pct != null).map((e) => e.pct);
  const widths = await page.$$eval('.tl-event .bar', (els) => els.map((e) => parseFloat(e.style.width)));
  assert.equal(widths.length, expected.length);
  widths.forEach((w, i) => assert.ok(Math.abs(w - expected[i]) < 0.5, `第 ${i} 条宽 ${w}，期望 ${expected[i]}`));
  assert.ok(await page.isVisible('#demo-banner'), 'experience 示范案例应显示提示条');
  assert.match(await page.textContent('#demo-banner'), /示范案例，请换成你自己的经历/);
});

bt('B5 all card types render with escaping and no script execution', async () => {
  const { page, consoleErrors, requests } = await open(fixture('all-cards'));
  const types = await page.$$eval('.card[data-type]', (els) => [...new Set(els.map((e) => e.dataset.type))].sort());
  assert.deepEqual(types, [...C.CARD_TYPES].sort());
  assert.equal(await page.$('#growth .panel'), null, 'growth 为空时不显示生长面板');
  assert.equal(await page.$eval('.card[data-type="points"]', (e) => e.querySelectorAll('b').length), 0);
  assert.equal(await page.$eval('.card[data-type="points"]', (e) => e.querySelectorAll('strong').length), 1);
  assert.ok((await page.textContent('.card[data-type="points"]')).includes('<b>不应加粗</b>'));
  assert.ok((await page.textContent('#topic')).includes('<i>不应倾斜</i>'));
  assert.ok((await page.textContent('.card[data-type="quote"]')).includes('<script>'));
  await page.waitForTimeout(300);
  assert.equal(await page.evaluate(() => window.__pwned), undefined, 'html 卡片中的脚本被执行了');
  const html = await page.$('.card[data-type="html"]');
  assert.ok(await html.$('.custom'));
  assert.equal(await html.$('script'), null);
  assert.equal(await html.$('[onerror]'), null);
  assert.equal(await html.$('a[href^="javascript:"]'), null);
  assert.ok(await page.$('.card[data-type="html"].optional'), 'optional 卡片应弱化显示');
  assert.ok((await page.textContent('.card[data-type="html"]')).includes('可选'));
  assert.ok((await page.textContent('.card[data-type="code"]')).includes('x := <-ch'));
  assert.equal(await html.$('[srcset]'), null, 'srcset 应被移除');
  assert.equal(await html.$('[style*="url"], [style*="image-set"], [style*="\\\\"]'), null, '带外部资源的 style 应被移除');
  assert.ok(await html.$('img.local[src^="data:image/"]'), '内联图片应保留');
  await page.waitForTimeout(300);
  assert.deepEqual(requests.filter((u) => !u.startsWith('file:') && !u.startsWith('data:')), [], 'html 卡片不应发出网络请求');
  assert.deepEqual(consoleErrors, []);
});

bt('B7 empty lessons still show validation errors', async () => {
  const { page } = await open(fixture('empty-lessons'), { noWait: true });
  await page.waitForSelector('#errors li', { timeout: 5000 });
  assert.ok((await errorsText(page)).some((t) => t.includes('lessons 必须是非空数组')));
});

bt('B7 malformed growth fields keep cards visible', async () => {
  const { page } = await open(fixture('bad-shape'));
  await page.waitForTimeout(600);
  assert.ok((await page.textContent('#cards')).includes('卡片仍应显示'));
  assert.ok((await errorsText(page)).some((t) => t.includes('必须是数组')));
});

bt('B2 svg labels are escaped', async () => {
  const { page, data } = await open(example('realtime-billing'));
  rewriteData(data, (d) => { d.growth[0].nodes.find((n) => n.id === 'biz').label = 'A<b>&B'; d.growth[0].annotations[0].text = '<i>x</i>'; });
  await page.waitForFunction(() => document.querySelector('svg [data-id="biz"] text')?.textContent === 'A<b>&B', null, { timeout: 5000 });
  assert.equal(await page.$('svg b, svg i'), null);
  assert.ok((await page.$$eval('svg .annot', (els) => els.map((e) => e.textContent))).includes('<i>x</i>'));
});

bt('B6 auto refresh keeps the lesson being viewed', async () => {
  const { page, data } = await open(example('realtime-billing'));
  await goLesson(page, 'architecture');
  const t0 = Date.now();
  rewriteData(data, (d) => {
    d.lessons.find((l) => l.id === 'architecture').cards.push({ type: 'note', text: '自动刷新测试' });
  });
  await page.waitForFunction(() => document.querySelector('#cards')?.textContent.includes('自动刷新测试'), null, { timeout: 5000 });
  assert.ok(Date.now() - t0 < 5000);
  assert.equal(await activeLesson(page), 'architecture', 'resume 没变时应保留当前查看的课');
  assert.ok(await page.$('#toast.show'), '应显示已更新提示');

  rewriteData(data, (d) => { d.resume.lesson = 'boundaries'; });
  await page.waitForFunction(() => document.querySelector('.tl-item.active')?.dataset.lesson === 'boundaries', null, { timeout: 5000 });
});

bt('B7 data errors are shown instead of a blank page', async () => {
  const dup = await open(fixture('dup-id'));
  assert.ok((await errorsText(dup.page)).some((t) => t.includes('重复')));
  assert.ok((await dup.page.$$('.tl-item')).length >= 1, '有错误时仍应渲染其余部分');

  const bad = await open(fixture('bad-ref'));
  const errs = await errorsText(bad.page);
  assert.ok(errs.some((t) => t.includes('"ghost"')) && errs.some((t) => t.includes('"nope"')), errs.join('\n'));
  assert.ok(await bad.page.$('svg [data-id="n1"]'));

  const syn = await open(fixture('syntax-error'), { noWait: true });
  await syn.page.waitForSelector('#errors li');
  assert.ok((await errorsText(syn.page)).some((t) => t.includes('语法错误')));
  assert.ok((await syn.page.textContent('body')).trim().length > 20, '不能白屏');

  const missing = await open(null, { noWait: true });
  await missing.page.waitForSelector('#errors li');
  assert.ok((await errorsText(missing.page)).some((t) => t.includes('找不到 course-data.js')));
});

bt('B7 syntax error then recovery while page is open', async () => {
  const { page, data } = await open(example('go-channel'));
  const good = (await import('node:fs')).readFileSync(data, 'utf8');
  writeFileSync(data, good.slice(0, Math.floor(good.length / 2)));
  await page.waitForSelector('#errors li', { timeout: 5000 });
  assert.ok((await errorsText(page)).some((t) => t.includes('语法错误')));
  assert.ok((await page.textContent('#lesson-title')).trim(), '应保留上一次成功的渲染');
  writeFileSync(data, good.replace('title: "写法演进"', 'title: "写法演进（已修复）"'));
  await page.waitForFunction(() => document.querySelector('#timeline')?.textContent.includes('已修复'), null, { timeout: 5000 });
  assert.equal((await errorsText(page)).length, 0, '修复后错误应消失');
});

bt('B8 prev next keyboard and play controls', async () => {
  const { page } = await open(example('realtime-billing'));
  const data = loadCourseData(example('realtime-billing'));
  const ids = data.lessons.map((l) => l.id);
  const at = async () => ids.indexOf(await activeLesson(page));
  assert.equal(await at(), ids.length - 1);
  await page.click('#btn-prev');
  assert.equal(await at(), ids.length - 2);
  await page.keyboard.press('ArrowLeft');
  assert.equal(await at(), ids.length - 3);
  await page.keyboard.press('ArrowRight');
  assert.equal(await at(), ids.length - 2);
  await page.click('#btn-next');
  assert.equal(await at(), ids.length - 1);
  assert.ok(await page.$eval('#btn-next', (b) => b.disabled), '最后一课的下一课按钮应禁用');
  await page.keyboard.press('ArrowRight');
  assert.equal(await at(), ids.length - 1, '最后一课再按 → 不应越界');

  await page.click('#btn-play');
  assert.match(await page.textContent('#btn-play'), /停止/);
  assert.equal(await at(), 0, '播放从第一课开始');
  await page.waitForTimeout(2100);
  assert.ok((await at()) >= 1, '播放中应自动前进');
  await page.click('#btn-play');
  assert.match(await page.textContent('#btn-play'), /播放/);
  const stoppedAt = await at();
  await page.waitForTimeout(2100);
  assert.equal(await at(), stoppedAt, '停止后不再前进');
});

function luminance(rgb) {
  const [r, g, b] = rgb.match(/[\d.]+/g).slice(0, 3).map(Number).map((v) => {
    v /= 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
const contrast = (a, b) => {
  const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
};

bt('B9 dark and light themes are readable and narrow screens use one column', async () => {
  mkdirSync(ARTIFACTS, { recursive: true });
  for (const scheme of ['light', 'dark']) {
    const { page } = await open(example('realtime-billing'), { colorScheme: scheme });
    await page.waitForTimeout(2200);
    const c = await page.evaluate(() => {
      const cs = (sel, prop) => getComputedStyle(document.querySelector(sel))[prop];
      return {
        text: cs('#lesson-title', 'color'), bg: cs('#stage', 'backgroundColor'),
        muted: cs('#lesson-summary', 'color'),
        nodeText: cs('svg .node text', 'fill'), nodeFill: cs('svg .node rect', 'fill'),
        canvas: cs('.panel-canvas', 'backgroundColor'), edgeLabel: cs('svg .edge-label', 'fill')
      };
    });
    assert.ok(contrast(c.text, c.bg) >= 4.5, `${scheme} 正文对比度不足 ${JSON.stringify(c)}`);
    assert.ok(contrast(c.muted, c.bg) >= 4.5, `${scheme} 次要文字对比度不足 ${JSON.stringify(c)}`);
    assert.ok(contrast(c.nodeText, c.nodeFill) >= 4.5, `${scheme} 节点文字对比度不足 ${JSON.stringify(c)}`);
    assert.ok(contrast(c.edgeLabel, c.canvas) >= 4.5, `${scheme} 连线标签对比度不足 ${JSON.stringify(c)}`);
    await page.screenshot({ path: path.join(ARTIFACTS, `realtime-billing-${scheme}.png`), fullPage: true });
  }
  for (const slug of ['go-channel', 'sql-tuning']) {
    const { page } = await open(example(slug), { colorScheme: 'dark' });
    await page.waitForTimeout(2200);
    await page.screenshot({ path: path.join(ARTIFACTS, `${slug}-dark.png`), fullPage: true });
  }
  const { page } = await open(example('sql-tuning'), { viewport: { width: 390, height: 844 } });
  await page.waitForTimeout(2200);
  const box = await page.evaluate(() => {
    const t = document.querySelector('#timeline').getBoundingClientRect();
    const s = document.querySelector('#stage').getBoundingClientRect();
    const a = document.querySelector('.tl-item.active').getBoundingClientRect();
    return { tBottom: t.bottom, sTop: s.top, scroll: document.documentElement.scrollWidth, activeVisible: a.left >= t.left && a.right <= t.right };
  });
  assert.ok(box.activeVisible, '窄屏下当前课应滚动到课程列表可见区域');
  const opt = await page.$eval('.tl-item.optional', (el) => [...el.querySelectorAll('*')].some((c) => c.textContent.trim() === '可选' && c.getClientRects().length > 0));
  assert.ok(opt, '窄屏下可选课仍应显示「可选」标记');
  assert.ok(box.tBottom <= box.sTop + 1, `窄屏应单列：${JSON.stringify(box)}`);
  assert.ok(box.scroll <= 390, `窄屏不应横向滚动：${JSON.stringify(box)}`);
  await page.screenshot({ path: path.join(ARTIFACTS, 'sql-tuning-narrow.png'), fullPage: true });
});

bt('long resume note is clamped to two lines with full text on hover', async () => {
  const { page, data } = await open(example('go-channel'));
  const long = '讲到哪、下一步讲什么。'.repeat(40);
  rewriteData(data, (d) => { d.resume.note = long; });
  await page.waitForFunction((n) => document.querySelector('#resume-note')?.title.includes(n.slice(0, 20)), long, { timeout: 5000 });
  const m = await page.$eval('#resume-note', (el) => ({ h: el.getBoundingClientRect().height, lh: parseFloat(getComputedStyle(el).lineHeight), title: el.title }));
  assert.ok(m.h <= m.lh * 2 + 2, `上次讲到最多显示两行：${JSON.stringify(m)}`);
  assert.ok(m.title.includes(long), '完整内容放在 title 里');
});
