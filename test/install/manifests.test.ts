import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';

const ROOT = path.resolve(import.meta.dirname, '..', '..');
const STAGES = ['pm', 'architect', 'ui', 'review', 'tasks', 'dev', 'qa', 'ship'];
const COMMANDS = [...STAGES, 'verify', 'upgrade'];

function readJson(rel: string): Record<string, unknown> {
  return JSON.parse(fs.readFileSync(path.join(ROOT, rel), 'utf8')) as Record<string, unknown>;
}

function paths(value: unknown): string[] {
  if (typeof value === 'string') return [value];
  return Array.isArray(value) ? value.filter((item) => typeof item === 'string') : [];
}

function exists(rel: string): boolean {
  return fs.existsSync(path.join(ROOT, rel));
}

describe('plugin manifests point at files that exist', () => {
  // v5.0.4 shipped a `hooks` path to a deleted file; Claude Code reports that as a load failure.
  it.each(['.claude-plugin/plugin.json', '.codex-plugin/plugin.json'])('%s', (manifest) => {
    const plugin = readJson(manifest);
    const referenced = ['skills', 'commands', 'agents', 'hooks', 'mcpServers'].flatMap((key) =>
      paths(plugin[key]),
    );
    const ui = (plugin.interface ?? {}) as Record<string, unknown>;
    referenced.push(...paths(ui.composerIcon), ...paths(ui.logo), ...paths(ui.screenshots));

    expect(paths(plugin.skills).length).toBeGreaterThan(0);
    for (const rel of referenced) {
      expect(exists(rel), `${manifest} references ${rel}`).toBe(true);
    }
  });

  it.each([
    '.claude-plugin/marketplace.json',
    '.codex-plugin/marketplace.json',
    '.agents/plugins/marketplace.json',
  ])('%s lists the boss plugin with a source that exists', (manifest) => {
    const plugins = readJson(manifest).plugins as { name: string; source: unknown }[];
    const boss = plugins.find((plugin) => plugin.name === 'boss');
    expect(boss).toBeTruthy();
    const source = boss?.source as string | { path?: string };
    const rel = typeof source === 'string' ? source : (source.path ?? '');
    expect(exists(path.join(rel, 'skill', 'SKILL.md')), `${manifest} source ${rel}`).toBe(true);
  });
});

describe('Claude Code slash commands', () => {
  const plugin = readJson('.claude-plugin/plugin.json');
  const commandDirs = paths(plugin.commands);

  it('registers the commands directory, so /boss:<stage> exists as a real command', () => {
    expect(commandDirs).toEqual(['./skill/commands/']);
  });

  it('names command files after the stage, because Claude Code derives /boss:<name> from the file name', () => {
    const files = fs
      .readdirSync(path.join(ROOT, 'skill', 'commands'))
      .filter((file) => file.endsWith('.md'))
      .map((file) => file.replace(/\.md$/, ''))
      .sort();
    expect(files).toEqual([...COMMANDS].sort());
    // A command named `boss` would duplicate the skill's own `/boss:boss`.
    expect(files).not.toContain('boss');
  });

  it.each(COMMANDS)('%s has a description and no name override', (command) => {
    const source = fs.readFileSync(path.join(ROOT, 'skill', 'commands', `${command}.md`), 'utf8');
    const frontMatter = parse(source.slice(4, source.indexOf('\n---', 3) + 1)) as Record<
      string,
      unknown
    >;
    expect(frontMatter.description).toBeTypeOf('string');
    expect(frontMatter.name).toBeUndefined();
  });

  it('documents every stage command in the main skill', () => {
    const skill = fs.readFileSync(path.join(ROOT, 'skill', 'SKILL.md'), 'utf8');
    for (const command of [...STAGES, 'verify']) {
      expect(skill, command).toContain(`| \`${command}\``);
    }
  });
});

describe('files the skill tells the agent to read', () => {
  const sources = [
    'skill/SKILL.md',
    'skill/references/continuation-chain.md',
    'skill/references/contract-verification.md',
    ...COMMANDS.map((command) => `skill/commands/${command}.md`),
  ];

  it.each(sources)('%s only references Boss files that exist', (rel) => {
    const text = fs.readFileSync(path.join(ROOT, rel), 'utf8');
    const referenced = [
      ...text.matchAll(/`((?:agents|commands|references|scripts|templates)\/[\w./-]+\.\w+)`/g),
    ].map((match) => match[1] as string);
    for (const file of new Set(referenced)) {
      expect(exists(path.join('skill', file)), `${rel} references ${file}`).toBe(true);
    }
  });
});
