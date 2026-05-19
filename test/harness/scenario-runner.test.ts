import { describe, expect, it } from 'vitest';
import path from 'node:path';
import { loadScenario, runScenario } from './scenario-runner.js';
import { assertScenarioExpectations } from './artifact-assertions.js';
import { assertTraceInvariants } from './trace-invariants.js';

const SCENARIOS = path.resolve(import.meta.dirname, 'scenarios');

describe('Boss harness scenario runner', () => {
  it('loads a scenario manifest with commands and expectations', () => {
    const scenario = loadScenario(path.join(SCENARIOS, 'project-init-default', 'scenario.json'));

    expect(scenario.name).toBe('project-init-default');
    expect(scenario.feature).toBe('harness-init');
    expect(scenario.commands.length).toBeGreaterThan(0);
    expect(scenario.expect.artifacts).toContain('.boss/harness-init/.meta/execution.json');
  });

  it('runs project-init-default in an isolated workspace', () => {
    const result = runScenario(path.join(SCENARIOS, 'project-init-default', 'scenario.json'));

    expect(result.commands.map((command) => command.exitCode)).toEqual([0]);
    expect(result.workspace).toContain('boss-harness-');
    expect(result.events.map((event) => event.type)).toContain('PipelineInitialized');
    expect(result.execution.feature).toBe('harness-init');
  });

  it('asserts project-init-default artifacts and state paths', () => {
    const result = runScenario(path.join(SCENARIOS, 'project-init-default', 'scenario.json'));

    expect(() => assertScenarioExpectations(result)).not.toThrow();
  });

  it('validates event trace invariants for project-init-default', () => {
    const result = runScenario(path.join(SCENARIOS, 'project-init-default', 'scenario.json'));

    expect(() => assertTraceInvariants(result.events, result.execution)).not.toThrow();
  });

  it('rejects stage events before pipeline initialization', () => {
    expect(() =>
      assertTraceInvariants(
        [{ id: 1, type: 'StageStarted', timestamp: new Date().toISOString(), data: { stage: 1 } }],
        {}
      )
    ).toThrow(/PipelineInitialized/);
  });

  it('runs api-only-pack-detection scenario', () => {
    const result = runScenario(path.join(SCENARIOS, 'api-only-pack-detection', 'scenario.json'));

    assertScenarioExpectations(result);
    assertTraceInvariants(result.events, result.execution);
  });

  it('runs plugin-gate-failure scenario and records both failure and recovery', () => {
    const result = runScenario(path.join(SCENARIOS, 'plugin-gate-failure', 'scenario.json'));

    assertScenarioExpectations(result);
    assertTraceInvariants(result.events, result.execution);
    expect(result.events.map((event) => event.type)).toContain('PluginHookFailed');
    expect(result.events.map((event) => event.type)).toContain('PluginHookExecuted');
  });

  it('runs full-pipeline-lifecycle scenario through all stages', () => {
    const result = runScenario(path.join(SCENARIOS, 'full-pipeline-lifecycle', 'scenario.json'));

    assertScenarioExpectations(result);
    assertTraceInvariants(result.events, result.execution);

    const eventTypes = result.events.map((event) => event.type);
    expect(eventTypes).toContain('PipelineInitialized');
    expect(eventTypes).toContain('StageStarted');
    expect(eventTypes).toContain('ArtifactRecorded');
    expect(eventTypes).toContain('StageCompleted');
    expect(eventTypes.filter((t) => t === 'StageStarted').length).toBe(4);
    expect(eventTypes.filter((t) => t === 'StageCompleted').length).toBe(4);
  });
});
