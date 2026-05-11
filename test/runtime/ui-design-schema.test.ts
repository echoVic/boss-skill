import { describe, expect, it } from 'vitest';

import {
  validateUiDesignArtifact,
  type UiDesignArtifact
} from '../../packages/boss-cli/src/runtime/design/schema.js';

function minimalDesign(overrides: Partial<UiDesignArtifact> = {}): UiDesignArtifact {
  return {
    schemaVersion: '1.0.0',
    artifact: 'ui-design',
    mode: 'wireframe',
    feature: 'checkout-flow',
    updatedAt: '2026-05-11T10:00:00Z',
    tokens: { colors: {}, typography: {}, spacing: {}, radius: {} },
    pages: [
      {
        id: 'checkout',
        name: 'Checkout',
        route: '/checkout',
        viewport: { width: 1440, height: 960 },
        frames: [
          { id: 'checkout-main', type: 'page', name: 'Checkout Main', layout: 'vertical', children: [] }
        ],
        states: []
      }
    ],
    components: [],
    prototype: { startPageId: 'checkout', links: [] },
    implementationHints: {
      preferredFramework: 'react',
      requiredComponents: [],
      accessibilityNotes: []
    },
    ...overrides
  };
}

describe('ui design artifact validation', () => {
  it('accepts a minimal wireframe artifact', () => {
    expect(validateUiDesignArtifact(minimalDesign())).toEqual({ ok: true, errors: [] });
  });

  it('rejects invalid mode and empty pages', () => {
    const result = validateUiDesignArtifact(minimalDesign({
      mode: 'sketch' as UiDesignArtifact['mode'],
      pages: []
    }));

    expect(result.ok).toBe(false);
    expect(result.errors).toContain('mode must be wireframe or hifi');
    expect(result.errors).toContain('pages must contain at least one page');
  });

  it('rejects invalid prototype page references', () => {
    const result = validateUiDesignArtifact(minimalDesign({
      prototype: {
        startPageId: 'missing',
        links: [{ sourceId: 'checkout-main', targetPageId: 'missing-page' }]
      }
    }));

    expect(result.ok).toBe(false);
    expect(result.errors).toContain('prototype.startPageId must reference an existing page id');
    expect(result.errors).toContain('prototype.links[0].targetPageId must reference an existing page id');
  });

  it('rejects duplicate ids across pages, frames, and components', () => {
    const result = validateUiDesignArtifact(minimalDesign({
      components: [{ id: 'checkout-main', name: 'Card', type: 'card' }]
    }));

    expect(result.ok).toBe(false);
    expect(result.errors).toContain('duplicate id: checkout-main');
  });

  it('requires non-empty token sections for hifi mode', () => {
    const result = validateUiDesignArtifact(minimalDesign({ mode: 'hifi' }));

    expect(result.ok).toBe(false);
    expect(result.errors).toContain('hifi mode requires non-empty tokens.colors');
    expect(result.errors).toContain('hifi mode requires non-empty tokens.typography');
    expect(result.errors).toContain('hifi mode requires non-empty tokens.spacing');
    expect(result.errors).toContain('hifi mode requires non-empty tokens.radius');
  });
});
