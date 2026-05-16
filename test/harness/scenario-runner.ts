import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { projectState, type RuntimeEvent } from '../../packages/boss-cli/src/runtime/projectors/materialize-state.js';
import { ensureBuilt } from '../helpers/run-cli.js';

export interface ScenarioCommand {
  run: string[];
  expectExit?: number;
}

export interface ScenarioManifest {
  name: string;
  description: string;
  feature: string;
  fixture?: string;
  commands: ScenarioCommand[];
  expect: {
    artifacts?: string[];
    forbidPaths?: string[];
    events?: string[];
    state?: Record<string, unknown>;
  };
}

export interface ScenarioCommandResult {
  command: string[];
  exitCode: number | null;
  stdout: string;
  stderr: string;
}

export interface ScenarioRunResult {
  scenario: ScenarioManifest;
  workspace: string;
  commands: ScenarioCommandResult[];
  events: RuntimeEvent[];
  execution: Record<string, unknown>;
}

const REPO_ROOT = path.resolve(import.meta.dirname, '..', '..');
const BOSS_ENTRYPOINT = 'packages/boss-cli/dist/bin/boss.js';
const BOSS_BIN = path.join(REPO_ROOT, BOSS_ENTRYPOINT);

export function loadScenario(manifestPath: string): ScenarioManifest {
  const raw = fs.readFileSync(manifestPath, 'utf8');
  const scenario = JSON.parse(raw) as ScenarioManifest;
  if (!scenario.name || !scenario.feature || !Array.isArray(scenario.commands)) {
    throw new Error(`Invalid scenario manifest: ${manifestPath}`);
  }
  return scenario;
}

export function scenarioRoot(manifestPath: string): string {
  return path.dirname(manifestPath);
}

function copyDirectory(src: string, dest: string): void {
  if (!fs.existsSync(src)) return;
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const from = path.join(src, entry.name);
    const to = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDirectory(from, to);
    } else if (entry.isFile()) {
      fs.copyFileSync(from, to);
      if (/\.(?:cjs|js|sh)$/.test(entry.name)) {
        fs.chmodSync(to, 0o755);
      }
    }
  }
}

function resolveCommand(command: string[]): string[] {
  if (command[0] !== 'boss') return command;
  ensureBuilt(BOSS_ENTRYPOINT);
  return [process.execPath, BOSS_BIN, ...command.slice(1)];
}

function readJsonl(filePath: string): RuntimeEvent[] {
  if (!fs.existsSync(filePath)) return [];
  const content = fs.readFileSync(filePath, 'utf8').trim();
  if (!content) return [];
  return content.split('\n').map((line) => JSON.parse(line) as RuntimeEvent);
}

export function runScenario(manifestPath: string): ScenarioRunResult {
  const scenario = loadScenario(manifestPath);
  const root = scenarioRoot(manifestPath);
  const workspace = fs.mkdtempSync(path.join(os.tmpdir(), 'boss-harness-'));
  if (scenario.fixture) {
    copyDirectory(path.join(root, scenario.fixture), workspace);
  }

  const commands = scenario.commands.map((command) => {
    const resolved = resolveCommand(command.run);
    const result = spawnSync(resolved[0], resolved.slice(1), {
      cwd: workspace,
      encoding: 'utf8'
    });
    return {
      command: command.run,
      exitCode: result.status,
      stdout: result.stdout,
      stderr: result.stderr
    };
  });

  const eventPath = path.join(workspace, '.boss', scenario.feature, '.meta', 'events.jsonl');
  const executionPath = path.join(workspace, '.boss', scenario.feature, '.meta', 'execution.json');
  const events = readJsonl(eventPath);
  const execution = fs.existsSync(executionPath)
    ? JSON.parse(fs.readFileSync(executionPath, 'utf8')) as Record<string, unknown>
    : projectState(events, scenario.feature) as unknown as Record<string, unknown>;

  return { scenario, workspace, commands, events, execution };
}
