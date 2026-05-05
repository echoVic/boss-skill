#!/usr/bin/env node
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PKG_ROOT = path.resolve(__dirname, '..', '..', '..', '..');
const DEFAULT_TEMPLATE_DIR = path.join(PKG_ROOT, 'skill', 'templates');

function showHelp(): void {
  process.stdout.write(
    [
      'Boss Mode - 产物骨架准备',
      '',
      '用法: boss artifact prepare <feature-name> <artifact-name> [template-name]',
      ''
    ].join('\n')
  );
}

function resolveTemplate(cwd: string, templateName: string): string {
  const projectTemplate = path.join(cwd, '.boss', 'templates', templateName);
  if (fs.existsSync(projectTemplate)) return projectTemplate;

  const defaultTemplate = path.join(DEFAULT_TEMPLATE_DIR, templateName);
  if (fs.existsSync(defaultTemplate)) return defaultTemplate;

  throw new Error(`未找到模板文件: ${templateName}`);
}

function renderTemplate(content: string, feature: string): string {
  const replacements: Record<string, string> = {
    '{{FEATURE_NAME}}': feature,
    '{{FEATURE}}': feature,
    '{{PROJECT_NAME}}': feature,
    '{{DATE}}': new Date().toISOString().slice(0, 10),
    '{{VERSION}}': '1.0'
  };
  let rendered = content;
  for (const [token, value] of Object.entries(replacements)) {
    rendered = rendered.split(token).join(value);
  }
  return rendered;
}

export function main(argv: string[] = process.argv.slice(2), { cwd = process.cwd() }: { cwd?: string } = {}): number {
  if (argv.includes('-h') || argv.includes('--help')) {
    showHelp();
    return 0;
  }

  if (argv.length < 2 || argv.length > 3) {
    throw new Error('用法: boss artifact prepare <feature-name> <artifact-name> [template-name]');
  }

  const [feature, artifact, templateArg] = argv as [string, string, string | undefined];
  const targetDir = path.join(cwd, '.boss', feature);
  if (!fs.existsSync(targetDir)) {
    throw new Error(`目标目录不存在: .boss/${feature}，请先执行 boss project init ${feature}`);
  }

  const templateName = templateArg ?? `${artifact}.template`;
  const templatePath = resolveTemplate(cwd, templateName);
  const content = fs.readFileSync(templatePath, 'utf8');
  const targetPath = path.join(targetDir, artifact);
  fs.writeFileSync(targetPath, renderTemplate(content, feature) + '\n', 'utf8');
  process.stdout.write(`已按模板优先级准备产物骨架: ${path.relative(cwd, targetPath)} <- ${path.relative(cwd, templatePath)}\n`);
  return 0;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exit(main(process.argv.slice(2), { cwd: process.cwd() }));
}
