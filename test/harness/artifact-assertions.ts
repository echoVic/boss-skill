import fs from 'node:fs';
import path from 'node:path';
import { expect } from 'vitest';
import type { ScenarioRunResult } from './scenario-runner.js';

function getPath(value: unknown, dottedPath: string): unknown {
  return dottedPath.split('.').reduce<unknown>((current, part) => {
    if (current && typeof current === 'object' && part in current) {
      return (current as Record<string, unknown>)[part];
    }
    return undefined;
  }, value);
}

function expectedExitFor(result: ScenarioRunResult, command: string[]): number {
  return result.scenario.commands.find((candidate) => candidate.run === command)?.expectExit ?? 0;
}

export function assertScenarioExpectations(result: ScenarioRunResult): void {
  for (const command of result.commands) {
    const expected = expectedExitFor(result, command.command);
    expect(
      command.exitCode,
      `${command.command.join(' ')}\nstdout:\n${command.stdout}\nstderr:\n${command.stderr}`
    ).toBe(expected);
  }

  for (const artifact of result.scenario.expect.artifacts ?? []) {
    expect(fs.existsSync(path.join(result.workspace, artifact)), `missing artifact ${artifact}`).toBe(true);
  }

  for (const forbidden of result.scenario.expect.forbidPaths ?? []) {
    expect(fs.existsSync(path.join(result.workspace, forbidden)), `forbidden path exists ${forbidden}`).toBe(false);
  }

  const eventTypes = result.events.map((event) => event.type);
  for (const eventType of result.scenario.expect.events ?? []) {
    expect(eventTypes, `missing event ${eventType}`).toContain(eventType);
  }

  for (const [statePath, expected] of Object.entries(result.scenario.expect.state ?? {})) {
    expect(getPath(result.execution, statePath), `state path ${statePath}`).toEqual(expected);
  }
}
