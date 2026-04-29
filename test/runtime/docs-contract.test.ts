import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const REPO_ROOT = path.resolve(import.meta.dirname, '..', '..');
const pkg = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, 'package.json'), 'utf8')) as {
  files?: string[];
};
const readme = fs.readFileSync(path.join(REPO_ROOT, 'README.md'), 'utf8');
const contributing = fs.readFileSync(path.join(REPO_ROOT, 'CONTRIBUTING.md'), 'utf8');

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
  it('publishes dist and keeps runtime/script assets', () => {
    expect(pkg.files).toContain('dist/');
    expect(pkg.files).toContain('runtime/');
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
