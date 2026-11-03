// A2 与包结构检查：frontmatter 规范、SKILL.md 篇幅与措辞、模板自包含、示例模板与包内一致、可选校验脚本
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { ROOT, SKILL_DIR } from '../helpers/load-core.mjs';

const skillMd = readFileSync(path.join(SKILL_DIR, 'SKILL.md'), 'utf8');
const fm = skillMd.match(/^---\n([\s\S]*?)\n---\n/);
const field = (name) => fm && (fm[1].match(new RegExp(`^${name}:\\s*(.+)$`, 'm')) || [])[1];
const body = fm ? skillMd.slice(fm[0].length) : skillMd;

test('frontmatter follows Agent Skills spec', () => {
  assert.ok(fm, 'SKILL.md 缺少 frontmatter');
  const name = field('name');
  assert.match(name, /^[a-z0-9]+(-[a-z0-9]+)*$/);
  assert.ok(name.length <= 64);
  assert.equal(name, path.basename(SKILL_DIR), '目录名应与 name 一致');
  const desc = field('description');
  assert.ok(desc && desc.length > 0, 'description 必须存在');
  assert.ok(desc.length <= 1024, `description 过长：${desc.length}`);
  assert.ok(!/: /.test(desc) && !/^[\s'"[{>|*&!%@`#-]/.test(desc), 'description 应是可安全解析的单行 YAML 纯量');
  assert.match(desc, /[一-鿿]/, 'description 需要中文触发词');
  for (const kw of ['面试', 'interview', '系统设计', 'system design', '八股', '准备面试', '继续']) {
    assert.ok(desc.toLowerCase().includes(kw.toLowerCase()), `description 缺少触发词 ${kw}`);
  }
});

test('SKILL.md body stays short and tool-neutral', () => {
  const lines = body.split('\n').length;
  assert.ok(lines <= 320, `SKILL.md 正文 ${lines} 行，超过约 300 行`);
  for (const bad of ['AskUserQuestion', 'TodoWrite', 'apply_patch', 'request_user_input', 'Task tool', 'Skill tool', 'WebFetch']) {
    assert.ok(!skillMd.includes(bad), `SKILL.md 不应依赖工具专属名称 ${bad}`);
  }
  assert.ok(body.includes('本 SKILL.md 所在目录'), '需写明 skill 目录 = 本 SKILL.md 所在目录');
  for (const must of ['.interview_points', 'course-data.js', 'index-data.js', '面试串讲', '可选', 'resume', '示范案例', '待回顾']) {
    assert.ok(body.includes(must), `SKILL.md 缺少关键内容：${must}`);
  }
});

test('files referenced by SKILL.md exist', () => {
  const refs = [...new Set(skillMd.match(/(references|assets|scripts)\/[\w.-]+\.\w+/g) || [])];
  assert.ok(refs.length >= 5);
  for (const r of refs) assert.ok(existsSync(path.join(SKILL_DIR, r)), `SKILL.md 引用的 ${r} 不存在`);
});

test('templates are self-contained', () => {
  for (const f of ['course.html', 'index.html']) {
    const html = readFileSync(path.join(SKILL_DIR, 'assets', f), 'utf8');
    const urls = (html.match(/https?:\/\/[^\s"'<>)]+/g) || []).filter((u) => !u.startsWith('http://www.w3.org/'));
    assert.deepEqual(urls, [], `${f} 引用了外部资源`);
    assert.ok(!/@import|<link\b|<script[^>]+src=["']?https?:/i.test(html), `${f} 不应引用外部样式或脚本`);
  }
});

test('example templates are byte-identical to the package templates', () => {
  const tpl = readFileSync(path.join(SKILL_DIR, 'assets', 'course.html'));
  for (const s of ['realtime-billing', 'go-channel', 'sql-tuning']) {
    const copy = path.join(ROOT, 'examples', s, 'course.html');
    assert.ok(existsSync(copy), `${copy} 不存在（运行 tests/run-all.sh 会复制）`);
    assert.ok(readFileSync(copy).equals(tpl), `examples/${s}/course.html 与模板不一致，请重新复制`);
  }
  assert.ok(readFileSync(path.join(ROOT, 'examples', 'index.html')).equals(readFileSync(path.join(SKILL_DIR, 'assets', 'index.html'))));
});

test('optional validate script reports errors with exit codes', () => {
  const run = (f) => spawnSync(process.execPath, [path.join(SKILL_DIR, 'scripts', 'validate.mjs'), f], { encoding: 'utf8' });
  for (const s of ['realtime-billing', 'go-channel', 'sql-tuning']) {
    const r = run(path.join(ROOT, 'examples', s, 'course-data.js'));
    assert.equal(r.status, 0, r.stdout + r.stderr);
    assert.match(r.stdout, /通过/);
  }
  const bad = run(path.join(ROOT, 'tests/fixtures/bad-ref/course-data.js'));
  assert.equal(bad.status, 1);
  assert.match(bad.stdout + bad.stderr, /"ghost"/);
  const syn = run(path.join(ROOT, 'tests/fixtures/syntax-error/course-data.js'));
  assert.equal(syn.status, 1);
  assert.match(syn.stdout + syn.stderr, /语法错误/);
  assert.equal(run('').status, 2, '缺少参数时退出码 2');
});

test('docs match template behavior', () => {
  assert.match(body, /mkdir -p \.interview_points\/<slug>/, 'SKILL.md 复制模板前应先建目录');
  const df = readFileSync(path.join(SKILL_DIR, 'references', 'data-format.md'), 'utf8');
  assert.match(df, /纯文本/, 'data-format.md 应写明哪些字段是纯文本（不支持行内格式）');
  for (const f of ['topic', 'label', 'resume.note']) assert.ok(df.includes(f), `data-format.md 的纯文本字段说明缺少 ${f}`);
});

test('README is English by default with a Chinese version', () => {
  const en = readFileSync(path.join(ROOT, 'README.md'), 'utf8');
  const zh = readFileSync(path.join(ROOT, 'README.zh-CN.md'), 'utf8');
  assert.match(en.split('\n').slice(0, 5).join('\n'), /\[简体中文\]\(README\.zh-CN\.md\)/, 'README.md 顶部应有中文版链接');
  assert.match(zh.split('\n').slice(0, 5).join('\n'), /\[English\]\(README\.md\)/, 'README.zh-CN.md 顶部应有英文版链接');
  const cjk = (s) => (s.match(/[一-鿿]/g) || []).length / s.length;
  assert.ok(cjk(en) < 0.05, `README.md 应以英文为主（中文字符占比 ${cjk(en).toFixed(2)}）`);
  assert.ok(cjk(zh) > 0.15, 'README.zh-CN.md 应以中文为主');
  for (const s of [en, zh]) {
    for (const must of ['install.sh --git', 'install.sh --update', 'git clone', '/interview-sprint', '/skill:interview-sprint', '$interview-sprint', 'bash tests/run-all.sh']) {
      assert.ok(s.includes(must), `README 缺少 ${must}`);
    }
  }
});
