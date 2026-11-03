// 从模板里抽出 <script id="course-core">，在 vm 中执行，返回纯逻辑对象 CourseCore。
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import vm from 'node:vm';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
export const SKILL_DIR = path.join(ROOT, 'interview-sprint');
export const TEMPLATE = path.join(SKILL_DIR, 'assets', 'course.html');

export function extractScript(html, id) {
  const m = html.match(new RegExp(`<script id="${id}">([\\s\\S]*?)</script>`));
  if (!m) throw new Error(`模板中找不到 <script id="${id}">`);
  return m[1];
}

export function loadCore(templatePath = TEMPLATE) {
  const ctx = { window: {} };
  vm.runInNewContext(extractScript(readFileSync(templatePath, 'utf8'), 'course-core'), ctx);
  if (!ctx.window.CourseCore) throw new Error('course-core 没有定义 window.CourseCore');
  return ctx.window.CourseCore;
}

// 执行一个 course-data.js，返回 window.INTERVIEW_COURSE（语法错误时抛出）
export function loadCourseData(file) {
  const ctx = { window: {} };
  vm.runInNewContext(readFileSync(file, 'utf8'), ctx, { filename: file });
  return ctx.window.INTERVIEW_COURSE;
}

// vm 中创建的对象原型属于另一个 realm，转成本 realm 的普通对象，方便 deepStrictEqual
export const plain = (v) => JSON.parse(JSON.stringify(v));
