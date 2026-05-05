import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const REPO_ROOT = path.resolve(import.meta.dirname, '..', '..');
const pkg = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, 'package.json'), 'utf8')) as {
  files?: string[];
};
const readme = fs.readFileSync(path.join(REPO_ROOT, 'README.md'), 'utf8');
const contributing = fs.readFileSync(path.join(REPO_ROOT, 'CONTRIBUTING.md'), 'utf8');
const skill = fs.readFileSync(path.join(REPO_ROOT, 'skill', 'SKILL.md'), 'utf8');
const bossCommand = fs.readFileSync(path.join(REPO_ROOT, 'skill', 'commands', 'boss.md'), 'utf8');
const hooksConfig = fs.readFileSync(path.join(REPO_ROOT, 'skill', 'hooks', 'hooks.json'), 'utf8');
const claudeSettings = fs.readFileSync(path.join(REPO_ROOT, '.claude', 'settings.json'), 'utf8');
const bmadMethodology = fs.readFileSync(
  path.join(REPO_ROOT, 'skill', 'references', 'bmad-methodology.md'),
  'utf8'
);

const techDetection = fs.readFileSync(
  path.join(REPO_ROOT, 'skill', 'agents', 'shared', 'tech-detection.md'),
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
    expect(pkg.files).toContain('packages/boss-cli/assets/');
    expect(pkg.files).toContain('skill/');
    expect(pkg.files).toContain('scripts/');
    expect(pkg.files).not.toContain('agents/');
    expect(pkg.files).not.toContain('commands/');
    expect(pkg.files).not.toContain('harness/');
    expect(pkg.files).not.toContain('templates/');
    expect(pkg.files).not.toContain('SKILL.md');
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

  it('documents Boss CLI assets instead of a root harness directory', () => {
    const rootHarnessPathPattern = /(?:^|[\s`([{])(?:\.\/)?harness\/(?:plugins|pipeline-packs|artifact-dag|plugin-schema)?/;

    expect(readme).toContain('packages/boss-cli/assets/');
    expect(readme).not.toMatch(rootHarnessPathPattern);
    expect(contributing).toContain('packages/boss-cli/assets/');
    expect(contributing).not.toMatch(rootHarnessPathPattern);
    expect(skill).not.toMatch(rootHarnessPathPattern);
  });

  it('documents .boss project extensions and built-in CLI assets', () => {
    expect(readme).toContain('packages/boss-cli/assets/');
    expect(readme).toContain('.boss/plugins/');
    expect(skill).toContain('.boss/plugins/');
    expect(skill).not.toContain('harness/plugins/');
    expect(contributing).toContain('packages/boss-cli/assets/');
  });
});

describe('boss natural language command contract', () => {
  it('documents feature slug derivation and constraint-only handling', () => {
    expect(skill).toContain('Feature Slug 归一化');
    expect(skill).toContain('约束类输入');
    expect(skill).toContain('不要创建 `.boss/<feature>/`');
    expect(bossCommand).toContain('自然语言需求会先归一化为 feature slug');
    expect(bossCommand).toContain('约束类输入不会启动新流水线');
    expect(bossCommand).toContain('当前 Boss Skill 的 `SKILL.md`');
    expect(bossCommand).not.toContain('skills/boss/SKILL.md');
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
    expect(bmadMethodology).toContain('boss hooks run');
    expect(bmadMethodology).not.toContain('scripts/hooks/run-with-flags.js');
  });
});

describe('agent-friendly CLI documentation contract', () => {
  it('documents the agent-friendly CLI contract', () => {
    for (const doc of [readme, contributing]) {
      expect(doc).toContain('where applicable');
      expect(doc).toContain('--json');
      expect(doc).toContain('non-TTY stdout defaults to JSON');
      expect(doc).toContain('--describe');
      expect(doc).toContain('--dry-run');
      expect(doc).toContain('structured action plan');
      expect(doc).toContain('--json-input=<json|->');
      expect(doc).toContain('--fields=<a,b>');
      expect(doc).toContain('--limit=<n>');
      expect(doc).toContain('--yes');
      expect(doc).toContain('non-interactive');
      expect(doc).toContain('Structured errors');
      for (const field of ['code', 'message', 'input', 'retryable', 'suggestion']) {
        expect(doc).toContain(field);
      }
    }
    expect(contributing).toContain('structured JSON');
  });
});
