import { describe, expect, it } from 'vitest';

import * as gates from '../../skill/cli/runtime/application/gates.mts';
import * as runtime from '../../skill/cli/runtime/application/pipeline.mts';

describe('pipeline exports', () => {
  it('provides the expected pipeline operations', () => {
    const expected = [
      'initPipeline',
      'getReadyArtifacts',
      'recordArtifact',
      'updateStage',
      'updateAgent',
      'pausePipeline',
      'evaluateAgentReuse',
    ];

    for (const name of expected) {
      expect(typeof (runtime as Record<string, unknown>)[name]).toBe('function');
    }
  });

  it('provides gate operations from the gates module', () => {
    expect(typeof gates.evaluateGates).toBe('function');
    expect(typeof gates.resolveGateConfig).toBe('function');
    expect((runtime as Record<string, unknown>).evaluateGates).toBeUndefined();
  });
});
