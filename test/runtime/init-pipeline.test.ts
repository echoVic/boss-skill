import { describe, expect, it } from 'vitest';

import * as runtime from '../../src/runtime/cli/lib/pipeline-runtime.js';

describe('pipeline-runtime exports', () => {
  it('provides the expected phase-2 operations', () => {
    const expected = [
      'initPipeline',
      'getReadyArtifacts',
      'recordArtifact',
      'updateStage',
      'updateAgent',
      'evaluateGates'
    ];

    for (const name of expected) {
      expect(typeof (runtime as Record<string, unknown>)[name]).toBe('function');
    }
  });
});
