import { describe, expect, it } from 'vitest';

import * as gates from '../../packages/boss-cli/src/runtime/application/gates.js';
import * as runtime from '../../packages/boss-cli/src/runtime/application/pipeline.js';

describe('pipeline exports', () => {
  it('provides the expected pipeline operations', () => {
    const expected = [
      'initPipeline',
      'getReadyArtifacts',
      'recordArtifact',
      'updateStage',
      'updateAgent'
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
