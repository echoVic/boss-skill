import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import {
  buildArtifactHtmlModel,
  renderArtifactHtml,
  writeArtifactHtmlCompanion
} from '../../packages/boss-cli/src/runtime/report/render-artifact-html.js';

describe('artifact html renderer', () => {
  const markdown = [
    '# 产品需求文档',
    '',
    '## 摘要',
    '- 支持用户创建订单',
    '- 阻止 `<script>alert(1)</script>` 注入',
    '',
    '## 范围',
    '',
    '正文包含 **重点** 和 `inlineCode`。',
    '',
    '| 字段 | 说明 |',
    '|------|------|',
    '| id | 订单 ID |',
    '',
    '```ts',
    'const answer = 42;',
    '```'
  ].join('\n');

  it('builds a bounded render model from markdown', () => {
    const model = buildArtifactHtmlModel({
      feature: 'checkout-flow',
      sourceArtifact: 'prd.md',
      markdown,
      generatedAt: '2026-05-11T10:00:00.000Z'
    });

    expect(model).toMatchObject({
      schemaVersion: '1.0.0',
      artifact: 'artifact-html',
      feature: 'checkout-flow',
      sourceArtifact: 'prd.md',
      title: '产品需求文档',
      generatedAt: '2026-05-11T10:00:00.000Z',
      summaryItems: ['支持用户创建订单', '阻止 `<script>alert(1)</script>` 注入']
    });
    expect(model.toc.map((item) => item.text)).toEqual(['产品需求文档', '摘要', '范围']);
    expect(model.bodyHtml).toContain('<h1 id="产品需求文档">产品需求文档</h1>');
    expect(model.bodyHtml).toContain('<strong>重点</strong>');
    expect(model.bodyHtml).toContain('<code>inlineCode</code>');
    expect(model.bodyHtml).toContain('<table>');
    expect(model.bodyHtml).toContain('<pre><code class="language-ts">const answer = 42;');
    expect(model.bodyHtml).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
    expect(model.bodyHtml).not.toContain('<script>alert(1)</script>');
  });

  it('renders the bundled template and supports project template override', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'boss-artifact-html-'));
    try {
      const html = renderArtifactHtml({
        cwd: tmpDir,
        feature: 'checkout-flow',
        sourceArtifact: 'prd.md',
        markdown,
        generatedAt: '2026-05-11T10:00:00.000Z'
      });
      expect(html).toMatch(/<!doctype html>/i);
      expect(html).toContain('产品需求文档 - checkout-flow');
      expect(html).toContain('Source: prd.md');
      expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');

      const templateDir = path.join(tmpDir, '.boss', 'templates');
      fs.mkdirSync(templateDir, { recursive: true });
      fs.writeFileSync(
        path.join(templateDir, 'artifact.html.template'),
        '<article>{{TITLE}}|{{FEATURE}}|{{SOURCE_ARTIFACT}}|{{SUMMARY_HTML}}|{{BODY_HTML}}</article>',
        'utf8'
      );
      const overridden = renderArtifactHtml({
        cwd: tmpDir,
        feature: 'checkout-flow',
        sourceArtifact: 'prd.md',
        markdown,
        generatedAt: '2026-05-11T10:00:00.000Z'
      });
      expect(overridden.startsWith('<article>产品需求文档|checkout-flow|prd.md|')).toBe(true);
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('writes html companions directly under the feature directory', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'boss-artifact-html-'));
    try {
      const artifact = writeArtifactHtmlCompanion({
        cwd: tmpDir,
        feature: 'checkout-flow',
        sourceArtifact: 'prd.md',
        markdown,
        generatedAt: '2026-05-11T10:00:00.000Z'
      });

      expect(artifact).toBe('prd.html');
      expect(fs.existsSync(path.join(tmpDir, '.boss', 'checkout-flow', 'prd.html'))).toBe(true);
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('rejects path-like source artifacts without writing outside the feature directory', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'boss-artifact-html-'));
    try {
      expect(() =>
        writeArtifactHtmlCompanion({
          cwd: tmpDir,
          feature: 'checkout-flow',
          sourceArtifact: '../outside.md',
          markdown,
          generatedAt: '2026-05-11T10:00:00.000Z'
        })
      ).toThrow(/sourceArtifact/);
      expect(fs.existsSync(path.join(tmpDir, '.boss', 'outside.html'))).toBe(false);
      expect(fs.existsSync(path.join(tmpDir, 'outside.html'))).toBe(false);

      expect(() =>
        buildArtifactHtmlModel({
          feature: 'checkout-flow',
          sourceArtifact: 'docs/prd.md',
          markdown,
          generatedAt: '2026-05-11T10:00:00.000Z'
        })
      ).toThrow(/sourceArtifact/);
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('rejects default feature directories that escape cwd boss storage', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'boss-artifact-html-'));
    try {
      expect(() =>
        writeArtifactHtmlCompanion({
          cwd: tmpDir,
          feature: '../escape',
          sourceArtifact: 'prd.md',
          markdown,
          generatedAt: '2026-05-11T10:00:00.000Z'
        })
      ).toThrow(/featureDir|feature/);
      expect(fs.existsSync(path.join(tmpDir, 'escape', 'prd.html'))).toBe(false);
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('keeps bold markdown from rendering inside inline code spans', () => {
    const model = buildArtifactHtmlModel({
      feature: 'checkout-flow',
      sourceArtifact: 'prd.md',
      markdown: '代码 `**literal** <b>x</b>` and **bold**',
      generatedAt: '2026-05-11T10:00:00.000Z'
    });

    expect(model.bodyHtml).toContain('<code>**literal** &lt;b&gt;x&lt;/b&gt;</code>');
    expect(model.bodyHtml).toContain('<strong>bold</strong>');
    expect(model.bodyHtml).not.toContain('<code><strong>');
  });
});
