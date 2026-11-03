// 开发期浏览器测试辅助：解析 playwright-core，启动本机 Chrome（回退到 Playwright 自带 Chromium）。
import { execSync } from 'node:child_process';
import { copyFileSync, mkdtempSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { ROOT, SKILL_DIR } from './load-core.mjs';

const require = createRequire(import.meta.url);

function candidates() {
  const list = ['playwright-core'];
  if (process.env.PLAYWRIGHT_CORE_PATH) list.push(process.env.PLAYWRIGHT_CORE_PATH);
  try {
    const root = execSync('npm root -g', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
    list.push(path.join(root, 'playwright-core'));
    list.push(path.join(root, '@playwright/mcp/node_modules/playwright-core'));
    list.push(path.join(root, '@playwright/test/node_modules/playwright-core'));
  } catch {}
  return list;
}

let cached;
export function loadPlaywright() {
  if (cached !== undefined) return cached;
  cached = null;
  for (const c of candidates()) {
    try { cached = require(c); break; } catch {}
  }
  return cached;
}

// 返回 { browser } 或 { skip: '原因' }
export async function launchBrowser() {
  if (process.env.ISPRINT_NO_BROWSER) return { skip: 'ISPRINT_NO_BROWSER 已设置，跳过浏览器测试' };
  const pw = loadPlaywright();
  if (!pw) return { skip: '找不到 playwright-core（可设置 PLAYWRIGHT_CORE_PATH，或全局安装 @playwright/mcp）' };
  const errors = [];
  for (const opts of [{ channel: 'chrome' }, {}]) {
    try {
      const browser = await pw.chromium.launch({ headless: true, ...opts });
      return { browser, name: opts.channel || 'chromium' };
    } catch (e) { errors.push(e.message.split('\n')[0]); }
  }
  return { skip: '无法启动 Chrome / Chromium：' + errors.join(' | ') };
}

export const TEMPLATE_DIR = path.join(SKILL_DIR, 'assets');

// 在临时目录里搭一个主题：复制模板 + 数据，返回目录
export function makeTopicDir(dataFile, root = mkdtempSync(path.join(os.tmpdir(), 'isprint-')), slug = 'topic') {
  const dir = path.join(root, slug);
  mkdirSync(dir, { recursive: true });
  copyFileSync(path.join(TEMPLATE_DIR, 'course.html'), path.join(dir, 'course.html'));
  if (dataFile) copyFileSync(dataFile, path.join(dir, 'course-data.js'));
  return dir;
}

export const example = (slug) => path.join(ROOT, 'examples', slug, 'course-data.js');
export const fixture = (name) => path.join(ROOT, 'tests', 'fixtures', name, 'course-data.js');
export const fileUrl = (p) => pathToFileURL(p).href;

// 打开页面并收集 console 错误、页面错误和全部请求
export async function openPage(browser, url, { colorScheme = 'light', viewport = { width: 1280, height: 900 } } = {}) {
  const context = await browser.newContext({ colorScheme, viewport });
  const page = await context.newPage();
  const consoleErrors = [];
  const requests = [];
  page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()); });
  page.on('pageerror', (e) => consoleErrors.push(String(e)));
  page.on('request', (r) => requests.push(r.url()));
  await page.goto(url);
  return { page, context, consoleErrors, requests };
}

// 读出数据文件、修改后写回（保持 window.INTERVIEW_COURSE = ... 形式）
export function rewriteData(file, mutate) {
  const src = readFileSync(file, 'utf8');
  const sandbox = { window: {} };
  new Function('window', src)(sandbox.window);
  const data = sandbox.window.INTERVIEW_COURSE;
  mutate(data);
  writeFileSync(file, 'window.INTERVIEW_COURSE = ' + JSON.stringify(data, null, 2) + ';\n');
  return data;
}

export const ARTIFACTS = path.join(ROOT, 'tests', 'artifacts');
