import { describe, expect, it } from 'vitest';

import { renderUiDesignHtml } from '../../packages/boss-cli/src/runtime/design/render.js';
import { validateUiDesignArtifact, type UiDesignArtifact } from '../../packages/boss-cli/src/runtime/design/schema.js';

const design: UiDesignArtifact = {
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
        {
          id: 'checkout-main',
          type: 'page',
          name: 'Checkout Main',
          layout: 'vertical',
          children: [
            { id: 'pay-button', type: 'button', name: 'Pay now', layout: 'horizontal', children: [] }
          ]
        }
      ],
      states: []
    },
    {
      id: 'success',
      name: 'Success',
      route: '/success',
      viewport: { width: 1440, height: 960 },
      frames: [
        { id: 'success-main', type: 'page', name: 'Success Main', layout: 'vertical', children: [] }
      ],
      states: []
    }
  ],
  components: [{ id: 'button', name: 'Button', type: 'button' }],
  prototype: {
    startPageId: 'checkout',
    links: [{ sourceId: 'pay-button', targetPageId: 'success' }]
  },
  implementationHints: {
    preferredFramework: 'react',
    requiredComponents: ['Button'],
    accessibilityNotes: ['Buttons need visible focus states']
  }
};

describe('ui design renderer', () => {
  it('renders a non-empty prototype shell', () => {
    const html = renderUiDesignHtml(design, validateUiDesignArtifact(design));

    expect(html).toContain('<!doctype html>');
    expect(html).toContain('Checkout');
    expect(html).toContain('Pay now');
    expect(html).toContain('data-target-page="success"');
    expect(html).toContain('Desktop');
    expect(html).toContain('Tablet');
    expect(html).toContain('Mobile');
  });

  it('renders validation errors instead of a blank page', () => {
    const invalid = { ...design, pages: [] };
    const validation = validateUiDesignArtifact(invalid);
    const html = renderUiDesignHtml(invalid as UiDesignArtifact, validation);

    expect(validation.ok).toBe(false);
    expect(html).toContain('UI Design JSON validation failed');
    expect(html).toContain('pages must contain at least one page');
  });
});
