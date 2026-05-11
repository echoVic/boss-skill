import { EventEmitter } from 'node:events';

import { describe, expect, it, vi } from 'vitest';

import { createOpenUrl } from '../../packages/boss-cli/src/runtime/design/open.js';
import { renderUiDesignHtml } from '../../packages/boss-cli/src/runtime/design/render.js';
import { validateUiDesignArtifact, type UiDesignArtifact } from '../../packages/boss-cli/src/runtime/design/schema.js';
import { startUiDesignPreviewServer } from '../../packages/boss-cli/src/runtime/design/server.js';

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

  it('escapes malicious page, frame, component, and validation error values', () => {
    const malicious = structuredClone(design);
    malicious.pages[0]!.name = '<script>alert("page")</script>';
    malicious.pages[0]!.frames[0]!.name = '<img src=x onerror=alert("frame")>';
    malicious.components[0]!.name = '<svg onload=alert("component")>';

    const html = renderUiDesignHtml(malicious, validateUiDesignArtifact(malicious));
    const errorHtml = renderUiDesignHtml(malicious, {
      ok: false,
      errors: ['<script>alert("error")</script>']
    });

    expect(html).not.toContain('<script>alert("page")</script>');
    expect(html).not.toContain('<img src=x onerror=alert("frame")>');
    expect(html).not.toContain('<svg onload=alert("component")>');
    expect(html).toContain('&lt;script&gt;alert(&quot;page&quot;)&lt;/script&gt;');
    expect(html).toContain('&lt;img src=x onerror=alert(&quot;frame&quot;)&gt;');
    expect(html).toContain('&lt;svg onload=alert(&quot;component&quot;)&gt;');
    expect(errorHtml).not.toContain('<script>alert("error")</script>');
    expect(errorHtml).toContain('&lt;script&gt;alert(&quot;error&quot;)&lt;/script&gt;');
  });

  it('includes interaction script and data needed to switch pages, prototype links, and viewports', () => {
    const html = renderUiDesignHtml(design, validateUiDesignArtifact(design));

    expect(html).toContain('<script>');
    expect(html).toContain("function switchPage(pageId)");
    expect(html).toContain("document.querySelectorAll('.page-tab')");
    expect(html).toContain("document.querySelectorAll('[data-target-page]')");
    expect(html).toContain("function switchViewport(viewport)");
    expect(html).toContain('data-page-id="success"');
    expect(html).toContain('data-target-page="success"');
    expect(html).toContain('viewport-mobile');
  });

  it('coerces malformed viewport dimensions before interpolating style values', () => {
    const malformed = structuredClone(design) as unknown as UiDesignArtifact;
    (malformed.pages[0]!.viewport as unknown) = {
      width: '1440; background: url(javascript:alert(1))',
      height: Number.POSITIVE_INFINITY
    };

    const html = renderUiDesignHtml(malformed, validateUiDesignArtifact(malformed));

    expect(html).not.toContain('javascript:alert(1)');
    expect(html).toContain('--viewport-width:1440px');
    expect(html).toContain('--viewport-height:960px');
    expect(html).toContain('1440 x 960');
  });
});

describe('ui design preview server', () => {
  it('serves health JSON, renders HTML for other paths, returns the actual port URL, and closes idempotently', async () => {
    const preview = await startUiDesignPreviewServer('<!doctype html><p>preview</p>');

    expect(preview.url).toMatch(/^http:\/\/localhost:\d+$/);

    const health = await fetch(`${preview.url}/healthz?x=1`);
    expect(health.headers.get('content-type')).toContain('application/json');
    expect(await health.json()).toEqual({ ok: true });

    const page = await fetch(`${preview.url}/checkout`);
    expect(page.headers.get('content-type')).toContain('text/html');
    expect(await page.text()).toBe('<!doctype html><p>preview</p>');

    await preview.close();
    await preview.close();
  });
});

describe('ui design preview opener', () => {
  it('attaches an error listener so async spawn failures are handled', () => {
    const child = new EventEmitter() as EventEmitter & { unref: () => void };
    child.unref = vi.fn();
    const spawn = vi.fn(() => child);
    const openUrl = createOpenUrl(spawn, 'linux');

    expect(openUrl('http://localhost:3000')).toBe(true);
    expect(child.listenerCount('error')).toBeGreaterThan(0);
    expect(() => child.emit('error', new Error('ENOENT'))).not.toThrow();
    expect(child.unref).toHaveBeenCalledOnce();
  });
});
