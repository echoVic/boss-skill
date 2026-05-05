#!/usr/bin/env node
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { initPipeline } from '../runtime/cli/lib/pipeline-runtime.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PKG_ROOT = path.resolve(__dirname, '..', '..', '..', '..');
const DEFAULT_TEMPLATE_DIR = path.join(PKG_ROOT, 'skill', 'templates');
const PROJECT_TEMPLATE_DIR = path.join('.boss', 'templates');

const PLACEHOLDERS: Array<{ file: string; title: string; infoTitle: string; agent: string }> = [
  { file: 'prd.md', title: '产品需求文档 (PRD)', infoTitle: '文档信息', agent: 'PM Agent' },
  { file: 'architecture.md', title: '系统架构文档', infoTitle: '文档信息', agent: 'Architect Agent' },
  { file: 'ui-spec.md', title: 'UI/UX 规范文档', infoTitle: '文档信息', agent: 'UI Designer Agent' },
  { file: 'tech-review.md', title: '技术评审报告', infoTitle: '文档信息', agent: 'Tech Lead Agent' },
  { file: 'tasks.md', title: '开发任务规格文档', infoTitle: '文档信息', agent: 'Scrum Master Agent' },
  { file: 'qa-report.md', title: 'QA 测试报告', infoTitle: '报告信息', agent: 'QA Agent' },
  { file: 'deploy-report.md', title: '部署报告', infoTitle: '报告信息', agent: 'DevOps Agent' }
];

function showHelp(): void {
  process.stdout.write(
    [
      'Boss Mode - 项目初始化',
      '',
      '用法: boss project init <feature-name> [options]',
      '',
      '选项:',
      '  -h, --help      显示帮助信息',
      '  -t, --template  初始化项目级模板目录（.boss/templates）',
      '  -f, --force     强制覆盖已存在的目录',
      ''
    ].join('\n')
  );
}

function validateFeatureName(feature: string): void {
  if (!feature) throw new Error('请提供功能名称');
  if (!/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(feature)) {
    throw new Error('功能名称格式无效（仅允许小写字母、数字和连字符，不能以连字符开头或结尾）');
  }
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function writePlaceholder(targetDir: string, feature: string, date: string, item: (typeof PLACEHOLDERS)[number]): void {
  const content = [
    `# ${item.title}`,
    '',
    `## ${item.infoTitle}`,
    `- **功能名称**：${feature}`,
    `- **创建日期**：${date}`,
    '- **状态**：待填充',
    '',
    '---',
    '',
    `> 此文件将由 ${item.agent} 自动填充`,
    ''
  ].join('\n');
  fs.writeFileSync(path.join(targetDir, item.file), content, 'utf8');
}

function copyTemplates(cwd: string, force: boolean): void {
  if (!fs.existsSync(DEFAULT_TEMPLATE_DIR)) {
    throw new Error(`未找到内置模板目录: ${DEFAULT_TEMPLATE_DIR}`);
  }

  const projectTemplateDir = path.join(cwd, PROJECT_TEMPLATE_DIR);
  if (fs.existsSync(projectTemplateDir)) {
    if (!force) {
      throw new Error(`模板目录已存在: '${PROJECT_TEMPLATE_DIR}'. 为避免覆盖，已停止初始化。`);
    }
    fs.rmSync(projectTemplateDir, { recursive: true, force: true });
  }

  fs.mkdirSync(projectTemplateDir, { recursive: true });
  for (const file of fs.readdirSync(DEFAULT_TEMPLATE_DIR).filter((name) => name.endsWith('.template')).sort()) {
    fs.copyFileSync(path.join(DEFAULT_TEMPLATE_DIR, file), path.join(projectTemplateDir, file));
  }

  fs.writeFileSync(
    path.join(projectTemplateDir, 'README.md'),
    [
      '# Boss 项目模板说明',
      '',
      '此目录中的模板会覆盖 Skill 内置模板。',
      '',
      '模板查找优先级：',
      '1. `.boss/templates/<name>.template`',
      '2. Skill 内置 `templates/<name>.template`',
      '',
      '说明：',
      '- `boss project init` 只负责初始化轻量占位文件',
      '- Boss 在真正生成某个产物前，会调用 `boss artifact prepare` 按相同优先级准备当前文档骨架',
      ''
    ].join('\n'),
    'utf8'
  );
}

export function main(argv: string[] = process.argv.slice(2), { cwd = process.cwd() }: { cwd?: string } = {}): number {
  if (argv.includes('-h') || argv.includes('--help')) {
    showHelp();
    return 0;
  }

  let feature = '';
  let force = false;
  let initTemplates = false;
  for (const arg of argv) {
    if (arg === '-f' || arg === '--force') {
      force = true;
    } else if (arg === '-t' || arg === '--template') {
      initTemplates = true;
    } else if (arg.startsWith('-')) {
      throw new Error(`未知选项: ${arg}`);
    } else if (!feature) {
      feature = arg;
    } else {
      throw new Error(`多余的参数: ${arg}`);
    }
  }

  validateFeatureName(feature);

  if (initTemplates) {
    copyTemplates(cwd, force);
    process.stdout.write(`模板目录：\n  ${PROJECT_TEMPLATE_DIR}/\n`);
  }

  const targetDir = path.join(cwd, '.boss', feature);
  const relativeTarget = path.join('.boss', feature);
  const skipFeatureBootstrap = fs.existsSync(targetDir) && initTemplates && !force;
  if (fs.existsSync(targetDir) && !skipFeatureBootstrap) {
    if (!force) throw new Error(`目录已存在: ${relativeTarget}（使用 --force 覆盖）`);
    fs.rmSync(targetDir, { recursive: true, force: true });
  }

  if (!skipFeatureBootstrap) {
    fs.mkdirSync(path.join(targetDir, '.meta'), { recursive: true });
    const date = today();
    for (const item of PLACEHOLDERS) {
      writePlaceholder(targetDir, feature, date, item);
    }
    initPipeline(feature, { cwd });
    process.stdout.write(`Boss Mode 项目目录初始化完成: ${relativeTarget}\n`);
  } else {
    process.stdout.write(`跳过 feature 初始化，继续保留现有目录内容: ${relativeTarget}\n`);
  }

  process.stdout.write(initTemplates ? '下一步：先修改 .boss/templates/ 中的模板，再运行 /boss 开始开发流程\n' : '下一步：运行 /boss 开始开发流程\n');
  return 0;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exit(main(process.argv.slice(2), { cwd: process.cwd() }));
}
