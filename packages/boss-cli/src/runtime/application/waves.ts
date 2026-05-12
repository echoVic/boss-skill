import * as fs from 'node:fs';
import * as path from 'node:path';

export type EvidenceWaveStatus = 'pending' | 'running' | 'completed' | 'blocked' | 'failed';

export interface EvidenceWave {
  id: string;
  title: string;
  scope: string;
  writeSet: string[];
  redTests: string[];
  greenGates: string[];
  contractRows: string[];
  rollbackRisk: string;
  pausePolicy: string;
  status: EvidenceWaveStatus;
}

function splitMarkdownRow(line: string): string[] {
  const cells: string[] = [];
  let current = '';
  let inCodeSpan = false;
  const trimmed = line.trim();

  for (let index = 0; index < trimmed.length; index += 1) {
    const char = trimmed[index]!;
    const previous = trimmed[index - 1];
    if (char === '`' && previous !== '\\') {
      inCodeSpan = !inCodeSpan;
      current += char;
      continue;
    }
    if (char === '|' && previous !== '\\' && !inCodeSpan) {
      cells.push(current.trim());
      current = '';
      continue;
    }
    if (char === '|' && previous === '\\') {
      current = `${current.slice(0, -1)}|`;
      continue;
    }
    current += char;
  }
  cells.push(current.trim());

  if (cells[0] === '') cells.shift();
  if (cells[cells.length - 1] === '') cells.pop();
  return cells;
}

function isSeparatorRow(cells: string[]): boolean {
  return cells.every((cell) => /^:?-{3,}:?$/.test(cell.trim()));
}

function cleanCell(value: string): string {
  return value.trim().replace(/^`+|`+$/g, '').trim();
}

function splitListCell(value: string): string[] {
  return value
    .split(/<br\s*\/?>|,|，/i)
    .map(cleanCell)
    .filter(Boolean);
}

function slugify(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function uniqueWaveId(title: string, index: number, usedIds: Map<string, number>): string {
  const base = slugify(title) || `wave-${index + 1}`;
  const seen = usedIds.get(base) ?? 0;
  usedIds.set(base, seen + 1);
  return seen === 0 ? base : `${base}-${seen + 1}`;
}

function parseTitleAndStatus(rawTitle: string): { title: string; status: EvidenceWaveStatus } {
  const marker = rawTitle.match(/^\[(pending|running|completed|blocked|failed)\]\s*/i);
  if (!marker) {
    return { title: rawTitle, status: 'pending' };
  }
  return {
    title: rawTitle.slice(marker[0].length).trim(),
    status: marker[1]!.toLowerCase() as EvidenceWaveStatus
  };
}

export function readWaves(
  feature: string,
  { cwd = process.cwd() }: { cwd?: string } = {}
): EvidenceWave[] {
  const tasksPath = path.join(cwd, '.boss', feature, 'tasks.md');
  if (!fs.existsSync(tasksPath)) {
    return [];
  }

  let lines: string[];
  try {
    if (!fs.statSync(tasksPath).isFile()) {
      return [];
    }
    lines = fs.readFileSync(tasksPath, 'utf8').split(/\r?\n/);
  } catch {
    return [];
  }
  const headerIndex = lines.findIndex((line) => {
    if (!line.trim().startsWith('|')) return false;
    const cells = splitMarkdownRow(line);
    return cells[0] === 'Evidence Wave' && cells.includes('Stop Condition');
  });

  if (headerIndex === -1) {
    return [];
  }

  const rows: EvidenceWave[] = [];
  const usedIds = new Map<string, number>();
  for (const line of lines.slice(headerIndex + 1)) {
    if (!line.trim().startsWith('|')) break;

    const cells = splitMarkdownRow(line);
    if (isSeparatorRow(cells)) continue;
    if (cells.length < 7) continue;

    const [title, scope, ownerFiles, redTests, greenGates, contractRows, stopCondition] = cells;
    const parsedTitle = parseTitleAndStatus(cleanCell(title ?? ''));
    const cleanedTitle = parsedTitle.title;
    if (!cleanedTitle) continue;
    const cleanedStopCondition = cleanCell(stopCondition ?? '');

    rows.push({
      id: uniqueWaveId(cleanedTitle, rows.length, usedIds),
      title: cleanedTitle,
      scope: cleanCell(scope ?? ''),
      writeSet: splitListCell(ownerFiles ?? ''),
      redTests: splitListCell(redTests ?? ''),
      greenGates: splitListCell(greenGates ?? ''),
      contractRows: splitListCell(contractRows ?? ''),
      rollbackRisk: cleanedStopCondition,
      pausePolicy: cleanedStopCondition,
      status: parsedTitle.status
    });
  }

  return rows;
}
