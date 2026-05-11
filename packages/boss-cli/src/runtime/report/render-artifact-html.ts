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

const PKG_ROOT = packageRootFromImportMeta(import.meta.url, 5);
const DEFAULT_TEMPLATE = path.join(PKG_ROOT, 'skill', 'templates', 'artifact.html.template');

function escapeHtml(value: unknown): string {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function escapeAttribute(value: unknown): string {
  return escapeHtml(value).replace(/'/g, '&#39;');
}

function inlineMarkdown(text: string): string {
  const escaped = escapeHtml(text);
  return escaped
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
}

function slugifyHeading(text: string): string {
  return (
    text
      .trim()
      .toLowerCase()
      .replace(/[^\p{L}\p{N}]+/gu, '-')
      .replace(/^-+|-+$/g, '') || 'section'
  );
}

function uniqueSlug(text: string, seen: Map<string, number>): string {
  const slug = slugifyHeading(text);
  const count = seen.get(slug) ?? 0;
  seen.set(slug, count + 1);
  return count === 0 ? slug : `${slug}-${count + 1}`;
}

function extractHeading(line: string): { level: number; text: string } | null {
  const match = /^(#{1,6})\s+(.+?)\s*#*\s*$/.exec(line);
  if (!match?.[1] || !match[2]) {
    return null;
  }
  return { level: match[1].length, text: match[2].trim() };
}

function isFence(line: string): boolean {
  return /^```/.test(line.trim());
}

function isHorizontalRule(line: string): boolean {
  return /^(?:-{3,}|\*{3,}|_{3,})$/.test(line.trim());
}

function isUnorderedListItem(line: string): boolean {
  return /^\s*[-*+]\s+/.test(line);
}

function isOrderedListItem(line: string): boolean {
  return /^\s*\d+[.)]\s+/.test(line);
}

function isBlockquote(line: string): boolean {
  return /^\s*>\s?/.test(line);
}

function isPipeTableSeparator(line: string): boolean {
  const cells = splitPipeCells(line);
  return cells.length > 0 && cells.every((cell) => /^:?-{3,}:?$/.test(cell.trim()));
}

function isPipeTableStart(lines: string[], index: number): boolean {
  const line = lines[index];
  const next = lines[index + 1];
  return Boolean(line?.includes('|') && next && isPipeTableSeparator(next));
}

function splitPipeCells(line: string): string[] {
  const trimmed = line.trim();
  const withoutStart = trimmed.startsWith('|') ? trimmed.slice(1) : trimmed;
  const withoutEnd = withoutStart.endsWith('|') ? withoutStart.slice(0, -1) : withoutStart;
  return withoutEnd.split('|').map((cell) => cell.trim());
}

function renderTable(lines: string[], start: number): { html: string; nextIndex: number } {
  const headers = splitPipeCells(lines[start] ?? '');
  const rows: string[][] = [];
  let index = start + 2;

  while (index < lines.length) {
    const line = lines[index];
    if (!line?.trim() || !line.includes('|')) {
      break;
    }
    rows.push(splitPipeCells(line));
    index += 1;
  }

  const headerHtml = headers.map((cell) => `<th>${inlineMarkdown(cell)}</th>`).join('');
  const rowHtml = rows
    .map((row) => `<tr>${row.map((cell) => `<td>${inlineMarkdown(cell)}</td>`).join('')}</tr>`)
    .join('');

  return {
    html: `<table><thead><tr>${headerHtml}</tr></thead><tbody>${rowHtml}</tbody></table>`,
    nextIndex: index
  };
}

function renderList(lines: string[], start: number, ordered: boolean): { html: string; nextIndex: number } {
  const tag = ordered ? 'ol' : 'ul';
  const matcher = ordered ? isOrderedListItem : isUnorderedListItem;
  const marker = ordered ? /^\s*\d+[.)]\s+/ : /^\s*[-*+]\s+/;
  const items: string[] = [];
  let index = start;

  while (index < lines.length) {
    const line = lines[index] ?? '';
    if (!matcher(line)) {
      break;
    }
    items.push(line.replace(marker, ''));
    index += 1;
  }

  return {
    html: `<${tag}>${items.map((item) => `<li>${inlineMarkdown(item)}</li>`).join('')}</${tag}>`,
    nextIndex: index
  };
}

function renderBlockquote(lines: string[], start: number): { html: string; nextIndex: number } {
  const quoteLines: string[] = [];
  let index = start;

  while (index < lines.length) {
    const line = lines[index] ?? '';
    if (!isBlockquote(line)) {
      break;
    }
    quoteLines.push(line.replace(/^\s*>\s?/, ''));
    index += 1;
  }

  return {
    html: `<blockquote>${quoteLines.map((line) => `<p>${inlineMarkdown(line)}</p>`).join('')}</blockquote>`,
    nextIndex: index
  };
}

function renderCodeBlock(lines: string[], start: number): { html: string; nextIndex: number } {
  const fence = lines[start] ?? '';
  const language = fence.trim().slice(3).trim().split(/\s+/)[0] ?? '';
  const codeLines: string[] = [];
  let index = start + 1;

  while (index < lines.length) {
    const line = lines[index] ?? '';
    if (isFence(line)) {
      index += 1;
      break;
    }
    codeLines.push(line);
    index += 1;
  }

  const className = language ? ` class="language-${escapeAttribute(language)}"` : '';
  return {
    html: `<pre><code${className}>${escapeHtml(codeLines.join('\n'))}</code></pre>`,
    nextIndex: index
  };
}

function isBlockStart(lines: string[], index: number): boolean {
  const line = lines[index] ?? '';
  return Boolean(
    !line.trim() ||
      isFence(line) ||
      extractHeading(line) ||
      isPipeTableStart(lines, index) ||
      isUnorderedListItem(line) ||
      isOrderedListItem(line) ||
      isBlockquote(line) ||
      isHorizontalRule(line)
  );
}

function renderParagraph(lines: string[], start: number): { html: string; nextIndex: number } {
  const paragraphLines: string[] = [];
  let index = start;

  while (index < lines.length && !isBlockStart(lines, index)) {
    paragraphLines.push((lines[index] ?? '').trim());
    index += 1;
  }

  return {
    html: `<p>${inlineMarkdown(paragraphLines.join(' '))}</p>`,
    nextIndex: index
  };
}

function renderMarkdownBody(markdown: string, headings: ArtifactHtmlTocItem[]): string {
  const lines = markdown.replace(/\r\n/g, '\n').split('\n');
  const seenHeadings = new Map<string, number>();
  const blocks: string[] = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index] ?? '';

    if (!line.trim()) {
      index += 1;
      continue;
    }

    if (isFence(line)) {
      const block = renderCodeBlock(lines, index);
      blocks.push(block.html);
      index = block.nextIndex;
      continue;
    }

    const heading = extractHeading(line);
    if (heading) {
      const id = uniqueSlug(heading.text, seenHeadings);
      headings.push({ id, level: heading.level, text: heading.text });
      blocks.push(`<h${heading.level} id="${escapeAttribute(id)}">${inlineMarkdown(heading.text)}</h${heading.level}>`);
      index += 1;
      continue;
    }

    if (isPipeTableStart(lines, index)) {
      const table = renderTable(lines, index);
      blocks.push(table.html);
      index = table.nextIndex;
      continue;
    }

    if (isUnorderedListItem(line)) {
      const list = renderList(lines, index, false);
      blocks.push(list.html);
      index = list.nextIndex;
      continue;
    }

    if (isOrderedListItem(line)) {
      const list = renderList(lines, index, true);
      blocks.push(list.html);
      index = list.nextIndex;
      continue;
    }

    if (isBlockquote(line)) {
      const quote = renderBlockquote(lines, index);
      blocks.push(quote.html);
      index = quote.nextIndex;
      continue;
    }

    if (isHorizontalRule(line)) {
      blocks.push('<hr>');
      index += 1;
      continue;
    }

    const paragraph = renderParagraph(lines, index);
    blocks.push(paragraph.html);
    index = paragraph.nextIndex;
  }

  return blocks.join('\n');
}

function extractSummaryItems(markdown: string): string[] {
  const lines = markdown.replace(/\r\n/g, '\n').split('\n');
  const items: string[] = [];
  let inSummary = false;

  for (const line of lines) {
    const heading = extractHeading(line);
    if (heading) {
      if (inSummary) {
        break;
      }
      inSummary = heading.level === 2 && heading.text === '摘要';
      continue;
    }

    if (!inSummary) {
      continue;
    }

    const unordered = /^\s*[-*+]\s+(.+)$/.exec(line);
    const ordered = /^\s*\d+[.)]\s+(.+)$/.exec(line);
    const item = unordered?.[1] ?? ordered?.[1];
    if (item) {
      items.push(item.trim());
    }
  }

  return items;
}

function readTemplate(cwd: string): string {
  const projectTemplate = path.join(cwd, '.boss', 'templates', 'artifact.html.template');
  const templatePath = fs.existsSync(projectTemplate) ? projectTemplate : DEFAULT_TEMPLATE;
  return fs.readFileSync(templatePath, 'utf8');
}

function renderSummaryHtml(items: string[]): string {
  if (items.length === 0) {
    return '<p>暂无摘要。</p>';
  }
  return `<ul>${items.map((item) => `<li>${inlineMarkdown(item)}</li>`).join('')}</ul>`;
}

function renderTocHtml(items: ArtifactHtmlTocItem[]): string {
  if (items.length === 0) {
    return '<p>暂无目录。</p>';
  }
  return `<ul>${items
    .map(
      (item) =>
        `<li class="toc-level-${item.level}"><a href="#${escapeAttribute(item.id)}">${escapeHtml(item.text)}</a></li>`
    )
    .join('')}</ul>`;
}

export function buildArtifactHtmlModel(input: ArtifactHtmlInput): ArtifactHtmlModel {
  if (!input.feature) {
    throw new Error('缺少 feature 参数');
  }
  if (!input.sourceArtifact.endsWith('.md')) {
    throw new Error('sourceArtifact must end with .md');
  }

  const headings: ArtifactHtmlTocItem[] = [];
  const title = input.markdown.match(/^#\s+(.+)$/m)?.[1]?.trim() || input.sourceArtifact.replace(/\.md$/, '');
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

  return template
    .split('{{FEATURE}}')
    .join(escapeHtml(model.feature))
    .split('{{TITLE}}')
    .join(escapeHtml(model.title))
    .split('{{SOURCE_ARTIFACT}}')
    .join(escapeHtml(model.sourceArtifact))
    .split('{{GENERATED_AT}}')
    .join(escapeHtml(model.generatedAt))
    .split('{{SUMMARY_HTML}}')
    .join(renderSummaryHtml(model.summaryItems))
    .split('{{TOC_HTML}}')
    .join(renderTocHtml(model.toc))
    .split('{{BODY_HTML}}')
    .join(model.bodyHtml);
}

export function writeArtifactHtmlCompanion(input: ArtifactHtmlInput & { featureDir?: string }): string {
  const cwd = input.cwd ?? process.cwd();
  const featureDir = input.featureDir ?? path.join(cwd, '.boss', input.feature);
  const htmlArtifact = input.sourceArtifact.replace(/\.md$/, '.html');
  const outputPath = path.join(featureDir, htmlArtifact);
  fs.mkdirSync(featureDir, { recursive: true });
  fs.writeFileSync(outputPath, renderArtifactHtml(input), 'utf8');
  return htmlArtifact;
}
