import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import {
  buildFeatureSummary,
  writeFeatureMemory
} from '../../packages/boss-cli/src/runtime/application/memory.js';
import {
  initPipeline,
  updateAgent,
  updateStage
} from '../../packages/boss-cli/src/runtime/application/pipeline.js';
import { main as continueMain } from '../../packages/boss-cli/src/commands/continue.js';

const REPO_ROOT = path.resolve(import.meta.dirname, '..', '..');
const BOSS_BIN = path.join(REPO_ROOT, 'packages', 'boss-cli', 'dist', 'bin', 'boss.js');
const RUN_WITH_FLAGS = path.join(REPO_ROOT, 'scripts', 'lib', 'run-with-flags.js');

describe('runtime CLI contract', () => {
  let tmpDir: string;
  let originalCwd: string;

  beforeEach(() => {
    if (!fs.existsSync(BOSS_BIN)) {
      throw new Error('Missing built Boss CLI dist. Run `npm run build` before runtime CLI contract tests.');
    }
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'boss-runtime-cli-'));
    originalCwd = process.cwd();
    process.chdir(tmpDir);
  });

  afterEach(() => {
    process.chdir(originalCwd);
    fs.rmSync(tmpDir, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
  });

  function distCli(name: string) {
    return path.join(REPO_ROOT, 'packages', 'boss-cli', 'dist', 'commands', 'runtime', `${name}.js`);
  }

  function runCli(name: string, args: string[]) {
    return spawnSync(process.execPath, [BOSS_BIN, 'runtime', name, ...args], {
      cwd: tmpDir,
      encoding: 'utf8'
    });
  }

  function runBoss(args: string[]) {
    return spawnSync(process.execPath, [BOSS_BIN, ...args], {
      cwd: tmpDir,
      encoding: 'utf8'
    });
  }

  it('get-ready-artifacts CLI does not depend on runtime internal exports', () => {
    const source = fs.readFileSync(
      path.join(REPO_ROOT, 'packages', 'boss-cli', 'src', 'commands', 'runtime', 'get-ready-artifacts.ts'),
      'utf8'
    );

    expect(source).not.toMatch(/\._internal\b/);
  });

  it('dist init-pipeline artifact is rebuilt from the current source under review', () => {
    const sourcePath = path.join(REPO_ROOT, 'packages', 'boss-cli', 'src', 'commands', 'runtime', 'init-pipeline.ts');
    const distPath = distCli('init-pipeline');

    const sourceMtime = fs.statSync(sourcePath).mtimeMs;
    const distMtime = fs.statSync(distPath).mtimeMs;

    expect(distMtime).toBeGreaterThanOrEqual(sourceMtime);

    const source = fs.readFileSync(sourcePath, 'utf8');
    const dist = fs.readFileSync(distPath, 'utf8');

    expect(source).toContain('boss runtime init-pipeline FEATURE [options]');
    expect(dist).toContain('boss runtime init-pipeline FEATURE [options]');
  });

  it('init-pipeline CLI exposes help text and stable JSON fields', () => {
    const help = runCli('init-pipeline', ['--help']);
    expect(help.status).toBe(0);
    expect(help.stdout + help.stderr).toMatch(/Usage: boss runtime init-pipeline FEATURE \[options\]/);

    const result = runCli('init-pipeline', ['test-feat']);
    expect(result.status).toBe(0);

    const payload = JSON.parse(result.stdout) as {
      feature: string;
      status: string;
      executionPath: string;
    };
    expect(payload.feature).toBe('test-feat');
    expect(payload.status).toBe('initialized');
    expect(payload.executionPath).toBe('.boss/test-feat/.meta/execution.json');
  });

  it('record-artifact CLI exposes help text and stable JSON fields', () => {
    initPipeline('test-feat', { cwd: tmpDir });
    const featureDir = path.join(tmpDir, '.boss', 'test-feat');
    fs.mkdirSync(featureDir, { recursive: true });
    fs.writeFileSync(path.join(featureDir, 'prd.md'), '# PRD\n\n## 摘要\n- ok\n', 'utf8');

    const help = runCli('record-artifact', ['--help']);
    expect(help.status).toBe(0);
    expect(help.stdout + help.stderr).toMatch(/Usage: boss runtime record-artifact FEATURE ARTIFACT STAGE \[options\]/);

    const result = runCli('record-artifact', ['test-feat', 'prd.md', '1']);
    expect(result.status).toBe(0);

    const payload = JSON.parse(result.stdout) as {
      feature: string;
      artifact: string;
      stage: number;
      artifacts: string[];
    };
    expect(payload.feature).toBe('test-feat');
    expect(payload.artifact).toBe('prd.md');
    expect(payload.stage).toBe(1);
    expect(payload.artifacts).toContain('prd.md');
    expect(payload.artifacts).toContain('prd.html');
  });

  it('record-artifact exposes no-open for UI design auto preview control', () => {
    const result = runCli('record-artifact', ['--describe']);
    expect(result.status).toBe(0);

    const payload = JSON.parse(result.stdout) as {
      command: string;
      options: Array<{ name: string }>;
    };
    expect(payload.command).toBe('boss runtime record-artifact');
    expect(payload.options.map((option) => option.name)).toContain('no-open');
  });

  it('record-artifact surfaces a non-blocking UI design preview command', () => {
    initPipeline('test-feat', { cwd: tmpDir });

    const result = runCli('record-artifact', ['test-feat', 'ui-design.json', '1', '--no-open']);
    expect(result.status).toBe(0);

    const payload = JSON.parse(result.stdout) as {
      previewCommand?: string;
    };
    expect(payload.previewCommand).toBe('boss design preview test-feat --no-open');
  });

  it('get-ready-artifacts CLI exposes help text and stable ready-artifact JSON', () => {
    initPipeline('test-feat', { cwd: tmpDir });

    const help = runCli('get-ready-artifacts', ['--help']);
    expect(help.status).toBe(0);
    expect(help.stdout).toMatch(/Usage: boss runtime get-ready-artifacts FEATURE \[ARTIFACT\] \[options\]/);

    const result = runCli('get-ready-artifacts', ['test-feat', '--ready', '--json']);
    expect(result.status).toBe(0);

    const payload = JSON.parse(result.stdout) as string[];
    expect(payload).toEqual(['prd.md']);
  });

  it('evaluate-gates CLI exposes help text and stable JSON fields', () => {
    initPipeline('test-feat', { cwd: tmpDir });

    const help = runCli('evaluate-gates', ['--help']);
    expect(help.status).toBe(0);
    expect(help.stdout + help.stderr).toMatch(/Usage: boss runtime evaluate-gates FEATURE GATE \[options\]/);

    const result = runCli('evaluate-gates', ['test-feat', 'gate1', '--dry-run']);
    expect(result.status).toBe(0);

    const payload = JSON.parse(result.stdout) as {
      actions: Array<{ type: string; feature: string; gate: string; writes_event: boolean }>;
      risk_tier: string;
      requires_approval: boolean;
    };
    expect(payload).toEqual({
      actions: [
        {
          type: 'evaluate_gate',
          feature: 'test-feat',
          gate: 'gate1',
          writes_event: false
        }
      ],
      risk_tier: 'medium',
      requires_approval: false
    });
  });

  it('update-stage and update-agent CLIs expose runtime-first help text', () => {
    const stageHelp = runCli('update-stage', ['--help']);
    expect(stageHelp.status).toBe(0);
    expect(stageHelp.stdout + stageHelp.stderr).toMatch(/Usage: boss runtime update-stage FEATURE STAGE STATUS \[options\]/);

    const agentHelp = runCli('update-agent', ['--help']);
    expect(agentHelp.status).toBe(0);
    expect(agentHelp.stdout + agentHelp.stderr).toMatch(
      /Usage: boss runtime update-agent FEATURE STAGE AGENT STATUS \[options\]/
    );
  });

  it('check-stage, replay-events, inspect-progress, and render-diagnostics expose help text', () => {
    const stageHelp = runCli('check-stage', ['--help']);
    expect(stageHelp.status).toBe(0);
    expect(stageHelp.stdout + stageHelp.stderr).toMatch(/Usage: boss runtime check-stage FEATURE/);

    const replayHelp = runCli('replay-events', ['--help']);
    expect(replayHelp.status).toBe(0);
    expect(replayHelp.stdout + replayHelp.stderr).toMatch(/Usage: boss runtime replay-events FEATURE/);

    const progressHelp = runCli('inspect-progress', ['--help']);
    expect(progressHelp.status).toBe(0);
    expect(progressHelp.stdout + progressHelp.stderr).toMatch(/Usage: boss runtime inspect-progress FEATURE/);

    const diagnosticsHelp = runCli('render-diagnostics', ['--help']);
    expect(diagnosticsHelp.status).toBe(0);
    expect(diagnosticsHelp.stdout + diagnosticsHelp.stderr).toMatch(/Usage: boss runtime render-diagnostics FEATURE/);
  });

  it('extract-memory, query-memory, and build-memory-summary expose help text', () => {
    const extractHelp = runCli('extract-memory', ['--help']);
    expect(extractHelp.status).toBe(0);
    expect(extractHelp.stdout + extractHelp.stderr).toMatch(/Usage: boss runtime extract-memory FEATURE/);

    const queryHelp = runCli('query-memory', ['--help']);
    expect(queryHelp.status).toBe(0);
    expect(queryHelp.stdout + queryHelp.stderr).toMatch(/Usage: boss runtime query-memory FEATURE/);

    const summaryHelp = runCli('build-memory-summary', ['--help']);
    expect(summaryHelp.status).toBe(0);
    expect(summaryHelp.stdout + summaryHelp.stderr).toMatch(/Usage: boss runtime build-memory-summary FEATURE/);
  });

  it('query-memory emits stable json payloads for startup summaries', () => {
    writeFeatureMemory(
      'test-feat',
      [
        {
          id: 'm1',
          scope: 'feature',
          kind: 'execution',
          category: 'historical_risk',
          summary: 'Stage 3 is unstable',
          source: { type: 'events' },
          evidence: [{ type: 'event', ref: '2' }],
          tags: ['stage3'],
          confidence: 0.8,
          createdAt: '2026-04-17T00:00:00Z',
          lastSeenAt: '2026-04-17T00:00:00Z',
          expiresAt: null,
          decayScore: 10,
          influence: 'preference'
        }
      ],
      { cwd: tmpDir }
    );
    buildFeatureSummary('test-feat', { cwd: tmpDir });

    const result = runCli('query-memory', ['test-feat', '--startup', '--json']);
    expect(result.status).toBe(0);

    const payload = JSON.parse(result.stdout) as {
      feature: string;
      startupSummary: Array<{ summary: string }>;
    };
    expect(payload.feature).toBe('test-feat');
    expect(payload.startupSummary[0]?.summary).toBe('Stage 3 is unstable');
  });

  it('query-memory supports agent-scoped summaries for subagent context injection', () => {
    writeFeatureMemory(
      'test-feat',
      [
        {
          id: 'm1',
          scope: 'feature',
          kind: 'execution',
          category: 'agent_failure_pattern',
          stage: 3,
          agent: 'boss-backend',
          summary: 'Backend forgot to delete R2 objects',
          source: { type: 'events' },
          evidence: [{ type: 'event', ref: '2' }],
          tags: ['boss-backend'],
          confidence: 0.9,
          createdAt: '2026-04-17T00:00:00Z',
          lastSeenAt: '2026-04-17T00:00:00Z',
          expiresAt: null,
          decayScore: 10,
          influence: 'preference'
        }
      ],
      { cwd: tmpDir }
    );
    initPipeline('test-feat', { cwd: tmpDir });
    buildFeatureSummary('test-feat', { cwd: tmpDir });

    const result = runCli('query-memory', ['test-feat', '--agent', 'boss-backend', '--json']);
    expect(result.status).toBe(0);

    const payload = JSON.parse(result.stdout) as {
      feature: string;
      agent: string;
      memories: Array<{ summary: string }>;
    };
    expect(payload.feature).toBe('test-feat');
    expect(payload.agent).toBe('boss-backend');
    expect(payload.memories.map((item) => item.summary)).toEqual(['Backend forgot to delete R2 objects']);
  });

  it('update-stage rejects artifact recording and points agents to record-artifact', () => {
    initPipeline('test-feat', { cwd: tmpDir });

    const result = runCli('update-stage', ['test-feat', '1', 'completed', '--artifact', 'prd.md']);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('record-artifact');
  });

  it('runtime commands expose describe metadata and structured non-tty errors', () => {
    for (const command of [
      'init-pipeline',
      'update-stage',
      'update-agent',
      'record-artifact',
      'get-ready-artifacts',
      'evaluate-gates',
      'check-stage',
      'replay-events',
      'inspect-progress',
      'inspect-pipeline',
      'inspect-events',
      'inspect-plugins',
      'render-diagnostics',
      'extract-memory',
      'query-memory',
      'build-memory-summary',
      'generate-summary',
      'register-plugins',
      'run-plugin-hook',
      'record-feedback',
      'retry-agent',
      'retry-stage'
    ]) {
      const describe = runCli(command, ['--describe']);
      expect(describe.status, `${command} --describe`).toBe(0);
      const metadata = JSON.parse(describe.stdout) as { command: string; options: Array<{ name: string }> };
      expect(metadata.command).toContain(command);
      expect(metadata.options.map((option) => option.name)).toContain('json');
    }

    const result = runCli('update-stage', ['missing-feature', '1', 'running', '--bad-flag']);
    expect(result.status).toBe(1);
    const payload = JSON.parse(result.stderr) as { error: { code: string; retryable: boolean } };
    expect(payload.error.code).toBe('unknown_option');
    expect(payload.error.retryable).toBe(false);
  });

  it('top-level multi-driver commands preserve existing describe metadata', () => {
    for (const args of [
      ['status', '--describe'],
      ['continue', '--describe']
    ]) {
      const result = runBoss(args);
      expect(result.status, `${args.join(' ')} --describe`).toBe(0);
      const payload = JSON.parse(result.stdout) as { command: string; options: Array<{ name: string }> };
      expect(payload.command).toContain(args[0]!);
      expect(payload.options.map((option) => option.name)).toEqual(['json', 'describe', 'driver']);
    }
  });

  it('boss gate commands expose scoped describe metadata', () => {
    const gate = runBoss(['gate', '--describe']);
    expect(gate.status).toBe(0);
    const gatePayload = JSON.parse(gate.stdout) as { command: string; options: Array<{ name: string }> };
    expect(gatePayload.command).toBe('boss gate');
    expect(gatePayload.options.map((option) => option.name)).toEqual(['json', 'describe', 'gate']);

    const final = runBoss(['gate', 'final', '--describe']);
    expect(final.status).toBe(0);
    const finalPayload = JSON.parse(final.stdout) as { command: string; options: Array<{ name: string }> };
    expect(finalPayload.command).toBe('boss gate final');
    expect(finalPayload.options.map((option) => option.name)).toEqual(['json', 'describe']);
  });

  it('boss qa commands expose scoped describe metadata', () => {
    const qa = runBoss(['qa', '--describe']);
    expect(qa.status).toBe(0);
    const qaPayload = JSON.parse(qa.stdout) as { command: string; options: Array<{ name: string }> };
    expect(qaPayload.command).toBe('boss qa');
    expect(qaPayload.options.map((option) => option.name)).toEqual(['json', 'describe']);

    const attack = runBoss(['qa', 'attack', '--describe']);
    expect(attack.status).toBe(0);
    const attackPayload = JSON.parse(attack.stdout) as { command: string; options: Array<{ name: string }> };
    expect(attackPayload.command).toBe('boss qa attack');
    expect(attackPayload.options.map((option) => option.name)).toEqual(['json', 'describe']);
  });

  it('boss gate final emits structured JSON and fails when required artifacts are missing', () => {
    initPipeline('test-feat', { cwd: tmpDir });

    const result = runBoss(['gate', 'final', 'test-feat']);

    expect(result.status).toBe(1);
    const payload = JSON.parse(result.stdout) as {
      feature: string;
      passed: boolean;
      checks: Array<{ name: string; passed: boolean; missing?: string[] }>;
    };
    expect(payload.feature).toBe('test-feat');
    expect(payload.passed).toBe(false);
    expect(payload.checks).toContainEqual(
      expect.objectContaining({
        name: 'required-artifacts',
        passed: false,
        missing: ['prd.md', 'architecture.md', 'tasks.md', 'qa-report.md']
      })
    );
  });

  it('boss gate final accepts global options before the final subcommand', () => {
    initPipeline('test-feat', { cwd: tmpDir });

    const result = runBoss(['gate', '--json', 'final', 'test-feat']);

    expect(result.status).toBe(1);
    const payload = JSON.parse(result.stdout) as {
      feature: string;
      checks: Array<{ name: string; missing?: string[] }>;
    };
    expect(payload.feature).toBe('test-feat');
    expect(payload.checks).toContainEqual(
      expect.objectContaining({
        name: 'required-artifacts',
        missing: ['prd.md', 'architecture.md', 'tasks.md', 'qa-report.md']
      })
    );
  });

  it('boss gate rejects unadvertised dry-run instead of executing a real gate', () => {
    initPipeline('test-feat', { cwd: tmpDir });

    const result = runBoss(['gate', 'test-feat', '--dry-run', '--json']);

    expect(result.status).toBe(1);
    const payload = JSON.parse(result.stderr) as { error: { code: string; input?: { option?: string } } };
    expect(payload.error.code).toBe('unknown_option');
    expect(payload.error.input?.option).toBe('--dry-run');
  });

  it('boss gate missing feature returns a structured argument error', () => {
    const result = runBoss(['gate', '--json']);

    expect(result.status).toBe(1);
    const payload = JSON.parse(result.stderr) as { error: { code: string; input?: { argument?: string } } };
    expect(payload.error.code).toBe('missing_argument');
    expect(payload.error.input?.argument).toBe('feature');
  });

  it('boss gate final missing feature returns a structured argument error', () => {
    const result = runBoss(['gate', 'final', '--json']);

    expect(result.status).toBe(1);
    const payload = JSON.parse(result.stderr) as { error: { code: string; input?: { argument?: string } } };
    expect(payload.error.code).toBe('missing_argument');
    expect(payload.error.input?.argument).toBe('feature');
  });

  it('boss qa attack emits structured JSON and fails when QA evidence is missing', () => {
    initPipeline('test-feat', { cwd: tmpDir });

    const result = runBoss(['qa', 'attack', 'test-feat']);

    expect(result.status).toBe(1);
    const payload = JSON.parse(result.stdout) as {
      feature: string;
      status: string;
      findings: Array<{ id: string; severity: string; status: string }>;
    };
    expect(payload.feature).toBe('test-feat');
    expect(payload.status).toBe('failed');
    expect(payload.findings).toContainEqual(
      expect.objectContaining({
        id: 'qa-report-missing',
        severity: 'critical',
        status: 'open'
      })
    );
  });

  it('boss qa attack accepts global options before the attack subcommand', () => {
    initPipeline('test-feat', { cwd: tmpDir });

    const result = runBoss(['qa', '--json', 'attack', 'test-feat']);

    expect(result.status).toBe(1);
    const payload = JSON.parse(result.stdout) as { feature: string; findings: Array<{ id: string }> };
    expect(payload.feature).toBe('test-feat');
    expect(payload.findings).toContainEqual(expect.objectContaining({ id: 'qa-report-missing' }));
  });

  it('boss qa attack rejects unadvertised dry-run instead of ignoring it', () => {
    initPipeline('test-feat', { cwd: tmpDir });

    const result = runBoss(['qa', 'attack', 'test-feat', '--dry-run', '--json']);

    expect(result.status).toBe(1);
    const payload = JSON.parse(result.stderr) as { error: { code: string; input?: { option?: string } } };
    expect(payload.error.code).toBe('unknown_option');
    expect(payload.error.input?.option).toBe('--dry-run');
  });

  it('boss qa rejects unknown subcommands even when describe is present', () => {
    const result = runBoss(['qa', 'madeup', '--describe']);

    expect(result.status).toBe(1);
    const payload = JSON.parse(result.stderr) as { error: { code: string; input?: { command?: string } } };
    expect(payload.error.code).toBe('unknown_command');
    expect(payload.error.input?.command).toBe('madeup');
  });

  it('boss qa attack missing feature returns a structured argument error', () => {
    const result = runBoss(['qa', 'attack', '--json']);

    expect(result.status).toBe(1);
    const payload = JSON.parse(result.stderr) as { error: { code: string; input?: { argument?: string } } };
    expect(payload.error.code).toBe('missing_argument');
    expect(payload.error.input?.argument).toBe('feature');
  });

  it('boss qa attack missing execution state returns a structured feature error', () => {
    const result = runBoss(['qa', 'attack', 'missing-feature', '--json']);

    expect(result.status).toBe(1);
    const payload = JSON.parse(result.stderr) as { error: { code: string; input?: { feature?: string } } };
    expect(payload.error.code).toBe('feature_not_found');
    expect(payload.error.input?.feature).toBe('missing-feature');
  });

  it('boss status returns driver capabilities and checkpoint fields', () => {
    initPipeline('test-feat', { cwd: tmpDir });

    const result = runBoss(['status', 'test-feat', '--json']);
    expect(result.status).toBe(0);

    const payload = JSON.parse(result.stdout) as {
      feature: string;
      driver: { name: string; hooks: boolean };
      capabilities: { checkpointPrompt: boolean; hooks: boolean };
      currentStage: { id: number; status: string } | null;
      readyArtifacts: string[];
      checkpoint: { checkpointRequired: boolean; continueCommand: string };
    };
    expect(payload.feature).toBe('test-feat');
    expect(payload.driver.name).toBe('generic');
    expect(payload.capabilities).toMatchObject({ checkpointPrompt: true });
    expect(payload.readyArtifacts).toContain('prd.md');
    expect(payload.checkpoint.continueCommand).toBe('boss continue test-feat');
  });

  it('boss continue returns structured json by default in non-tty mode', () => {
    initPipeline('test-feat', { cwd: tmpDir });
    updateStage('test-feat', 3, 'running', { cwd: tmpDir });

    const result = runBoss(['continue', 'test-feat']);
    expect(result.status).toBe(0);

    const payload = JSON.parse(result.stdout) as {
      feature: string;
      checkpoint: { checkpointRequired: boolean; requiredChecks: Array<{ command: string }> };
    };
    expect(payload.feature).toBe('test-feat');
    expect(payload.checkpoint.checkpointRequired).toBe(true);
    expect(payload.checkpoint.requiredChecks.map((check) => check.command)).toEqual([
      'npm run typecheck',
      'npm test'
    ]);
  });

  it('boss continue prints checkpoint-required human output with stage 3 checks in tty mode', () => {
    initPipeline('test-feat', { cwd: tmpDir });
    updateStage('test-feat', 3, 'running', { cwd: tmpDir });

    const originalIsTTY = process.stdout.isTTY;
    Object.defineProperty(process.stdout, 'isTTY', { configurable: true, value: true });
    const writeSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    try {
      const status = continueMain(['test-feat'], { cwd: tmpDir });
      expect(status).toBe(0);
      const output = writeSpy.mock.calls.map((call) => String(call[0])).join('');
      expect(output).toContain('CHECKPOINT_REQUIRED');
      expect(output).toContain('Feature: test-feat');
      expect(output).toContain('Required checks:');
      expect(output).toContain('- npm run typecheck');
      expect(output).toContain('- npm test');
      expect(output).toContain('Continue: boss continue test-feat');
    } finally {
      writeSpy.mockRestore();
      Object.defineProperty(process.stdout, 'isTTY', { configurable: true, value: originalIsTTY });
    }
  });

  it('top-level multi-driver commands reject unadvertised contract options', () => {
    initPipeline('test-feat', { cwd: tmpDir });

    const result = runBoss(['status', 'test-feat', '--dry-run', '--json']);
    expect(result.status).toBe(1);
    const payload = JSON.parse(result.stderr) as { error: { code: string; message: string } };
    expect(payload.error.code).toBe('unknown_option');
    expect(payload.error.message).toContain('--dry-run');
  });

  it('read-only runtime commands default to json in non-tty mode and support fields/limit', () => {
    initPipeline('test-feat', { cwd: tmpDir });

    const events = runCli('inspect-events', ['test-feat', '--limit', '1', '--fields', 'events']);
    expect(events.status).toBe(0);
    const eventsPayload = JSON.parse(events.stdout) as { events: unknown[] };
    expect(Object.keys(eventsPayload)).toEqual(['events']);
    expect(eventsPayload.events.length).toBeLessThanOrEqual(1);

    const pipeline = runCli('inspect-pipeline', ['test-feat', '--fields', 'feature,status']);
    expect(pipeline.status).toBe(0);
    expect(JSON.parse(pipeline.stdout)).toEqual({
      feature: 'test-feat',
      status: 'initialized'
    });
  });

  it('runtime field selectors consume space-separated option values consistently', () => {
    initPipeline('test-feat', { cwd: tmpDir });
    writeFeatureMemory(
      'test-feat',
      [
        {
          id: 'm1',
          scope: 'feature',
          kind: 'execution',
          category: 'historical_risk',
          summary: 'Stage 3 is unstable',
          source: { type: 'events' },
          evidence: [{ type: 'event', ref: '2' }],
          tags: ['stage3'],
          confidence: 0.8,
          createdAt: '2026-04-17T00:00:00Z',
          lastSeenAt: '2026-04-17T00:00:00Z',
          expiresAt: null,
          decayScore: 10,
          influence: 'preference'
        }
      ],
      { cwd: tmpDir }
    );
    buildFeatureSummary('test-feat', { cwd: tmpDir });

    const query = runCli('query-memory', ['test-feat', '--startup', '--fields', 'feature,startupSummary']);
    expect(query.status).toBe(0);
    expect(Object.keys(JSON.parse(query.stdout))).toEqual(['feature', 'startupSummary']);

    const plugins = runCli('inspect-plugins', ['test-feat', '--fields', 'feature,active']);
    expect(plugins.status).toBe(0);
    expect(Object.keys(JSON.parse(plugins.stdout))).toEqual(['feature', 'active']);

    const stage = runCli('check-stage', ['test-feat', '--summary', '--fields', 'status']);
    expect(stage.status).toBe(0);
    expect(JSON.parse(stage.stdout)).toEqual({ status: 'initialized' });
  });

  it('runtime describe metadata matches implemented fields and limit options', () => {
    const inspectPipeline = runCli('inspect-pipeline', ['--describe']);
    expect(inspectPipeline.status).toBe(0);
    const inspectPipelineMetadata = JSON.parse(inspectPipeline.stdout) as {
      options: Array<{ name: string; default?: unknown }>;
    };
    expect(inspectPipelineMetadata.options.map((option) => option.name)).toContain('fields');
    expect(inspectPipelineMetadata.options.map((option) => option.name)).not.toContain('limit');

    const inspectEvents = runCli('inspect-events', ['--describe']);
    expect(inspectEvents.status).toBe(0);
    const inspectEventsMetadata = JSON.parse(inspectEvents.stdout) as {
      options: Array<{ name: string; default?: unknown }>;
    };
    expect(inspectEventsMetadata.options.find((option) => option.name === 'limit')?.default).toBe('20');

    const updateStage = runCli('update-stage', ['--describe']);
    expect(updateStage.status).toBe(0);
    const updateStageMetadata = JSON.parse(updateStage.stdout) as {
      options: Array<{ name: string }>;
    };
    expect(updateStageMetadata.options.map((option) => option.name)).toEqual(
      expect.arrayContaining(['json', 'describe', 'fields', 'dry-run', 'json-input', 'reason'])
    );
    expect(updateStageMetadata.options.map((option) => option.name)).not.toContain('artifact');
  });

  it('runtime help mirrors describe metadata for representative command options', () => {
    const updateStageHelp = runCli('update-stage', ['--help']);
    expect(updateStageHelp.status).toBe(0);
    const updateStageText = updateStageHelp.stdout + updateStageHelp.stderr;
    expect(updateStageText).toContain('--reason <string>');
    expect(updateStageText).toContain('--gate-passed');
    expect(updateStageText).not.toContain('--artifact');
    expect(updateStageText).not.toContain('--yes');
    expect(updateStageText).not.toContain('--limit');

    const inspectEventsHelp = runCli('inspect-events', ['--help']);
    expect(inspectEventsHelp.status).toBe(0);
    const inspectEventsText = inspectEventsHelp.stdout + inspectEventsHelp.stderr;
    expect(inspectEventsText).toContain('--limit <string>  [default: 20]');
    expect(inspectEventsText).toContain('--type <string>');
    expect(inspectEventsText).not.toContain('--dry-run');
    expect(inspectEventsText).not.toContain('--json-input');
  });

  it('runtime contract flags reject missing values before another option', () => {
    initPipeline('test-feat', { cwd: tmpDir });

    const fields = runCli('inspect-pipeline', ['test-feat', '--fields', '--json']);
    expect(fields.status).toBe(1);
    const fieldsPayload = JSON.parse(fields.stderr) as {
      error: { code: string; input: Record<string, unknown>; retryable: boolean };
    };
    expect(fieldsPayload.error).toMatchObject({
      code: 'missing_option_value',
      input: { option: '--fields' },
      retryable: false
    });

    const limit = runCli('inspect-events', ['test-feat', '--limit', '--fields', 'events']);
    expect(limit.status).toBe(1);
    const limitPayload = JSON.parse(limit.stderr) as {
      error: { code: string; input: Record<string, unknown> };
    };
    expect(limitPayload.error).toMatchObject({
      code: 'missing_option_value',
      input: { option: '--limit' }
    });

    const direct = spawnSync(
      process.execPath,
      [distCli('inspect-pipeline'), 'test-feat', '--fields', '--json'],
      {
        cwd: tmpDir,
        encoding: 'utf8'
      }
    );
    expect(direct.status).toBe(1);
    expect(direct.stderr).not.toContain('CliUserError');
    const directPayload = JSON.parse(direct.stderr) as {
      error: { code: string; input: Record<string, unknown> };
    };
    expect(directPayload.error).toMatchObject({
      code: 'missing_option_value',
      input: { option: '--fields' }
    });
  });

  it('memory writer runtime commands support dry-run without creating memory files', () => {
    initPipeline('test-feat', { cwd: tmpDir });
    fs.rmSync(path.join(tmpDir, '.boss', 'test-feat', '.meta', 'feature-memory.json'), { force: true });
    fs.rmSync(path.join(tmpDir, '.boss', 'test-feat', '.meta', 'memory-summary.json'), { force: true });

    const extractResult = runCli('extract-memory', ['test-feat', '--dry-run', '--json']);
    expect(extractResult.status).toBe(0);
    const extractPayload = JSON.parse(extractResult.stdout) as {
      actions: Array<{ type: string; path: string }>;
      risk_tier: string;
      requires_approval: boolean;
    };
    expect(extractPayload.actions).toEqual([
      {
        type: 'write_file',
        path: '.boss/test-feat/.meta/feature-memory.json'
      }
    ]);
    expect(extractPayload.risk_tier).toBe('medium');
    expect(extractPayload.requires_approval).toBe(false);
    expect(fs.existsSync(path.join(tmpDir, '.boss', 'test-feat', '.meta', 'feature-memory.json'))).toBe(false);

    const summaryResult = runCli('build-memory-summary', ['test-feat', '--dry-run', '--json']);
    expect(summaryResult.status).toBe(0);
    const summaryPayload = JSON.parse(summaryResult.stdout) as {
      actions: Array<{ type: string; path: string }>;
    };
    expect(summaryPayload.actions).toEqual([
      {
        type: 'write_file',
        path: '.boss/test-feat/.meta/memory-summary.json'
      }
    ]);
    expect(fs.existsSync(path.join(tmpDir, '.boss', 'test-feat', '.meta', 'memory-summary.json'))).toBe(false);
  });

  it('extract-memory json returns inspectable records and injection preview', () => {
    initPipeline('test-feat', { cwd: tmpDir });
    updateStage('test-feat', 3, 'running', { cwd: tmpDir });
    updateAgent('test-feat', 3, 'boss-backend', 'failed', { cwd: tmpDir, reason: 'timeout' });

    const result = runCli('extract-memory', ['test-feat', '--json']);
    expect(result.status).toBe(0);
    const payload = JSON.parse(result.stdout) as {
      feature: string;
      count: number;
      records: Array<{ category: string; summary: string; evidence: unknown[] }>;
      summaryPreview: {
        startupSummary: Array<{ category: string; summary: string }>;
        agentSections: Record<string, Array<{ category: string; summary: string }>>;
      };
    };

    expect(payload.feature).toBe('test-feat');
    expect(payload.count).toBeGreaterThan(0);
    expect(payload.records).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          category: 'agent_failure_pattern',
          summary: expect.stringContaining('boss-backend failed'),
          evidence: expect.any(Array)
        })
      ])
    );
    expect(payload.summaryPreview.startupSummary.length).toBeGreaterThan(0);
    expect(payload.summaryPreview.agentSections['boss-backend']).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ category: 'agent_failure_pattern' })
      ])
    );
  });

  it('mutating runtime commands support dry-run plans and json input', () => {
    initPipeline('test-feat', { cwd: tmpDir });

    const updateStage = runCli('update-stage', [
      '--json-input={"feature":"test-feat","stage":1,"status":"running"}',
      '--dry-run',
      '--json'
    ]);
    expect(updateStage.status).toBe(0);
    expect(JSON.parse(updateStage.stdout)).toEqual({
      actions: [
        expect.objectContaining({
          type: 'update_stage',
          feature: 'test-feat',
          stage: 1,
          target_status: 'running'
        })
      ],
      risk_tier: 'medium',
      requires_approval: false
    });

    const retryStage = runCli('retry-stage', ['test-feat', '1', '--dry-run', '--json']);
    expect(retryStage.status).toBe(0);
    const retryPayload = JSON.parse(retryStage.stdout) as {
      actions: Array<{ type: string; feature: string; stage: number }>;
      requires_approval: boolean;
    };
    expect(retryPayload.actions[0]).toMatchObject({
      type: 'retry_stage',
      feature: 'test-feat',
      stage: 1
    });
  });

  it('mutating runtime commands require yes for non-interactive high risk retry execution', () => {
    initPipeline('test-feat', { cwd: tmpDir });

    const result = runCli('retry-stage', ['test-feat', '1', '--json']);
    expect(result.status).toBe(1);
    const payload = JSON.parse(result.stderr) as { error: { code: string } };
    expect(payload.error.code).toBe('confirmation_required');
  });

  it('all runtime command help is concise and lists agent contract flags', () => {
    for (const command of [
      'init-pipeline',
      'update-stage',
      'update-agent',
      'record-artifact',
      'get-ready-artifacts',
      'evaluate-gates',
      'check-stage',
      'replay-events',
      'inspect-progress',
      'inspect-pipeline',
      'inspect-events',
      'inspect-plugins',
      'render-diagnostics',
      'extract-memory',
      'query-memory',
      'build-memory-summary',
      'generate-summary',
      'register-plugins',
      'run-plugin-hook',
      'record-feedback',
      'retry-agent',
      'retry-stage'
    ]) {
      const help = runCli(command, ['--help']);
      expect(help.status, command).toBe(0);
      const text = help.stdout + help.stderr;
      expect(text).toContain('Usage:');
      expect(text).toContain('--json');
      expect(text).toContain('--describe');
      expect(text.split('\n').length).toBeLessThanOrEqual(28);

      const describe = runCli(command, ['--describe']);
      expect(describe.status, `${command} --describe`).toBe(0);
      const payload = JSON.parse(describe.stdout) as { command: string; risk_tier: string };
      expect(payload.command).toBe(`boss runtime ${command}`);
      expect(['low', 'medium', 'high']).toContain(payload.risk_tier);
    }
  });

  it('read-only runtime command errors are structured in non-tty mode', () => {
    const result = runCli('inspect-pipeline', ['missing-feature']);

    expect(result.status).toBe(1);
    const payload = JSON.parse(result.stderr) as { error: { code: string; input: Record<string, unknown> } };
    expect(payload.error.code).toBe('feature_not_found');
    expect(payload.error.input).toEqual({ feature: 'missing-feature' });
  });

  it('run-with-flags launches async ESM hook modules, preserves chunk order, and caps stdin at 1 MB', () => {
    const pluginRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'boss-launcher-'));
    const hookPath = path.join(pluginRoot, 'echo-hook.js');
    fs.writeFileSync(
      hookPath,
      [
        'export async function run(rawInput) {',
        '  await Promise.resolve();',
        '  return {',
        '    stdout: JSON.stringify({',
        '      length: rawInput.length,',
        '      first: rawInput[0],',
        '      secondChunk: rawInput[4096],',
        '      nearEnd: rawInput[rawInput.length - 1]',
        '    }),',
        '    exitCode: 0',
        '  };',
        '}',
        ''
      ].join('\n'),
      'utf8'
    );

    const chunkSize = 4096;
    const chunkCount = Math.floor((1024 * 1024) / chunkSize);
    const input = Buffer.alloc(1024 * 1024 + 128);
    for (let index = 0; index < chunkCount; index += 1) {
      const fill = String.fromCharCode(65 + (index % 26));
      input.fill(fill, index * chunkSize, (index + 1) * chunkSize, 'utf8');
    }
    input.fill('z', 1024 * 1024);

    const result = spawnSync(process.execPath, [RUN_WITH_FLAGS, 'session-start', 'echo-hook.js'], {
      cwd: tmpDir,
      env: { ...process.env, SKILL_DIR: pluginRoot },
      input,
      encoding: 'utf8'
    });

    fs.rmSync(pluginRoot, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });

    expect(result.status).toBe(0);
    expect(
      JSON.parse(result.stdout) as {
        length: number;
        first: string;
        secondChunk: string;
        nearEnd: string;
      }
    ).toEqual({
      length: 1024 * 1024,
      first: 'A',
      secondChunk: 'B',
      nearEnd: 'V'
    });
  });
});
