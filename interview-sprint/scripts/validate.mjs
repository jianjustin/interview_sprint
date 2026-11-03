#!/usr/bin/env node
// 可选：校验 course-data.js（不是流程的必需步骤）。
// 用法：node <skill 目录>/scripts/validate.mjs .interview_points/<slug>/course-data.js
// 校验逻辑直接取自 assets/course.html 里的 CourseCore，与课程页显示的错误一致。
import { readFileSync } from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const file = process.argv[2];
if (!file) {
  console.error('用法：node validate.mjs <course-data.js>');
  process.exit(2);
}

const here = path.dirname(fileURLToPath(import.meta.url));
const html = readFileSync(path.join(here, '..', 'assets', 'course.html'), 'utf8');
const core = html.match(/<script id="course-core">([\s\S]*?)<\/script>/);
const coreCtx = { window: {} };
vm.runInNewContext(core[1], coreCtx);
const C = coreCtx.window.CourseCore;

let data;
try {
  const ctx = { window: {} };
  vm.runInNewContext(readFileSync(file, 'utf8'), ctx, { filename: file });
  data = ctx.window.INTERVIEW_COURSE;
} catch (e) {
  const where = (e.stack || '').split('\n').find((l) => l.includes(file)) || '';
  console.log(`✗ ${file} 有语法错误：${e.message}${where ? '\n  ' + where.trim() : ''}`);
  process.exit(1);
}

const { errors, warnings } = C.validateCourse(data);
for (const e of errors) console.log('✗ ' + e);
for (const w of warnings) console.log('△ ' + w);
if (errors.length) {
  console.log(`共 ${errors.length} 个错误、${warnings.length} 条提示。`);
  process.exit(1);
}
console.log(`✓ 校验通过：${data.topic}（${data.lessons.length} 课${warnings.length ? `，${warnings.length} 条提示` : ''}）`);
