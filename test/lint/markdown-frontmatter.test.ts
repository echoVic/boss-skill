import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';

const ROOT = path.resolve(import.meta.dirname, '..', '..');
const BIOME = path.resolve(ROOT, 'node_modules/.bin/biome');
const SKILL_DIR = path.join(ROOT, 'skill');

// The template carries `{agent}/{skill-name}` placeholders, which are not valid YAML by design.
const PLACEHOLDER_FILES = new Set(['skill/skills/_TEMPLATE.md']);

const PROBE = `---
name: probe
description: |
  First paragraph of a block scalar.

  Triggers:
  - /probe:one — nested list inside the scalar
version: 1.0.0
dependencies:
  - shared/tdd
metadata:
  internal: true
---

# Probe
`;

function markdownFiles(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return markdownFiles(full);
    return entry.name.endsWith('.md') ? [full] : [];
  });
}

function frontMatter(source: string): string | null {
  if (!source.startsWith('---\n')) return null;
  const end = source.indexOf('\n---', 3);
  return end === -1 ? null : source.slice(4, end + 1);
}

const withFrontMatter = markdownFiles(SKILL_DIR)
  .map((file) => ({
    rel: path.relative(ROOT, file).split(path.sep).join('/'),
    block: frontMatter(fs.readFileSync(file, 'utf8')),
  }))
  .filter(
    (entry): entry is { rel: string; block: string } =>
      entry.block !== null && !PLACEHOLDER_FILES.has(entry.rel),
  );

describe('markdown front matter', () => {
  it('is left untouched by the biome formatter', () => {
    const result = spawnSync(BIOME, ['format', '--stdin-file-path=skill/skills/probe/SKILL.md'], {
      cwd: ROOT,
      input: PROBE,
      encoding: 'utf8',
      env: { ...process.env, NO_COLOR: '1' },
    });

    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).toBe(PROBE);
  });

  it('finds the skill, agent and command files that carry front matter', () => {
    const rels = withFrontMatter.map((entry) => entry.rel);
    expect(rels).toContain('skill/SKILL.md');
    expect(rels.filter((rel) => rel.endsWith('/SKILL.md')).length).toBeGreaterThanOrEqual(39);
    expect(rels.some((rel) => rel.startsWith('skill/agents/'))).toBe(true);
    expect(rels.some((rel) => rel.startsWith('skill/commands/'))).toBe(true);
  });

  it.each(withFrontMatter)('$rel parses as a YAML mapping', ({ rel, block }) => {
    const data: unknown = parse(block);

    expect(data).toBeTypeOf('object');
    expect(data).not.toBeNull();
    expect(Array.isArray(data)).toBe(false);

    const fields = data as Record<string, unknown>;
    expect(fields.description).toBeTypeOf('string');
    if (rel.endsWith('SKILL.md')) {
      expect(fields.name).toBeTypeOf('string');
    }
  });
});
