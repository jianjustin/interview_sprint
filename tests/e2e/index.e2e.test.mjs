// 总览页端到端检查（B10）
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { copyFileSync, mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { loadCore, loadCourseData } from '../helpers/load-core.mjs';
import { launchBrowser, makeTopicDir, example, fileUrl, openPage, rewriteData, TEMPLATE_DIR, ARTIFACTS } from '../helpers/browser.mjs';

const C = loadCore();
const SLUGS = ['sql-tuning', 'go-channel', 'realtime-billing'];
let browser, skipReason;
before(async () => { const r = await launchBrowser(); browser = r.browser; skipReason = r.skip; });
after(async () => { if (browser) await browser.close(); });

function workspace(topics) {
  const root = mkdtempSync(path.join(os.tmpdir(), 'isprint-index-'));
  copyFileSync(path.join(TEMPLATE_DIR, 'index.html'), path.join(root, 'index.html'));
  for (const s of SLUGS) makeTopicDir(example(s), root, s);
  if (topics) writeFileSync(path.join(root, 'index-data.js'), 'window.INTERVIEW_INDEX = ' + JSON.stringify({ version: 1, topics }) + ';\n');
  return root;
}

test('B10 index tolerates broken topic and lists progress', async (t) => {
  if (!browser) return t.skip(skipReason);
  const root = workspace([...SLUGS.map((s) => ({ slug: s, dir: s })), { slug: 'ghost-topic', dir: 'ghost-topic' }]);
  const { page, context, consoleErrors, requests } = await openPage(browser, fileUrl(path.join(root, 'index.html')));
  await page.waitForFunction(() => document.querySelectorAll('.topic').length === 4, null, { timeout: 5000 });
  assert.equal(await page.$$eval('.topic.broken', (els) => els.length), 1);
  assert.match(await page.textContent('.topic.broken'), /ghost-topic/);

  const order = await page.$$eval('.topic:not(.broken)', (els) => els.map((e) => e.dataset.slug));
  assert.deepEqual(order, ['realtime-billing', 'go-channel', 'sql-tuning'], '应按最后更新时间倒序');

  for (const s of SLUGS) {
    const d = loadCourseData(example(s));
    const p = C.progressOf(d);
    const row = `.topic[data-slug="${s}"]`;
    assert.match(await page.textContent(`${row} .topic-progress`), new RegExp(`已学 ${p.requiredDone} / ${p.required} 课`));
    assert.ok((await page.textContent(`${row} .topic-resume`)).includes(d.resume.note));
    assert.ok((await page.textContent(row)).includes(d.topic));
  }
  assert.ok((await page.textContent('.topic[data-slug="sql-tuning"]')).includes('示范案例'));
  assert.deepEqual(requests.filter((u) => !u.startsWith('file:')), []);
  assert.deepEqual(consoleErrors.filter((e) => !e.includes('ERR_FILE_NOT_FOUND') && !e.includes('Failed to load resource')), []);

  mkdirSync(ARTIFACTS, { recursive: true });
  await page.screenshot({ path: path.join(ARTIFACTS, 'index.png'), fullPage: true });
  await page.click('.topic[data-slug="realtime-billing"] a');
  await page.waitForFunction(() => document.querySelector('#lesson-title')?.textContent.trim());
  assert.ok(page.url().endsWith('realtime-billing/course.html'));
  await context.close();
});

test('B10 index explains a missing index-data.js', async (t) => {
  if (!browser) return t.skip(skipReason);
  const root = workspace(null);
  const { page, context } = await openPage(browser, fileUrl(path.join(root, 'index.html')));
  await page.waitForSelector('#index-error:not([hidden])', { timeout: 5000 });
  assert.match(await page.textContent('#index-error'), /index-data\.js/);
  await context.close();
});

test('B10 index recovers after a half-written data file', async (t) => {
  if (!browser) return t.skip(skipReason);
  const topics = SLUGS.map((s) => ({ slug: s, dir: s }));
  const root = workspace(topics);
  const { page, context } = await openPage(browser, fileUrl(path.join(root, 'index.html')));
  await page.waitForFunction(() => document.querySelectorAll('.topic').length === 3, null, { timeout: 5000 });
  const good = 'window.INTERVIEW_INDEX = ' + JSON.stringify({ version: 1, topics }) + ';\n';
  writeFileSync(path.join(root, 'index-data.js'), good.slice(0, 30));
  await page.waitForSelector('#index-error:not([hidden])', { timeout: 8000 });
  writeFileSync(path.join(root, 'index-data.js'), good);
  await page.waitForSelector('#index-error', { state: 'hidden', timeout: 8000 });
  const courseData = path.join(root, 'go-channel', 'course-data.js');
  const src = (await import('node:fs')).readFileSync(courseData, 'utf8');
  writeFileSync(courseData, src.slice(0, 50));
  await page.waitForSelector('.topic.broken[data-slug="go-channel"]', { timeout: 8000 });
  assert.match(await page.textContent('.topic.broken'), /语法错误/);
  writeFileSync(courseData, src);
  await page.waitForSelector('.topic:not(.broken)[data-slug="go-channel"]', { timeout: 8000 });
  await context.close();
});

test('B10 index sorts by actual time across timezone formats', async (t) => {
  if (!browser) return t.skip(skipReason);
  const root = workspace([{ slug: 'go-channel', dir: 'go-channel' }, { slug: 'sql-tuning', dir: 'sql-tuning' }]);
  // 10:00Z = 北京时间 18:00，比 15:00+08:00 更晚；按字符串比较会排反
  rewriteData(path.join(root, 'go-channel', 'course-data.js'), (d) => { d.updatedAt = '2026-11-03T10:00:00Z'; });
  rewriteData(path.join(root, 'sql-tuning', 'course-data.js'), (d) => { d.updatedAt = '2026-11-03T15:00:00+08:00'; });
  const { page, context } = await openPage(browser, fileUrl(path.join(root, 'index.html')));
  await page.waitForFunction(() => document.querySelectorAll('.topic').length === 2, null, { timeout: 5000 });
  assert.deepEqual(await page.$$eval('.topic', (els) => els.map((e) => e.dataset.slug)), ['go-channel', 'sql-tuning']);
  await context.close();
});

test('B10 index refuses remote topic dirs', async (t) => {
  if (!browser) return t.skip(skipReason);
  const root = workspace([{ slug: 'evil', dir: 'https://example.com/x' }, { slug: 'go-channel', dir: 'go-channel' }]);
  const { page, context, requests } = await openPage(browser, fileUrl(path.join(root, 'index.html')));
  await page.waitForFunction(() => document.querySelectorAll('.topic').length === 2, null, { timeout: 5000 });
  assert.equal(await page.$$eval('.topic.broken', (els) => els.length), 1);
  assert.deepEqual(requests.filter((u) => !u.startsWith('file:')), []);
  await context.close();
});
