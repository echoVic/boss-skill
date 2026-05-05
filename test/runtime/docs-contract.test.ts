import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const REPO_ROOT = path.resolve(import.meta.dirname, '..', '..');
const pkg = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, 'package.json'), 'utf8')) as {
  files?: string[];
};
const readme = fs.readFileSync(path.join(REPO_ROOT, 'README.md'), 'utf8');
const contributing = fs.readFileSync(path.join(REPO_ROOT, 'CONTRIBUTING.md'), 'utf8');
const skill = fs.readFileSync(path.join(REPO_ROOT, 'SKILL.md'), 'utf8');
const bossCommand = fs.readFileSync(path.join(REPO_ROOT, 'commands', 'boss.md'), 'utf8');
const hooksConfig = fs.readFileSync(path.join(REPO_ROOT, 'hooks', 'hooks.json'), 'utf8');
const claudeSettings = fs.readFileSync(path.join(REPO_ROOT, '.claude', 'settings.json'), 'utf8');

const techDetection = fs.readFileSync(
  path.join(REPO_ROOT, 'agents', 'shared', 'tech-detection.md'),
  'utf8'
);

describe('tech-detection.md contract', () => {
  it('documents build tool detection step', () => {
    expect(techDetection).toContain('构建工具');
    expect(techDetection).toContain('vite.config');
    expect(techDetection).toContain('webpack.config');
    expect(techDetection).toContain('esbuild');
    expect(techDetection).toContain('Rollup');
  });

  it('documents deploy environment detection step', () => {
    expect(techDetection).toContain('部署环境');
    expect(techDetection).toContain('Dockerfile');
    expect(techDetection).toContain('vercel.json');
    expect(techDetection).toContain('netlify.toml');
    expect(techDetection).toContain('fly.toml');
  });

  it('documents monorepo detection step', () => {
    expect(techDetection).toContain('Monorepo');
    expect(techDetection).toContain('pnpm-workspace.yaml');
    expect(techDetection).toContain('turbo.json');
    expect(techDetection).toContain('nx.json');
    expect(techDetection).toContain('lerna.json');
  });

  it('output format includes build tool, deploy, and monorepo dimensions', () => {
    // These should appear in the output format table
    expect(techDetection).toMatch(/构建工具.*[|｜]/m);
    expect(techDetection).toMatch(/部署环境.*[|｜]/m);
    expect(techDetection).toMatch(/Monorepo.*[|｜]/m);
  });
});

describe('package metadata', () => {
  it('publishes the boss CLI workspace dist and keeps script assets during migration', () => {
    expect(pkg.files).toContain('packages/boss-cli/dist/');
    expect(pkg.files).toContain('scripts/');
  });

  it('documents the src to dist layout', () => {
    expect(readme).toContain('src/');
    expect(readme).toContain('dist/');
    expect(readme).toContain('Vitest');
  });

  it('documents contributor expectations for authored source and generated output', () => {
    expect(contributing).toContain('src/');
    expect(contributing).toContain('dist/');
    expect(contributing).toContain('Vitest');
  });
});

describe('boss natural language command contract', () => {
  it('documents feature slug derivation and constraint-only handling', () => {
    expect(skill).toContain('Feature Slug 归一化');
    expect(skill).toContain('约束类输入');
    expect(skill).toContain('不要创建 `.boss/<feature>/`');
    expect(bossCommand).toContain('自然语言需求会先归一化为 feature slug');
    expect(bossCommand).toContain('约束类输入不会启动新流水线');
  });
});

describe('thin skill CLI contract', () => {
  it('documents boss CLI commands instead of direct runtime/script entrypoints', () => {
    expect(skill).toContain('boss project init');
    expect(skill).toContain('boss runtime init-pipeline');
    expect(skill).toContain('boss artifact prepare');
    expect(skill).toContain('boss packs detect');
    expect(skill).not.toContain('runtime/cli/');
    expect(skill).not.toContain('scripts/prepare-artifact.sh');
    expect(bossCommand).toContain('boss project init');
  });

  it('routes hook config through the boss hooks dispatcher', () => {
    expect(hooksConfig).toContain('boss hooks run');
    expect(hooksConfig).not.toContain('scripts/lib/run-with-flags.js');
    expect(claudeSettings).toContain('boss hooks run');
    expect(claudeSettings).not.toContain('scripts/lib/run-with-flags.js');
  });
});
