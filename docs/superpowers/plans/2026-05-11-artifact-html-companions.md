# Artifact HTML Companions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Generate same-name HTML companions for Boss Markdown artifacts using a fixed template and a constrained schema-shaped render model.

**Architecture:** Agents keep writing Markdown only. Runtime code converts Markdown into an `artifact-html` render model, interpolates `artifact.html.template`, and writes companions from `record-artifact` and Markdown `generate-summary` flows.

**Tech Stack:** TypeScript, Node.js standard library, Vitest, existing Boss CLI runtime/projector APIs.

---

## File Structure

- Create `skill/templates/artifact.html.template`
  - Bundled HTML page shell and styles.
  - Uses `{{FEATURE}}`, `{{TITLE}}`, `{{SOURCE_ARTIFACT}}`, `{{GENERATED_AT}}`, `{{SUMMARY_HTML}}`, `{{TOC_HTML}}`, and `{{BODY_HTML}}`.
- Create `packages/boss-cli/src/runtime/schema/artifact-html-schema.json`
  - JSON Schema for the intermediate render model.
- Create `packages/boss-cli/src/runtime/report/render-artifact-html.ts`
  - Converts Markdown to a bounded model and renders the template.
  - Exports `buildArtifactHtmlModel()`, `renderArtifactHtml()`, and `writeArtifactHtmlCompanion()`.
- Modify `packages/boss-cli/src/commands/runtime/record-artifact.ts`
  - After successful Markdown artifact record, writes and records the `.html` companion.
- Modify `packages/boss-cli/src/commands/runtime/generate-summary.ts`
  - For Markdown output only, writes `summary-report.md` and `summary-report.html`.
- Modify `test/runtime/report-runtime.test.ts`
  - Covers CLI integration for `record-artifact` and `generate-summary`.
- Modify `test/runtime/schema-contract.test.ts`
  - Covers artifact HTML schema contract.
- Modify `test/cli/contract.test.ts` or existing project-init coverage if needed
  - Covers `project init --template` copying `artifact.html.template`.
- Modify `skill/references/artifact-guide.md`
  - Documents Markdown as canonical and HTML as runtime companion.
- Modify `skill/SKILL.md`
  - Documents generated `.html` companions in output structure and runtime flow.

---

### Task 1: Add Schema and Template Contracts

**Files:**
- Create: `packages/boss-cli/src/runtime/schema/artifact-html-schema.json`
- Create: `skill/templates/artifact.html.template`
- Modify: `test/runtime/schema-contract.test.ts`

- [ ] **Step 1: Write the failing schema/template contract test**

Add this test to `test/runtime/schema-contract.test.ts`:

```ts
  it('artifact html schema constrains the runtime render model', () => {
    const schema = loadJson('packages/boss-cli/src/runtime/schema/artifact-html-schema.json');

    expect(schema.properties.artifact.const).toBe('artifact-html');
    expect(schema.additionalProperties).toBe(false);
    expect(schema.required.slice().sort()).toEqual([
      'artifact',
      'bodyHtml',
      'feature',
      'generatedAt',
      'schemaVersion',
      'sourceArtifact',
      'summaryItems',
      'title',
      'toc'
    ]);
    expect(schema.properties.sourceArtifact.pattern).toBe('\\\\.md$');
    expect(schema.properties.toc.items.additionalProperties).toBe(false);
    expect(schema.properties.toc.items.properties.level.minimum).toBe(1);
    expect(schema.properties.toc.items.properties.level.maximum).toBe(6);
  });
```

- [ ] **Step 2: Run the focused test and verify RED**

Run:

```bash
npm test -- test/runtime/schema-contract.test.ts
```

Expected: FAIL with `ENOENT` for `artifact-html-schema.json`.

- [ ] **Step 3: Add the schema**

Create `packages/boss-cli/src/runtime/schema/artifact-html-schema.json`:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "title": "Boss Artifact HTML Render Model",
  "type": "object",
  "additionalProperties": false,
  "required": [
    "schemaVersion",
    "artifact",
    "feature",
    "sourceArtifact",
    "title",
    "generatedAt",
    "summaryItems",
    "toc",
    "bodyHtml"
  ],
  "properties": {
    "schemaVersion": { "type": "string", "minLength": 1 },
    "artifact": { "const": "artifact-html" },
    "feature": { "type": "string", "minLength": 1 },
    "sourceArtifact": { "type": "string", "pattern": "\\\\.md$" },
    "title": { "type": "string", "minLength": 1 },
    "generatedAt": { "type": "string", "minLength": 1 },
    "summaryItems": {
      "type": "array",
      "items": { "type": "string" }
    },
    "toc": {
      "type": "array",
      "items": {
        "type": "object",
        "additionalProperties": false,
        "required": ["id", "level", "text"],
        "properties": {
          "id": { "type": "string", "minLength": 1 },
          "level": { "type": "integer", "minimum": 1, "maximum": 6 },
          "text": { "type": "string", "minLength": 1 }
        }
      }
    },
    "bodyHtml": { "type": "string", "minLength": 1 }
  }
}
```

- [ ] **Step 4: Add the bundled HTML template**

Create `skill/templates/artifact.html.template`:

```html
<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>{{TITLE}} - {{FEATURE}}</title>
  <style>
    :root {
      color-scheme: light;
      --bg: #f7f7f4;
      --paper: #ffffff;
      --ink: #202427;
      --muted: #687076;
      --line: #d7dadd;
      --accent: #245c73;
      --soft: #eef5f7;
      --code: #182026;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      color: var(--ink);
      background: var(--bg);
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif;
      line-height: 1.65;
    }
    .layout {
      display: grid;
      grid-template-columns: minmax(0, 260px) minmax(0, 1fr);
      gap: 28px;
      width: min(1180px, calc(100vw - 32px));
      margin: 0 auto;
      padding: 28px 0 48px;
    }
    aside {
      position: sticky;
      top: 20px;
      align-self: start;
      border: 1px solid var(--line);
      background: var(--paper);
      border-radius: 8px;
      padding: 16px;
    }
    main {
      border: 1px solid var(--line);
      background: var(--paper);
      border-radius: 8px;
      padding: 32px;
      min-width: 0;
    }
    h1, h2, h3, h4, h5, h6 { line-height: 1.25; margin: 1.4em 0 0.55em; }
    h1 { margin-top: 0; font-size: 2rem; }
    h2 { border-bottom: 1px solid var(--line); padding-bottom: 0.3em; }
    p, ul, ol, table, pre, blockquote { margin: 0 0 1em; }
    a { color: var(--accent); text-decoration: none; }
    a:hover { text-decoration: underline; }
    code {
      border-radius: 4px;
      background: var(--soft);
      padding: 0.1em 0.35em;
      font-family: "SFMono-Regular", Consolas, monospace;
      font-size: 0.92em;
    }
    pre {
      overflow-x: auto;
      border-radius: 8px;
      background: var(--code);
      color: #f3f7f8;
      padding: 16px;
    }
    pre code { background: transparent; color: inherit; padding: 0; }
    table { width: 100%; border-collapse: collapse; overflow-x: auto; display: block; }
    th, td { border: 1px solid var(--line); padding: 8px 10px; text-align: left; vertical-align: top; }
    th { background: var(--soft); }
    blockquote { border-left: 4px solid var(--accent); margin-left: 0; padding: 8px 14px; color: var(--muted); background: var(--soft); }
    .meta { color: var(--muted); font-size: 0.92rem; margin-bottom: 24px; }
    .summary { border: 1px solid var(--line); background: var(--soft); border-radius: 8px; padding: 16px; margin-bottom: 24px; }
    .toc-title { font-weight: 700; margin-bottom: 8px; }
    .toc ul, .summary ul { padding-left: 20px; }
    @media (max-width: 860px) {
      .layout { grid-template-columns: 1fr; }
      aside { position: static; }
      main { padding: 22px; }
    }
  </style>
</head>
<body>
  <div class="layout">
    <aside>
      <div class="toc-title">目录</div>
      {{TOC_HTML}}
    </aside>
    <main>
      <h1>{{TITLE}}</h1>
      <div class="meta">
        <div>Feature: {{FEATURE}}</div>
        <div>Source: {{SOURCE_ARTIFACT}}</div>
        <div>Generated: {{GENERATED_AT}}</div>
      </div>
      <section class="summary">
        <h2>摘要</h2>
        {{SUMMARY_HTML}}
      </section>
      {{BODY_HTML}}
    </main>
  </div>
</body>
</html>
```

- [ ] **Step 5: Run the focused test and verify GREEN**

Run:

```bash
npm test -- test/runtime/schema-contract.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/boss-cli/src/runtime/schema/artifact-html-schema.json skill/templates/artifact.html.template test/runtime/schema-contract.test.ts
git commit -m "feat: add artifact html schema and template"
```

---

### Task 2: Implement the Markdown Artifact HTML Renderer

**Files:**
- Create: `test/runtime/artifact-html-renderer.test.ts`
- Create: `packages/boss-cli/src/runtime/report/render-artifact-html.ts`

- [ ] **Step 1: Write the failing renderer tests**

Create `test/runtime/artifact-html-renderer.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import {
  buildArtifactHtmlModel,
  renderArtifactHtml
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
});
```

- [ ] **Step 2: Run the renderer tests and verify RED**

Run:

```bash
npm test -- test/runtime/artifact-html-renderer.test.ts
```

Expected: FAIL because `render-artifact-html.ts` does not exist.

- [ ] **Step 3: Add the renderer implementation**

Create `packages/boss-cli/src/runtime/report/render-artifact-html.ts` with these exports:

```ts
import * as fs from 'node:fs';
import * as path from 'node:path';

import { packageRootFromImportMeta } from '../../infrastructure/paths.js';

export interface ArtifactHtmlTocItem {
  id: string;
  level: number;
  text: string;
}

export interface ArtifactHtmlModel {
  schemaVersion: '1.0.0';
  artifact: 'artifact-html';
  feature: string;
  sourceArtifact: string;
  title: string;
  generatedAt: string;
  summaryItems: string[];
  toc: ArtifactHtmlTocItem[];
  bodyHtml: string;
}

export interface ArtifactHtmlInput {
  cwd?: string;
  feature: string;
  sourceArtifact: string;
  markdown: string;
  generatedAt?: string;
}
```

Implementation details:

```ts
const PKG_ROOT = packageRootFromImportMeta(import.meta.url, 5);
const DEFAULT_TEMPLATE = path.join(PKG_ROOT, 'skill', 'templates', 'artifact.html.template');

function escapeHtml(value: unknown): string {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function inlineMarkdown(text: string): string {
  const escaped = escapeHtml(text);
  return escaped
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
}

function slugifyHeading(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '') || 'section';
}
```

Add a simple line-based Markdown renderer that:

- Tracks fenced code blocks and emits `<pre><code class="language-${lang}">`.
- Converts ATX headings to `<hN id="...">`.
- Converts pipe table blocks to `<table><thead>...`.
- Converts consecutive `- ` lines to `<ul>`.
- Converts consecutive `1. ` lines to `<ol>`.
- Converts `> ` lines to `<blockquote>`.
- Converts `---` to `<hr>`.
- Converts other non-empty lines to paragraphs.

Export:

```ts
export function buildArtifactHtmlModel(input: ArtifactHtmlInput): ArtifactHtmlModel {
  if (!input.feature) throw new Error('缺少 feature 参数');
  if (!input.sourceArtifact.endsWith('.md')) throw new Error('sourceArtifact must end with .md');

  const headings: ArtifactHtmlTocItem[] = [];
  const title =
    input.markdown.match(/^#\s+(.+)$/m)?.[1]?.trim() ||
    input.sourceArtifact.replace(/\.md$/, '');
  const summaryItems = extractSummaryItems(input.markdown);
  const bodyHtml = renderMarkdownBody(input.markdown, headings);

  return {
    schemaVersion: '1.0.0',
    artifact: 'artifact-html',
    feature: input.feature,
    sourceArtifact: input.sourceArtifact,
    title,
    generatedAt: input.generatedAt ?? new Date().toISOString(),
    summaryItems,
    toc: headings,
    bodyHtml
  };
}

export function renderArtifactHtml(input: ArtifactHtmlInput): string {
  const cwd = input.cwd ?? process.cwd();
  const model = buildArtifactHtmlModel(input);
  const template = readTemplate(cwd);
  const summaryHtml =
    model.summaryItems.length > 0
      ? `<ul>${model.summaryItems.map((item) => `<li>${inlineMarkdown(item)}</li>`).join('')}</ul>`
      : '<p>暂无摘要。</p>';
  const tocHtml =
    model.toc.length > 0
      ? `<ul>${model.toc.map((item) => `<li class="toc-level-${item.level}"><a href="#${escapeHtml(item.id)}">${escapeHtml(item.text)}</a></li>`).join('')}</ul>`
      : '<p>暂无目录。</p>';

  return template
    .split('{{FEATURE}}').join(escapeHtml(model.feature))
    .split('{{TITLE}}').join(escapeHtml(model.title))
    .split('{{SOURCE_ARTIFACT}}').join(escapeHtml(model.sourceArtifact))
    .split('{{GENERATED_AT}}').join(escapeHtml(model.generatedAt))
    .split('{{SUMMARY_HTML}}').join(summaryHtml)
    .split('{{TOC_HTML}}').join(tocHtml)
    .split('{{BODY_HTML}}').join(model.bodyHtml);
}

export function writeArtifactHtmlCompanion(input: ArtifactHtmlInput & { featureDir?: string }): string {
  const cwd = input.cwd ?? process.cwd();
  const featureDir = input.featureDir ?? path.join(cwd, '.boss', input.feature);
  const htmlArtifact = input.sourceArtifact.replace(/\.md$/, '.html');
  const outputPath = path.join(featureDir, htmlArtifact);
  fs.writeFileSync(outputPath, renderArtifactHtml(input), 'utf8');
  return htmlArtifact;
}
```

Keep helper functions private except where tests require exports. Prefer private helpers.

- [ ] **Step 4: Run the renderer tests and verify GREEN**

Run:

```bash
npm test -- test/runtime/artifact-html-renderer.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/boss-cli/src/runtime/report/render-artifact-html.ts test/runtime/artifact-html-renderer.test.ts
git commit -m "feat: render markdown artifacts as html"
```

---

### Task 3: Generate HTML Companions from record-artifact

**Files:**
- Modify: `test/runtime/report-runtime.test.ts`
- Modify: `packages/boss-cli/src/commands/runtime/record-artifact.ts`

- [ ] **Step 1: Write the failing CLI integration test**

In `test/runtime/report-runtime.test.ts`, add a test after the JSON stdout test:

```ts
  it('record-artifact writes and records html companions for markdown artifacts', () => {
    const prdPath = path.join(tmpDir, '.boss', 'test-feat', 'prd.md');
    fs.writeFileSync(
      prdPath,
      ['# 产品需求文档', '', '## 摘要', '- 安全展示 `<script>x</script>`', '', '| 字段 | 说明 |', '|------|------|', '| id | 标识 |'].join('\n'),
      'utf8'
    );

    const result = runRuntimeCommand('record-artifact', ['test-feat', 'prd.md', '1']);

    expect(result.status).toBe(0);
    expect(result.stderr).toBe('');
    const payload = JSON.parse(result.stdout) as {
      artifact: string;
      artifacts: string[];
      htmlArtifact?: string;
      htmlPath?: string;
    };
    expect(payload.artifact).toBe('prd.md');
    expect(payload.htmlArtifact).toBe('prd.html');
    expect(payload.htmlPath).toBe('.boss/test-feat/prd.html');
    expect(payload.artifacts).toContain('prd.md');
    expect(payload.artifacts).toContain('prd.html');

    const htmlPath = path.join(tmpDir, '.boss', 'test-feat', 'prd.html');
    expect(fs.existsSync(htmlPath)).toBe(true);
    const html = fs.readFileSync(htmlPath, 'utf8');
    expect(html).toMatch(/<!doctype html>/i);
    expect(html).toContain('产品需求文档 - test-feat');
    expect(html).toContain('&lt;script&gt;x&lt;/script&gt;');
    expect(html).toContain('<table>');
  });
```

- [ ] **Step 2: Run the focused test and verify RED**

Run:

```bash
npm test -- test/runtime/report-runtime.test.ts -t "record-artifact writes and records html companions"
```

Expected: FAIL because `htmlArtifact` is undefined and `prd.html` is not written.

- [ ] **Step 3: Modify record-artifact**

In `packages/boss-cli/src/commands/runtime/record-artifact.ts`:

Add imports:

```ts
import * as fs from 'node:fs';
import { writeArtifactHtmlCompanion } from '../../runtime/report/render-artifact-html.js';
```

After the first `recordArtifact(...)` call, add:

```ts
    let execution = recordArtifact(input.feature, input.artifact, Number(input.stage), { cwd });
    let htmlArtifact: string | undefined;
    let htmlPath: string | undefined;

    if (input.artifact.endsWith('.md')) {
      const markdownPath = path.join(cwd, '.boss', input.feature, input.artifact);
      if (!fs.existsSync(markdownPath)) {
        throw new Error(`未找到 Markdown 产物: ${path.relative(cwd, markdownPath)}`);
      }
      const markdown = fs.readFileSync(markdownPath, 'utf8');
      htmlArtifact = writeArtifactHtmlCompanion({
        cwd,
        feature: input.feature,
        sourceArtifact: input.artifact,
        markdown
      });
      htmlPath = path.posix.join('.boss', input.feature, htmlArtifact);
      execution = recordArtifact(input.feature, htmlArtifact, Number(input.stage), { cwd });
    }
```

Then include `htmlArtifact` and `htmlPath` in the payload:

```ts
    const payload = {
      feature: input.feature,
      artifact: input.artifact,
      stage: Number(input.stage),
      artifacts,
      previewCommand,
      ...(htmlArtifact ? { htmlArtifact, htmlPath } : {})
    };
```

Ensure `artifacts` is read after optional HTML companion recording.

- [ ] **Step 4: Run the focused test and verify GREEN**

Run:

```bash
npm test -- test/runtime/report-runtime.test.ts -t "record-artifact writes and records html companions"
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/boss-cli/src/commands/runtime/record-artifact.ts test/runtime/report-runtime.test.ts
git commit -m "feat: record markdown artifact html companions"
```

---

### Task 4: Generate summary-report.html for Markdown Summaries

**Files:**
- Modify: `test/runtime/report-runtime.test.ts`
- Modify: `packages/boss-cli/src/commands/runtime/generate-summary.ts`

- [ ] **Step 1: Write the failing summary generation tests**

In `test/runtime/report-runtime.test.ts`, update `generate-summary runtime CLI writes markdown/json report files`:

```ts
    expect(mdPayload).toEqual({
      feature: 'test-feat',
      outputPath: '.boss/test-feat/summary-report.md',
      format: 'markdown',
      htmlOutputPath: '.boss/test-feat/summary-report.html'
    });
    const summaryHtmlPath = path.join(tmpDir, '.boss', 'test-feat', 'summary-report.html');
    expect(fs.existsSync(summaryHtmlPath)).toBe(true);
    expect(fs.readFileSync(summaryHtmlPath, 'utf8')).toContain('流水线执行报告 - test-feat');
```

Update the dry-run test for Markdown summary:

```ts
    const summaryMarkdownDryRun = runRuntimeCommand('generate-summary', ['test-feat', '--dry-run']);
    expect(summaryMarkdownDryRun.status).toBe(0);
    const summaryMarkdownPayload = JSON.parse(summaryMarkdownDryRun.stdout) as {
      actions: Array<{ type: string; path: string; format: string }>;
    };
    expect(summaryMarkdownPayload.actions).toEqual([
      { type: 'write_file', path: '.boss/test-feat/summary-report.md', format: 'markdown' },
      { type: 'write_file', path: '.boss/test-feat/summary-report.html', format: 'html' }
    ]);
```

Keep the JSON dry-run expectation unchanged.

- [ ] **Step 2: Run the focused tests and verify RED**

Run:

```bash
npm test -- test/runtime/report-runtime.test.ts -t "generate-summary runtime CLI writes markdown/json report files|report writer runtime CLIs support structured dry-run"
```

Expected: FAIL because `summary-report.html` is not written and dry-run only lists one Markdown action.

- [ ] **Step 3: Modify generate-summary**

In `packages/boss-cli/src/commands/runtime/generate-summary.ts`:

Add import:

```ts
import { writeArtifactHtmlCompanion } from '../../runtime/report/render-artifact-html.js';
```

Split output variables:

```ts
  const outputFile = parsed.json ? 'summary-report.json' : 'summary-report.md';
  const htmlOutputFile = 'summary-report.html';
  const relativeOutputPath = path.posix.join('.boss', parsed.feature, outputFile);
  const relativeHtmlOutputPath = path.posix.join('.boss', parsed.feature, htmlOutputFile);
  const outputPath = path.join(cwd, '.boss', parsed.feature, outputFile);
```

In dry-run when `!parsed.json`, include both write actions:

```ts
          actions: parsed.json
            ? [{ type: 'write_file', path: relativeOutputPath, format }]
            : [
                { type: 'write_file', path: relativeOutputPath, format },
                { type: 'write_file', path: relativeHtmlOutputPath, format: 'html' }
              ],
```

After writing Markdown, write the companion:

```ts
    fs.writeFileSync(outputPath, rendered, 'utf8');
    let htmlOutputPath: string | undefined;
    if (!parsed.json) {
      const htmlArtifact = writeArtifactHtmlCompanion({
        cwd,
        feature: parsed.feature,
        sourceArtifact: 'summary-report.md',
        markdown: rendered
      });
      htmlOutputPath = path.posix.join('.boss', parsed.feature, htmlArtifact);
    }
```

Include `htmlOutputPath` only for Markdown payloads:

```ts
      { feature: parsed.feature, outputPath: relativeOutputPath, format, ...(htmlOutputPath ? { htmlOutputPath } : {}) },
```

- [ ] **Step 4: Run the focused tests and verify GREEN**

Run:

```bash
npm test -- test/runtime/report-runtime.test.ts -t "generate-summary runtime CLI writes markdown/json report files|report writer runtime CLIs support structured dry-run"
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/boss-cli/src/commands/runtime/generate-summary.ts test/runtime/report-runtime.test.ts
git commit -m "feat: generate html summary companions"
```

---

### Task 5: Verify project template initialization copies the HTML template

**Files:**
- Modify: `test/cli/contract.test.ts` or the existing test file that covers `boss project init --template`

- [ ] **Step 1: Locate project init template test**

Run:

```bash
rg -n "project init|--template|templatesPath|copy_project_templates" test
```

Use the existing project-init test file found by the search.

- [ ] **Step 2: Write the failing assertion**

In the test that runs `boss project init <feature> --template`, add:

```ts
expect(fs.existsSync(path.join(tmpDir, '.boss', 'templates', 'artifact.html.template'))).toBe(true);
```

If there is no execution test, add one using the local CLI helper style in that file.

- [ ] **Step 3: Run the focused test**

Run the relevant file, for example:

```bash
npm test -- test/cli/contract.test.ts -t "template"
```

Expected: PASS after Task 1 because `copyTemplates()` already copies every `*.template` file from `skill/templates/`.

- [ ] **Step 4: Commit if a test file changed**

```bash
git add test/cli/contract.test.ts
git commit -m "test: cover artifact html template initialization"
```

---

### Task 6: Update Boss Skill Documentation

**Files:**
- Modify: `skill/references/artifact-guide.md`
- Modify: `skill/SKILL.md`

- [ ] **Step 1: Update artifact guide**

In `skill/references/artifact-guide.md`, add after the Markdown summary rule:

```md
Markdown 产物是权威内容源。保存并记录 Markdown 产物后，Boss runtime 会自动生成同名 HTML companion（例如 `prd.md` → `prd.html`）。Agent 不需要、也不应该手写整页 HTML；HTML 页面由 `artifact.html.template` 和 runtime renderer 统一生成。

HTML 模板查找优先级：
1. 项目级模板：`.boss/templates/artifact.html.template`
2. Skill 内置模板：`templates/artifact.html.template`
```

Update the artifact table so Markdown rows mention generated companions:

```md
| 阶段 1 | `prd.md`（自动生成 `prd.html`） | `templates/prd.md.template` |
```

- [ ] **Step 2: Update skill output structure**

In `skill/SKILL.md`, update the artifact directory block:

```md
├── prd.md / prd.html
├── architecture.md / architecture.html
├── ui-spec.md / ui-spec.html
├── tech-review.md / tech-review.html
├── tasks.md / tasks.html
├── qa-report.md / qa-report.html
├── deploy-report.md / deploy-report.html
├── summary-report.md / summary-report.html
```

Update D.6:

```md
D.6 标记产物完成：调用 `boss runtime record-artifact <feature> <artifact-name> <N>` 记录产物完成；若产物为 Markdown，runtime 会同步生成并记录同名 HTML companion。
```

Update F.1:

```md
F.1 调用 `boss runtime generate-summary <feature>` 生成最终流水线 Markdown 报告与 HTML companion。
```

- [ ] **Step 3: Run docs contract tests**

Run:

```bash
npm test -- test/runtime/docs-contract.test.ts
```

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add skill/references/artifact-guide.md skill/SKILL.md
git commit -m "docs: document artifact html companions"
```

---

### Task 7: Full Verification

**Files:**
- No file edits unless verification finds a bug.

- [ ] **Step 1: Run typecheck**

Run:

```bash
npm run typecheck
```

Expected: PASS.

- [ ] **Step 2: Run full test suite**

Run:

```bash
npm test
```

Expected: PASS.

- [ ] **Step 3: Run build**

Run:

```bash
npm run build
```

Expected: PASS.

- [ ] **Step 4: Inspect final diff**

Run:

```bash
git status --short
git diff --stat
```

Expected: only intended files changed.

- [ ] **Step 5: Commit final fixes if any**

If verification required fixes:

```bash
git add <fixed-files>
git commit -m "fix: stabilize artifact html companions"
```
