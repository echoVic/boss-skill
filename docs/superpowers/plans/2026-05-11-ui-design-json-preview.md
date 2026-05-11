# UI Design JSON Preview Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `ui-design.json` as a first-class Boss UI artifact and provide a CLI browser preview for the JSON prototype.

**Architecture:** Introduce a small design runtime module under `packages/boss-cli/src/runtime/design/` for validation, rendering, and local preview serving. Wire the new artifact into the DAG and prompts, then expose it through a new `boss design preview <feature>` command group.

**Tech Stack:** TypeScript, Node.js standard library HTTP server, Vitest, existing Boss CLI contract utilities.

---

## File Structure

- Create `packages/boss-cli/src/runtime/schema/ui-design-schema.json`: JSON Schema for the design artifact.
- Create `packages/boss-cli/src/runtime/design/schema.ts`: runtime validator for semantic checks that JSON Schema cannot express cleanly.
- Create `packages/boss-cli/src/runtime/design/render.ts`: pure HTML renderer for preview pages.
- Create `packages/boss-cli/src/runtime/design/server.ts`: local HTTP server wrapper around rendered HTML.
- Create `packages/boss-cli/src/runtime/design/open.ts`: cross-platform browser opener using Node child processes.
- Create `packages/boss-cli/src/commands/design/preview.ts`: CLI command implementation.
- Modify `packages/boss-cli/src/cli/registry.ts`: command metadata for `boss design` and `boss design preview`.
- Modify `packages/boss-cli/src/cli/help.ts`: help text for the new command group.
- Modify `packages/boss-cli/src/cli/dispatcher.ts`: `runDesignCommand`.
- Modify `packages/boss-cli/src/bin/boss.ts`: route the new top-level `design` command.
- Modify `packages/boss-cli/assets/artifact-dag.json`: add `ui-design.json` and update `tech-review.md` dependencies.
- Modify pipeline packs in `packages/boss-cli/assets/pipeline-packs/*/pipeline.json`: include UI design behavior for UI-capable packs.
- Modify `packages/boss-cli/src/runtime/application/pipeline.ts`: skip `ui-design.json` when `skipUI` is true.
- Create `skill/templates/ui-design.json.template`: initial machine-readable artifact template.
- Modify `packages/boss-cli/src/commands/project/index.ts`: add `ui-design.json` lightweight workspace file.
- Modify `skill/agents/boss-ui-designer.md`: require JSON output and preview.
- Modify `skill/agents/boss-frontend.md`: prioritize JSON design.
- Modify `skill/agents/boss-tech-lead.md`: review JSON design.
- Modify `skill/templates/tech-review.md.template`: mention `ui-design.json`.
- Modify `skill/SKILL.md` and relevant references to include the new artifact flow.
- Modify `.gitignore`: add `.superpowers/` for local visual companion artifacts.
- Add tests under `test/runtime/`, `test/cli/`, and `test/bin/` as described below.

## Task 1: UI Design Schema and Validator

**Files:**
- Create: `packages/boss-cli/src/runtime/schema/ui-design-schema.json`
- Create: `packages/boss-cli/src/runtime/design/schema.ts`
- Modify: `test/runtime/schema-contract.test.ts`
- Create: `test/runtime/ui-design-schema.test.ts`

- [ ] **Step 1: Write failing schema contract test**

Add to `test/runtime/schema-contract.test.ts`:

```ts
it('ui design schema requires the renderable design artifact shape', () => {
  const schema = loadJson('packages/boss-cli/src/runtime/schema/ui-design-schema.json');

  expect(schema.properties.artifact.const).toBe('ui-design');
  expect(schema.properties.mode.enum).toEqual(['wireframe', 'hifi']);
  expect(schema.required).toEqual([
    'schemaVersion',
    'artifact',
    'mode',
    'feature',
    'updatedAt',
    'tokens',
    'pages',
    'components',
    'prototype',
    'implementationHints'
  ]);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
npm test -- test/runtime/schema-contract.test.ts -t "ui design schema requires"
```

Expected: FAIL because `ui-design-schema.json` does not exist.

- [ ] **Step 3: Add schema file**

Create `packages/boss-cli/src/runtime/schema/ui-design-schema.json`:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "title": "Boss UI Design Artifact",
  "type": "object",
  "additionalProperties": false,
  "required": [
    "schemaVersion",
    "artifact",
    "mode",
    "feature",
    "updatedAt",
    "tokens",
    "pages",
    "components",
    "prototype",
    "implementationHints"
  ],
  "properties": {
    "schemaVersion": { "type": "string", "minLength": 1 },
    "artifact": { "const": "ui-design" },
    "mode": { "type": "string", "enum": ["wireframe", "hifi"] },
    "feature": { "type": "string", "minLength": 1 },
    "updatedAt": { "type": "string", "minLength": 1 },
    "tokens": {
      "type": "object",
      "additionalProperties": true,
      "required": ["colors", "typography", "spacing", "radius"],
      "properties": {
        "colors": { "type": "object", "additionalProperties": true },
        "typography": { "type": "object", "additionalProperties": true },
        "spacing": { "type": "object", "additionalProperties": true },
        "radius": { "type": "object", "additionalProperties": true }
      }
    },
    "pages": {
      "type": "array",
      "minItems": 1,
      "items": { "$ref": "#/$defs/page" }
    },
    "components": {
      "type": "array",
      "items": { "$ref": "#/$defs/component" }
    },
    "prototype": {
      "type": "object",
      "additionalProperties": false,
      "required": ["startPageId", "links"],
      "properties": {
        "startPageId": { "type": "string", "minLength": 1 },
        "links": {
          "type": "array",
          "items": { "$ref": "#/$defs/prototypeLink" }
        }
      }
    },
    "implementationHints": {
      "type": "object",
      "additionalProperties": true,
      "required": ["preferredFramework", "requiredComponents", "accessibilityNotes"],
      "properties": {
        "preferredFramework": { "type": "string" },
        "requiredComponents": { "type": "array", "items": { "type": "string" } },
        "accessibilityNotes": { "type": "array", "items": { "type": "string" } }
      }
    }
  },
  "$defs": {
    "page": {
      "type": "object",
      "additionalProperties": true,
      "required": ["id", "name", "route", "viewport", "frames", "states"],
      "properties": {
        "id": { "type": "string", "minLength": 1 },
        "name": { "type": "string", "minLength": 1 },
        "route": { "type": "string", "minLength": 1 },
        "viewport": {
          "type": "object",
          "additionalProperties": false,
          "required": ["width", "height"],
          "properties": {
            "width": { "type": "number", "minimum": 1 },
            "height": { "type": "number", "minimum": 1 }
          }
        },
        "frames": { "type": "array", "items": { "$ref": "#/$defs/frame" } },
        "states": { "type": "array", "items": { "type": "string" } }
      }
    },
    "frame": {
      "type": "object",
      "additionalProperties": true,
      "required": ["id", "type", "layout", "children"],
      "properties": {
        "id": { "type": "string", "minLength": 1 },
        "type": { "type": "string", "minLength": 1 },
        "name": { "type": "string" },
        "layout": { "type": "string", "enum": ["vertical", "horizontal", "grid", "absolute"] },
        "componentId": { "type": "string" },
        "children": { "type": "array", "items": { "$ref": "#/$defs/frame" } }
      }
    },
    "component": {
      "type": "object",
      "additionalProperties": true,
      "required": ["id", "name", "type"],
      "properties": {
        "id": { "type": "string", "minLength": 1 },
        "name": { "type": "string", "minLength": 1 },
        "type": { "type": "string", "minLength": 1 }
      }
    },
    "prototypeLink": {
      "type": "object",
      "additionalProperties": false,
      "required": ["sourceId", "targetPageId"],
      "properties": {
        "sourceId": { "type": "string", "minLength": 1 },
        "targetPageId": { "type": "string", "minLength": 1 },
        "interaction": { "type": "string", "default": "click" }
      }
    }
  }
}
```

- [ ] **Step 4: Run schema contract test**

Run:

```bash
npm test -- test/runtime/schema-contract.test.ts -t "ui design schema requires"
```

Expected: PASS.

- [ ] **Step 5: Write failing semantic validator tests**

Create `test/runtime/ui-design-schema.test.ts`:

```ts
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
```

- [ ] **Step 6: Run validator tests to verify they fail**

Run:

```bash
npm test -- test/runtime/ui-design-schema.test.ts
```

Expected: FAIL because `runtime/design/schema.ts` does not exist.

- [ ] **Step 7: Implement semantic validator**

Create `packages/boss-cli/src/runtime/design/schema.ts`:

```ts
export interface UiDesignFrame {
  id: string;
  type: string;
  name?: string;
  layout: 'vertical' | 'horizontal' | 'grid' | 'absolute';
  componentId?: string;
  children: UiDesignFrame[];
}

export interface UiDesignPage {
  id: string;
  name: string;
  route: string;
  viewport: { width: number; height: number };
  frames: UiDesignFrame[];
  states: string[];
}

export interface UiDesignComponent {
  id: string;
  name: string;
  type: string;
}

export interface UiDesignPrototypeLink {
  sourceId: string;
  targetPageId: string;
  interaction?: string;
}

export interface UiDesignArtifact {
  schemaVersion: string;
  artifact: 'ui-design';
  mode: 'wireframe' | 'hifi';
  feature: string;
  updatedAt: string;
  tokens: {
    colors: Record<string, unknown>;
    typography: Record<string, unknown>;
    spacing: Record<string, unknown>;
    radius: Record<string, unknown>;
  };
  pages: UiDesignPage[];
  components: UiDesignComponent[];
  prototype: {
    startPageId: string;
    links: UiDesignPrototypeLink[];
  };
  implementationHints: {
    preferredFramework: string;
    requiredComponents: string[];
    accessibilityNotes: string[];
  };
}

export interface UiDesignValidationResult {
  ok: boolean;
  errors: string[];
}

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function hasKeys(value: Record<string, unknown>): boolean {
  return Object.keys(value).length > 0;
}

function collectFrameIds(frames: UiDesignFrame[], ids: string[], errors: string[]): void {
  for (const frame of frames) {
    if (!frame.id) errors.push('frame id is required');
    ids.push(frame.id);
    collectFrameIds(Array.isArray(frame.children) ? frame.children : [], ids, errors);
  }
}

export function validateUiDesignArtifact(value: unknown): UiDesignValidationResult {
  const errors: string[] = [];
  if (!isObject(value)) return { ok: false, errors: ['artifact must be an object'] };

  const artifact = value as Partial<UiDesignArtifact>;
  if (artifact.artifact !== 'ui-design') errors.push('artifact must be ui-design');
  if (artifact.mode !== 'wireframe' && artifact.mode !== 'hifi') {
    errors.push('mode must be wireframe or hifi');
  }
  if (!Array.isArray(artifact.pages) || artifact.pages.length === 0) {
    errors.push('pages must contain at least one page');
  }

  const pageIds = new Set<string>();
  const allIds: string[] = [];
  for (const page of artifact.pages ?? []) {
    pageIds.add(page.id);
    allIds.push(page.id);
    collectFrameIds(Array.isArray(page.frames) ? page.frames : [], allIds, errors);
  }
  for (const component of artifact.components ?? []) {
    allIds.push(component.id);
  }

  const seen = new Set<string>();
  for (const id of allIds.filter(Boolean)) {
    if (seen.has(id)) errors.push(`duplicate id: ${id}`);
    seen.add(id);
  }

  if (artifact.prototype?.startPageId && !pageIds.has(artifact.prototype.startPageId)) {
    errors.push('prototype.startPageId must reference an existing page id');
  }
  for (const [index, link] of (artifact.prototype?.links ?? []).entries()) {
    if (!pageIds.has(link.targetPageId)) {
      errors.push(`prototype.links[${index}].targetPageId must reference an existing page id`);
    }
  }

  if (artifact.mode === 'hifi') {
    for (const section of ['colors', 'typography', 'spacing', 'radius'] as const) {
      const tokens = artifact.tokens?.[section];
      if (!tokens || !hasKeys(tokens)) errors.push(`hifi mode requires non-empty tokens.${section}`);
    }
  }

  return { ok: errors.length === 0, errors };
}
```

- [ ] **Step 8: Run validator tests to verify they pass**

Run:

```bash
npm test -- test/runtime/ui-design-schema.test.ts test/runtime/schema-contract.test.ts
```

Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add packages/boss-cli/src/runtime/schema/ui-design-schema.json packages/boss-cli/src/runtime/design/schema.ts test/runtime/schema-contract.test.ts test/runtime/ui-design-schema.test.ts
git commit -m "feat: add UI design artifact schema"
```

## Task 2: DAG, Pack, Template, and Skip Behavior

**Files:**
- Modify: `packages/boss-cli/assets/artifact-dag.json`
- Modify: `packages/boss-cli/assets/pipeline-packs/default/pipeline.json`
- Modify: `packages/boss-cli/assets/pipeline-packs/web-app/pipeline.json`
- Modify: `packages/boss-cli/src/runtime/application/pipeline.ts`
- Modify: `packages/boss-cli/src/commands/project/index.ts`
- Create: `skill/templates/ui-design.json.template`
- Modify: `test/harness/artifact-dag.test.ts`
- Modify: `test/lib/boss-utils.test.ts`
- Modify: `test/runtime/get-ready-artifacts.test.ts`

- [ ] **Step 1: Write failing DAG tests**

Update `test/harness/artifact-dag.test.ts`:

```ts
it('DAG defines ui-design.json as a first-class UI artifact', () => {
  const dag = JSON.parse(fs.readFileSync(DAG_PATH, 'utf8')) as {
    artifacts: Record<string, { inputs?: string[]; agent?: string; stage?: number; optional?: boolean }>;
  };

  expect(dag.artifacts['ui-design.json']).toEqual({
    inputs: ['prd.md'],
    agent: 'boss-ui-designer',
    stage: 1,
    optional: true,
    description: '可渲染 UI 原型与机器约束 JSON'
  });
  expect(dag.artifacts['tech-review.md']?.inputs).toContain('ui-design.json');
});

it('--ready returns architecture.md, ui-spec.md, and ui-design.json after prd.md done', () => {
  const execPath = path.join(tmpDir, '.boss', 'test-feat', '.meta', 'execution.json');
  const data = JSON.parse(fs.readFileSync(execPath, 'utf8')) as {
    stages: { '1': { artifacts: string[] } };
  };
  data.stages['1'].artifacts = ['prd.md'];
  fs.writeFileSync(execPath, JSON.stringify(data, null, 2), 'utf8');

  const ready = JSON.parse(runCli(['test-feat', '--ready', '--dag', DAG_PATH, '--json'])) as string[];
  expect(ready).toContain('architecture.md');
  expect(ready).toContain('ui-spec.md');
  expect(ready).toContain('ui-design.json');
});

it('skips ui-design.json when skipUI is true', () => {
  const execPath = path.join(tmpDir, '.boss', 'test-feat', '.meta', 'execution.json');
  const data = JSON.parse(fs.readFileSync(execPath, 'utf8')) as {
    parameters: { skipUI: boolean };
    stages: { '1': { artifacts: string[] } };
  };
  data.parameters.skipUI = true;
  data.stages['1'].artifacts = ['prd.md'];
  fs.writeFileSync(execPath, JSON.stringify(data, null, 2), 'utf8');

  const ready = JSON.parse(runCli(['test-feat', '--ready', '--dag', DAG_PATH, '--json'])) as string[];
  expect(ready).not.toContain('ui-spec.md');
  expect(ready).not.toContain('ui-design.json');
  expect(ready).toContain('architecture.md');
});
```

- [ ] **Step 2: Run DAG tests to verify they fail**

Run:

```bash
npm test -- test/harness/artifact-dag.test.ts
```

Expected: FAIL because `ui-design.json` is not in the DAG and `skipUI` does not cover it.

- [ ] **Step 3: Update default DAG**

Modify `packages/boss-cli/assets/artifact-dag.json`:

```json
"ui-design.json": {
  "inputs": ["prd.md"],
  "agent": "boss-ui-designer",
  "stage": 1,
  "optional": true,
  "description": "可渲染 UI 原型与机器约束 JSON"
},
"tech-review.md": {
  "inputs": ["architecture.md", "ui-spec.md", "ui-design.json"],
  "agent": "boss-tech-lead",
  "stage": 2,
  "optional": false,
  "description": "技术评审报告"
}
```

- [ ] **Step 4: Update skip behavior**

Modify `packages/boss-cli/src/runtime/application/pipeline.ts` in `isArtifactSkipped`:

```ts
if ((artifact === 'ui-spec.md' || artifact === 'ui-design.json') && params.skipUI === true) return true;
```

- [ ] **Step 5: Add template and project workspace stub**

Create `skill/templates/ui-design.json.template`:

```json
{
  "schemaVersion": "1.0.0",
  "artifact": "ui-design",
  "mode": "wireframe",
  "feature": "{{FEATURE_NAME}}",
  "updatedAt": "{{DATE}}T00:00:00Z",
  "tokens": {
    "colors": {},
    "typography": {},
    "spacing": {},
    "radius": {}
  },
  "pages": [
    {
      "id": "main",
      "name": "{{FEATURE_NAME}}",
      "route": "/",
      "viewport": { "width": 1440, "height": 960 },
      "frames": [
        {
          "id": "main-page",
          "type": "page",
          "name": "{{FEATURE_NAME}}",
          "layout": "vertical",
          "children": []
        }
      ],
      "states": []
    }
  ],
  "components": [],
  "prototype": {
    "startPageId": "main",
    "links": []
  },
  "implementationHints": {
    "preferredFramework": "react",
    "requiredComponents": [],
    "accessibilityNotes": []
  }
}
```

Modify `PLACEHOLDERS` in `packages/boss-cli/src/commands/project/index.ts` to include:

```ts
{ file: 'ui-design.json', title: 'UI Design JSON', infoTitle: 'Artifact Info', agent: 'UI Designer Agent' },
```

Then update `writePlaceholder` to write valid JSON for this file:

```ts
if (item.file.endsWith('.json')) {
  fs.writeFileSync(
    path.join(targetDir, item.file),
    `${JSON.stringify({
      schemaVersion: '1.0.0',
      artifact: 'ui-design',
      mode: 'wireframe',
      feature,
      updatedAt: `${date}T00:00:00Z`,
      tokens: { colors: {}, typography: {}, spacing: {}, radius: {} },
      pages: [],
      components: [],
      prototype: { startPageId: '', links: [] },
      implementationHints: {
        preferredFramework: '',
        requiredComponents: [],
        accessibilityNotes: []
      }
    }, null, 2)}\n`,
    'utf8'
  );
  return;
}
```

- [ ] **Step 6: Update pipeline packs**

In `packages/boss-cli/assets/pipeline-packs/default/pipeline.json` and `packages/boss-cli/assets/pipeline-packs/web-app/pipeline.json`, keep `boss-ui-designer` in `agents` and leave `skipUI: false`. Add this config key:

```json
"designPreview": true
```

Do not add UI designer to `api-only` or `core` packs if those packs do not currently include it.

- [ ] **Step 7: Run DAG-related tests**

Run:

```bash
npm test -- test/harness/artifact-dag.test.ts test/lib/boss-utils.test.ts test/runtime/get-ready-artifacts.test.ts
```

Expected: PASS after updating any existing expectations that enumerate ready UI artifacts.

- [ ] **Step 8: Commit**

```bash
git add packages/boss-cli/assets/artifact-dag.json packages/boss-cli/assets/pipeline-packs/default/pipeline.json packages/boss-cli/assets/pipeline-packs/web-app/pipeline.json packages/boss-cli/src/runtime/application/pipeline.ts packages/boss-cli/src/commands/project/index.ts skill/templates/ui-design.json.template test/harness/artifact-dag.test.ts test/lib/boss-utils.test.ts test/runtime/get-ready-artifacts.test.ts
git commit -m "feat: add UI design artifact to pipeline"
```

## Task 3: Preview Renderer and Server Runtime

**Files:**
- Create: `packages/boss-cli/src/runtime/design/render.ts`
- Create: `packages/boss-cli/src/runtime/design/server.ts`
- Create: `packages/boss-cli/src/runtime/design/open.ts`
- Create: `test/runtime/ui-design-renderer.test.ts`

- [ ] **Step 1: Write failing renderer tests**

Create `test/runtime/ui-design-renderer.test.ts`:

```ts
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
```

- [ ] **Step 2: Run renderer tests to verify they fail**

Run:

```bash
npm test -- test/runtime/ui-design-renderer.test.ts
```

Expected: FAIL because `render.ts` does not exist.

- [ ] **Step 3: Implement renderer**

Create `packages/boss-cli/src/runtime/design/render.ts`:

```ts
import type { UiDesignArtifact, UiDesignFrame, UiDesignValidationResult } from './schema.js';

function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function renderFrame(frame: UiDesignFrame, linksBySource: Map<string, string>): string {
  const target = linksBySource.get(frame.id);
  const attrs = target ? ` data-target-page="${escapeHtml(target)}" role="button" tabindex="0"` : '';
  const children = frame.children.map((child) => renderFrame(child, linksBySource)).join('');
  return [
    `<div class="frame frame-${escapeHtml(frame.layout)}"${attrs}>`,
    `<div class="frame-meta"><span>${escapeHtml(frame.type)}</span><strong>${escapeHtml(frame.name || frame.id)}</strong></div>`,
    children ? `<div class="frame-children">${children}</div>` : '<div class="empty-frame">No child frames</div>',
    '</div>'
  ].join('');
}

function renderError(validation: UiDesignValidationResult): string {
  const items = validation.errors.map((error) => `<li>${escapeHtml(error)}</li>`).join('');
  return `<main class="error"><h1>UI Design JSON validation failed</h1><ul>${items}</ul></main>`;
}

function renderPrototype(design: UiDesignArtifact): string {
  const startPage = design.pages.find((page) => page.id === design.prototype.startPageId) ?? design.pages[0]!;
  const linksBySource = new Map(design.prototype.links.map((link) => [link.sourceId, link.targetPageId]));
  const pageButtons = design.pages
    .map((page) => `<button class="page-tab" data-page="${escapeHtml(page.id)}">${escapeHtml(page.name)}</button>`)
    .join('');
  const frames = startPage.frames.map((frame) => renderFrame(frame, linksBySource)).join('');
  const components = design.components.map((component) => `<li>${escapeHtml(component.name)} <span>${escapeHtml(component.type)}</span></li>`).join('');
  return [
    '<div class="app-shell">',
    `<aside><h1>${escapeHtml(design.feature)}</h1><p>${escapeHtml(design.mode)}</p><nav>${pageButtons}</nav></aside>`,
    '<main>',
    '<div class="toolbar"><button>Desktop</button><button>Tablet</button><button>Mobile</button></div>',
    `<section class="canvas" data-current-page="${escapeHtml(startPage.id)}">${frames}</section>`,
    '</main>',
    `<aside class="inspector"><h2>${escapeHtml(startPage.route)}</h2><h3>Components</h3><ul>${components}</ul></aside>`,
    '</div>'
  ].join('');
}

export function renderUiDesignHtml(design: UiDesignArtifact, validation: UiDesignValidationResult): string {
  const body = validation.ok ? renderPrototype(design) : renderError(validation);
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Boss UI Design Preview</title>
  <style>
    * { box-sizing: border-box; }
    body { margin: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; background: #f8fafc; color: #111827; }
    .app-shell { min-height: 100vh; display: grid; grid-template-columns: 240px minmax(0, 1fr) 280px; }
    aside { padding: 20px; border-right: 1px solid #d1d5db; background: #ffffff; }
    .inspector { border-right: 0; border-left: 1px solid #d1d5db; }
    main { min-width: 0; }
    h1, h2, h3 { margin: 0 0 12px; }
    nav, .toolbar { display: flex; gap: 8px; flex-wrap: wrap; }
    .toolbar { padding: 14px 18px; border-bottom: 1px solid #d1d5db; background: #ffffff; }
    button { border: 1px solid #cbd5e1; background: #ffffff; border-radius: 6px; padding: 8px 10px; cursor: pointer; }
    .canvas { margin: 24px auto; max-width: 1040px; min-height: 640px; border: 1px solid #cbd5e1; border-radius: 8px; background: #ffffff; padding: 20px; }
    .frame { border: 1px dashed #94a3b8; border-radius: 8px; padding: 14px; margin: 12px 0; background: #f8fafc; }
    .frame-horizontal > .frame-children { display: flex; gap: 12px; }
    .frame-grid > .frame-children { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
    .frame-meta { display: flex; justify-content: space-between; gap: 12px; color: #475569; font-size: 13px; }
    .frame[data-target-page] { border-style: solid; border-color: #2563eb; cursor: pointer; }
    .empty-frame { color: #94a3b8; font-size: 13px; padding-top: 10px; }
    .error { margin: 40px auto; max-width: 760px; border: 1px solid #fecaca; border-radius: 8px; background: #fff1f2; padding: 24px; }
  </style>
</head>
<body>${body}
<script>
document.querySelectorAll('[data-target-page]').forEach((node) => {
  node.addEventListener('click', () => {
    const target = node.getAttribute('data-target-page');
    window.location.hash = target || '';
  });
});
</script>
</body>
</html>`;
}
```

- [ ] **Step 4: Implement server and opener**

Create `packages/boss-cli/src/runtime/design/server.ts`:

```ts
import { createServer, type Server } from 'node:http';

export interface UiDesignPreviewServer {
  server: Server;
  url: string;
  close: () => Promise<void>;
}

export async function startUiDesignPreviewServer(html: string, port = 0): Promise<UiDesignPreviewServer> {
  const server = createServer((req, res) => {
    if (req.url === '/healthz') {
      res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ ok: true }));
      return;
    }
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    res.end(html);
  });

  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, '127.0.0.1', () => resolve());
  });

  const address = server.address();
  const actualPort = typeof address === 'object' && address ? address.port : port;
  return {
    server,
    url: `http://localhost:${actualPort}`,
    close: () => new Promise((resolve, reject) => server.close((err) => (err ? reject(err) : resolve())))
  };
}
```

Create `packages/boss-cli/src/runtime/design/open.ts`:

```ts
import { spawn } from 'node:child_process';

export function openUrl(url: string): boolean {
  const command = process.platform === 'darwin'
    ? 'open'
    : process.platform === 'win32'
      ? 'cmd'
      : 'xdg-open';
  const args = process.platform === 'win32' ? ['/c', 'start', '', url] : [url];
  const child = spawn(command, args, { detached: true, stdio: 'ignore' });
  child.unref();
  return true;
}
```

- [ ] **Step 5: Run renderer tests**

Run:

```bash
npm test -- test/runtime/ui-design-renderer.test.ts test/runtime/ui-design-schema.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/boss-cli/src/runtime/design/render.ts packages/boss-cli/src/runtime/design/server.ts packages/boss-cli/src/runtime/design/open.ts test/runtime/ui-design-renderer.test.ts
git commit -m "feat: render UI design previews"
```

## Task 4: `boss design preview` CLI Command

**Files:**
- Create: `packages/boss-cli/src/commands/design/preview.ts`
- Modify: `packages/boss-cli/src/cli/registry.ts`
- Modify: `packages/boss-cli/src/cli/help.ts`
- Modify: `packages/boss-cli/src/cli/dispatcher.ts`
- Modify: `packages/boss-cli/src/bin/boss.ts`
- Create: `test/cli/design-preview-cli.test.ts`
- Modify: `test/bin/boss-skill.test.ts`

- [ ] **Step 1: Write failing CLI tests**

Create `test/cli/design-preview-cli.test.ts`:

```ts
import { beforeEach, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const REPO_ROOT = path.resolve(import.meta.dirname, '..', '..');
const BOSS_BIN = path.join(REPO_ROOT, 'packages', 'boss-cli', 'dist', 'bin', 'boss.js');

function writeDesign(cwd: string, feature: string): void {
  const dir = path.join(cwd, '.boss', feature);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'ui-design.json'), JSON.stringify({
    schemaVersion: '1.0.0',
    artifact: 'ui-design',
    mode: 'wireframe',
    feature,
    updatedAt: '2026-05-11T10:00:00Z',
    tokens: { colors: {}, typography: {}, spacing: {}, radius: {} },
    pages: [
      {
        id: 'main',
        name: 'Main',
        route: '/',
        viewport: { width: 1440, height: 960 },
        frames: [{ id: 'main-page', type: 'page', name: 'Main Page', layout: 'vertical', children: [] }],
        states: []
      }
    ],
    components: [],
    prototype: { startPageId: 'main', links: [] },
    implementationHints: { preferredFramework: 'react', requiredComponents: [], accessibilityNotes: [] }
  }, null, 2));
}

describe('boss design preview CLI', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'boss-design-preview-'));
  });

  it('describes the design preview command', () => {
    const result = spawnSync(process.execPath, [BOSS_BIN, 'design', 'preview', '--describe'], {
      cwd: tmpDir,
      encoding: 'utf8'
    });

    expect(result.status).toBe(0);
    const payload = JSON.parse(result.stdout) as { command: string; options: Array<{ name: string }> };
    expect(payload.command).toBe('boss design preview');
    expect(payload.options.map((option) => option.name)).toContain('no-open');
    expect(payload.options.map((option) => option.name)).toContain('port');
  });

  it('validates and returns preview metadata in json mode without opening a browser', () => {
    writeDesign(tmpDir, 'checkout-flow');

    const result = spawnSync(process.execPath, [BOSS_BIN, 'design', 'preview', 'checkout-flow', '--json', '--no-open', '--port', '0'], {
      cwd: tmpDir,
      encoding: 'utf8',
      timeout: 4000
    });

    expect(result.status).toBe(0);
    const payload = JSON.parse(result.stdout) as {
      feature: string;
      artifact: string;
      url: string;
      mode: string;
      opened: boolean;
      valid: boolean;
    };
    expect(payload.feature).toBe('checkout-flow');
    expect(payload.artifact).toBe('.boss/checkout-flow/ui-design.json');
    expect(payload.url).toMatch(/^http:\/\/localhost:\d+/);
    expect(payload.mode).toBe('wireframe');
    expect(payload.opened).toBe(false);
    expect(payload.valid).toBe(true);
  });

  it('returns a structured error when ui-design.json is missing', () => {
    const result = spawnSync(process.execPath, [BOSS_BIN, 'design', 'preview', 'missing-feature', '--json', '--no-open'], {
      cwd: tmpDir,
      encoding: 'utf8'
    });

    expect(result.status).toBe(1);
    const payload = JSON.parse(result.stderr) as { error: { code: string } };
    expect(payload.error.code).toBe('ui_design_not_found');
  });
});
```

Update `test/bin/boss-skill.test.ts`:

```ts
it('exposes design help through the boss dispatcher', () => {
  const result = runCli(['packages/boss-cli/dist/bin/boss.js', 'design', '--help']);

  expect(result.status).toBe(0);
  expect(result.stdout + result.stderr).toContain('boss design');
  expect(result.stdout + result.stderr).toContain('preview');
});
```

- [ ] **Step 2: Run CLI tests to verify they fail**

Run:

```bash
npm test -- test/cli/design-preview-cli.test.ts test/bin/boss-skill.test.ts -t "design"
```

Expected: FAIL because `design` command group does not exist.

- [ ] **Step 3: Register command metadata**

Modify `packages/boss-cli/src/cli/registry.ts`:

```ts
export const designDescription: CommandDescription = {
  ...rootDescription,
  command: 'boss design',
  summary: 'Preview Boss UI design artifacts'
};

export const designPreviewOptions = [
  ...runtimeBaseOptions,
  { name: 'no-open', type: 'boolean' as const, default: false },
  { name: 'port', type: 'string' as const, default: '0' }
];
```

Add to `commandDescriptions`:

```ts
'boss design preview': {
  command: 'boss design preview',
  summary: 'Preview .boss/<feature>/ui-design.json in a local browser',
  parameters: [{ name: 'feature', type: 'string', required: true }],
  options: designPreviewOptions,
  risk_tier: 'low'
}
```

- [ ] **Step 4: Add help and dispatcher route**

Modify `packages/boss-cli/src/cli/help.ts` imports and exports:

```ts
import {
  artifactDescription,
  designDescription,
  hooksDescription,
  packsDescription,
  projectDescription,
  rootDescription,
  runtimeDescription
} from './registry.js';
```

Add root command line:

```ts
'  design preview',
```

Add:

```ts
export const DESIGN_USAGE = [
  renderHelp(designDescription, 'boss design preview <feature> [--no-open] [--port <port>]'),
  'Commands:',
  '  preview',
  ''
].join('\n');
```

Modify `packages/boss-cli/src/cli/dispatcher.ts`:

```ts
import {
  ARTIFACT_USAGE,
  DESIGN_USAGE,
  HOOKS_USAGE,
  PACKS_USAGE,
  PROJECT_USAGE,
  showRuntimeHelp
} from './help.js';
```

Add:

```ts
import {
  artifactDescription,
  designDescription,
  hooksDescription,
  packsDescription,
  projectDescription,
  runtimeDescription
} from './registry.js';
```

Add command runner:

```ts
export async function runDesignCommand(argv: string[]): Promise<number> {
  const context = createCliContext(argv, { command: 'boss design' });
  const subcommand = context.positionals[0];
  if (context.values.describe && context.positionals.length === 0) {
    writeDescription(describeGroup(designDescription, ['preview']), context);
    return 0;
  }

  if (!subcommand || subcommand === '-h' || subcommand === '--help') {
    process.stdout.write(DESIGN_USAGE);
    return 0;
  }

  if (subcommand !== 'preview') {
    throwUnknownCommand('boss design', subcommand);
  }

  const commandArgv = removeFirstPositional(argv, subcommand);
  const commandContext = createCliContext(commandArgv, { command: 'boss design preview' });
  if (commandContext.values.describe) {
    writeDescription(describeRegisteredCommand('boss design preview'), commandContext);
    return 0;
  }

  const mod: CommandModule = await import('../commands/design/preview.js');
  return mod.main(commandArgv, { cwd: process.cwd() });
}
```

Modify `packages/boss-cli/src/bin/boss.ts`:

```ts
import {
  describeRegisteredCommand,
  removeFirstPositional,
  runArtifactCommand,
  runDesignCommand,
  runHooksCommand,
  runPacksCommand,
  runProjectCommand,
  runRuntimeCommand,
  throwUnknownCommand,
  writeDescription
} from '../cli/dispatcher.js';
```

Add root command string:

```ts
'design preview',
```

Add switch case:

```ts
case 'design':
  return runDesignCommand(commandArgv);
```

- [ ] **Step 5: Implement `preview.ts`**

Create `packages/boss-cli/src/commands/design/preview.ts`:

```ts
#!/usr/bin/env node
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  CliUserError,
  consumeCliContractOption,
  createCliContext,
  describeCommand,
  runMain,
  writeOutput
} from '../../cli/contract.js';
import { commandDescriptions } from '../../cli/registry.js';
import { openUrl } from '../../runtime/design/open.js';
import { renderUiDesignHtml } from '../../runtime/design/render.js';
import { validateUiDesignArtifact, type UiDesignArtifact } from '../../runtime/design/schema.js';
import { startUiDesignPreviewServer } from '../../runtime/design/server.js';

const previewDescription = commandDescriptions['boss design preview']!;

interface PreviewInput {
  feature: string;
  noOpen: boolean;
  port: number;
}

function showHelp(): void {
  process.stdout.write([
    'Boss Design - UI prototype preview',
    '',
    'Usage: boss design preview <feature> [--no-open] [--port <port>] [options]',
    ''
  ].join('\n'));
}

function parseInput(argv: string[]): PreviewInput {
  let feature = '';
  let noOpen = false;
  let port = 0;
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]!;
    const contractOptionEnd = consumeCliContractOption(argv, index);
    if (contractOptionEnd !== null) {
      index = contractOptionEnd;
      continue;
    }
    if (arg === '--no-open') {
      noOpen = true;
      continue;
    }
    if (arg === '--port') {
      const raw = argv[index + 1];
      if (!raw) throw new CliUserError({ code: 'missing_option_value', message: '--port requires a value', input: { option: '--port' }, retryable: false });
      port = Number(raw);
      index += 1;
      continue;
    }
    if (arg.startsWith('--port=')) {
      port = Number(arg.slice('--port='.length));
      continue;
    }
    if (arg.startsWith('-')) {
      throw new CliUserError({ code: 'unknown_option', message: `未知选项: ${arg}`, input: { option: arg }, retryable: false, suggestion: 'Run boss design preview --describe to verify supported options' });
    }
    if (!feature) feature = arg;
    else throw new CliUserError({ code: 'extra_argument', message: `多余的参数: ${arg}`, input: { argument: arg }, retryable: false });
  }

  if (!feature) throw new CliUserError({ code: 'missing_feature', message: 'Usage: boss design preview <feature>', input: { feature }, retryable: false });
  if (!Number.isInteger(port) || port < 0 || port > 65535) {
    throw new CliUserError({ code: 'invalid_port', message: `Invalid --port value: ${port}`, input: { port }, retryable: false, suggestion: 'Use an integer from 0 to 65535' });
  }
  return { feature, noOpen, port };
}

function readDesign(cwd: string, feature: string): { artifactPath: string; relativePath: string; design: UiDesignArtifact } {
  const artifactPath = path.join(cwd, '.boss', feature, 'ui-design.json');
  const relativePath = path.relative(cwd, artifactPath);
  if (!fs.existsSync(artifactPath)) {
    throw new CliUserError({
      code: 'ui_design_not_found',
      message: `未找到 UI 设计产物: ${relativePath}`,
      input: { feature, artifact: relativePath },
      retryable: false,
      suggestion: `Run boss artifact prepare ${feature} ui-design.json or complete the UI designer stage`
    });
  }
  return {
    artifactPath,
    relativePath,
    design: JSON.parse(fs.readFileSync(artifactPath, 'utf8')) as UiDesignArtifact
  };
}

export async function main(argv: string[] = process.argv.slice(2), { cwd = process.cwd() }: { cwd?: string } = {}): Promise<number> {
  const context = createCliContext(argv, { command: 'boss design preview' });
  if (context.values.describe) {
    writeOutput(describeCommand(previewDescription), context, (data) => `${JSON.stringify(data, null, 2)}\n`);
    return 0;
  }
  if (argv.includes('-h') || argv.includes('--help')) {
    showHelp();
    return 0;
  }

  const input = parseInput(argv);
  const { relativePath, design } = readDesign(cwd, input.feature);
  const validation = validateUiDesignArtifact(design);
  const html = renderUiDesignHtml(design, validation);
  const preview = await startUiDesignPreviewServer(html, input.port);
  const shouldOpen = !input.noOpen && context.stdinIsTTY && context.stdoutIsTTY && !process.env.CI;
  const opened = shouldOpen ? openUrl(preview.url) : false;
  const payload = {
    feature: input.feature,
    artifact: relativePath,
    url: preview.url,
    mode: design.mode,
    opened,
    valid: validation.ok,
    errors: validation.errors
  };

  writeOutput(payload, context, () => [
    `UI design preview: ${preview.url}`,
    `Artifact: ${relativePath}`,
    opened ? 'Browser opened.' : 'Browser not opened.',
    validation.ok ? 'Validation: ok' : `Validation errors: ${validation.errors.join('; ')}`,
    ''
  ].join('\n'));

  if (context.useJson || input.noOpen) {
    await preview.close();
  }
  return validation.ok ? 0 : 1;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const context = createCliContext(process.argv.slice(2), { command: 'boss design preview', validateOptionValues: false });
  process.exit(await runMain(() => main(process.argv.slice(2), { cwd: process.cwd() }), context));
}
```

- [ ] **Step 6: Run build and CLI tests**

Run:

```bash
npm run build
npm test -- test/cli/design-preview-cli.test.ts test/bin/boss-skill.test.ts
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add packages/boss-cli/src/commands/design/preview.ts packages/boss-cli/src/cli/registry.ts packages/boss-cli/src/cli/help.ts packages/boss-cli/src/cli/dispatcher.ts packages/boss-cli/src/bin/boss.ts test/cli/design-preview-cli.test.ts test/bin/boss-skill.test.ts
git commit -m "feat: add design preview CLI"
```

## Task 5: Agent Contracts and Documentation

**Files:**
- Modify: `skill/agents/boss-ui-designer.md`
- Modify: `skill/agents/boss-frontend.md`
- Modify: `skill/agents/boss-tech-lead.md`
- Modify: `skill/templates/tech-review.md.template`
- Modify: `skill/SKILL.md`
- Modify: `skill/references/artifact-guide.md`
- Modify: `skill/references/bmad-methodology.md`
- Modify: `test/runtime/docs-contract.test.ts`

- [ ] **Step 1: Write failing docs contract test**

Add to `test/runtime/docs-contract.test.ts`:

```ts
const uiDesigner = fs.readFileSync(path.join(REPO_ROOT, 'skill', 'agents', 'boss-ui-designer.md'), 'utf8');
const frontend = fs.readFileSync(path.join(REPO_ROOT, 'skill', 'agents', 'boss-frontend.md'), 'utf8');
const techLead = fs.readFileSync(path.join(REPO_ROOT, 'skill', 'agents', 'boss-tech-lead.md'), 'utf8');
const artifactGuide = fs.readFileSync(path.join(REPO_ROOT, 'skill', 'references', 'artifact-guide.md'), 'utf8');
const uiDesignTemplate = fs.readFileSync(path.join(REPO_ROOT, 'skill', 'templates', 'ui-design.json.template'), 'utf8');
```

Add:

```ts
describe('ui-design artifact contract', () => {
  it('documents ui-design.json across UI, frontend, and review agents', () => {
    expect(uiDesigner).toContain('ui-design.json');
    expect(uiDesigner).toContain('boss design preview <feature>');
    expect(frontend).toContain('ui-design.json');
    expect(frontend).toContain('ui-design.json > ui-spec.md');
    expect(techLead).toContain('ui-design.json');
    expect(techLead).toContain('ui-spec.md');
  });

  it('documents ui-design.json in artifact guides and templates', () => {
    expect(skill).toContain('ui-design.json');
    expect(artifactGuide).toContain('ui-design.json');
    expect(bmadMethodology).toContain('ui-design.json');
    expect(uiDesignTemplate).toContain('"artifact": "ui-design"');
  });
});
```

- [ ] **Step 2: Run docs tests to verify they fail**

Run:

```bash
npm test -- test/runtime/docs-contract.test.ts -t "ui-design artifact contract"
```

Expected: FAIL because docs and prompts do not mention `ui-design.json` consistently yet.

- [ ] **Step 3: Update UI designer prompt**

In `skill/agents/boss-ui-designer.md`, update responsibilities to require:

```md
4. **机器可渲染设计产物**
   - 必须输出 `.boss/<feature>/ui-design.json`
   - JSON 必须符合 `artifact: "ui-design"`、`mode: "wireframe" | "hifi"`、`pages`、`components`、`prototype`、`implementationHints`
   - Markdown 解释设计，JSON 约束实现；两者冲突时必须先修正冲突再交付
   - 产出后在交互式环境运行或提示：`boss design preview <feature>`
```

Add to output checklist:

```md
- [ ] `.boss/<feature>/ui-design.json` 已写入，并能被 `boss design preview <feature>` 渲染
```

- [ ] **Step 4: Update frontend prompt**

In `skill/agents/boss-frontend.md`, replace the existing UI spec precedence block with:

```md
`ui-design.json` > `ui-spec.md` > `项目现有样式` > `框架默认值`

当 `.boss/<feature>/ui-design.json` 存在时，必须优先读取：
1. 从 `tokens` 映射 CSS 变量、主题对象或设计系统配置
2. 从 `pages` 和 `frames` 推导页面结构、路由和布局
3. 从 `prototype.links` 推导导航和关键交互
4. 从 `components` 推导可复用组件接口
5. 如实现偏离 JSON，必须在最终报告中说明原因
```

- [ ] **Step 5: Update tech lead prompt and templates**

In `skill/agents/boss-tech-lead.md`, add:

```md
当 `.boss/<feature>/ui-design.json` 存在时，技术评审必须检查：
- `ui-design.json` 与 `ui-spec.md` 是否冲突
- PRD 页面、路由、关键流程是否在 JSON 中覆盖
- 前端技术栈是否能实现 JSON 中的布局、状态和 prototype links
- 复杂交互是否需要拆任务或降级设计
```

In `skill/templates/tech-review.md.template`, add UI inputs:

```md
- UI 规范：`.boss/{{FEATURE}}/ui-spec.md`
- UI 设计 JSON：`.boss/{{FEATURE}}/ui-design.json`
```

- [ ] **Step 6: Update skill references**

Update `skill/SKILL.md`, `skill/references/artifact-guide.md`, and `skill/references/bmad-methodology.md` so the artifact flow reads:

```text
design-brief → prd.md → architecture.md ─┬→ tech-review.md → tasks.md → [code] → qa-report.md → deploy-report.md
                       ├→ ui-spec.md(opt) ┘
                       └→ ui-design.json(opt) ┘
```

Add `boss design preview <feature>` to the CLI command list.

- [ ] **Step 7: Run docs tests**

Run:

```bash
npm test -- test/runtime/docs-contract.test.ts
```

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add skill/agents/boss-ui-designer.md skill/agents/boss-frontend.md skill/agents/boss-tech-lead.md skill/templates/tech-review.md.template skill/SKILL.md skill/references/artifact-guide.md skill/references/bmad-methodology.md test/runtime/docs-contract.test.ts
git commit -m "docs: require UI design JSON in agent contracts"
```

## Task 6: Auto Preview Integration and Local Artifact Hygiene

**Files:**
- Modify: `packages/boss-cli/src/commands/runtime/record-artifact.ts`
- Modify: `packages/boss-cli/src/cli/registry.ts`
- Modify: `.gitignore`
- Modify: `test/runtime/runtime-cli-contract.test.ts`

- [ ] **Step 1: Write failing record-artifact contract test**

Add to `test/runtime/runtime-cli-contract.test.ts`:

```ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
npm test -- test/runtime/runtime-cli-contract.test.ts -t "no-open"
```

Expected: FAIL because `record-artifact` does not expose `--no-open`.

- [ ] **Step 3: Add `--no-open` metadata**

Modify `packages/boss-cli/src/cli/registry.ts` after runtime mutation descriptions are assigned:

```ts
runtimeDescriptions['record-artifact'] = {
  ...runtimeDescriptions['record-artifact']!,
  options: [
    ...runtimeMutationOptions,
    { name: 'no-open', type: 'boolean' as const, default: false }
  ],
  risk_tier: 'medium'
};
```

- [ ] **Step 4: Parse `--no-open` in record-artifact**

Modify `RecordArtifactInput` in `packages/boss-cli/src/commands/runtime/record-artifact.ts`:

```ts
interface RecordArtifactInput {
  feature: string;
  artifact: string;
  stage: string;
  noOpen: boolean;
}
```

Update `parseFlatInput`:

```ts
let noOpen = false;
```

Inside the loop before positional handling:

```ts
if (arg === '--no-open') {
  noOpen = true;
  continue;
}
```

Return:

```ts
return {
  feature: requireInputString(feature, 'feature'),
  artifact: requireInputString(artifact, 'artifact'),
  stage: requireInputString(stage, 'stage'),
  noOpen
};
```

Update JSON input handling:

```ts
noOpen: input.noOpen === true || input['no-open'] === true
```

- [ ] **Step 5: Add conservative auto-preview message**

Do not start a blocking server from `record-artifact`. Instead, after successful recording, add a machine-readable prompt when the artifact is `ui-design.json`:

```ts
const previewCommand = input.artifact === 'ui-design.json'
  ? `boss design preview ${input.feature}${input.noOpen ? ' --no-open' : ''}`
  : undefined;
```

Extend `writeOutput` payload:

```ts
{
  feature: input.feature,
  artifact: input.artifact,
  stage: Number(input.stage),
  artifacts,
  previewCommand
}
```

Extend text output:

```ts
const base = `${JSON.stringify({ feature: input.feature, artifact: input.artifact, stage: Number(input.stage), artifacts }, null, 2)}\n`;
return previewCommand ? `${base}Preview: ${previewCommand}\n` : base;
```

This keeps runtime recording non-blocking while still surfacing the browser command immediately after the design artifact is recorded.

- [ ] **Step 6: Ignore local visual companion files**

Modify `.gitignore`:

```gitignore
# Superpowers local browser companion artifacts
.superpowers/
```

- [ ] **Step 7: Run tests**

Run:

```bash
npm test -- test/runtime/runtime-cli-contract.test.ts
```

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add packages/boss-cli/src/commands/runtime/record-artifact.ts packages/boss-cli/src/cli/registry.ts .gitignore test/runtime/runtime-cli-contract.test.ts
git commit -m "feat: surface UI design preview after artifact recording"
```

## Task 7: Final Verification

**Files:**
- All files changed by Tasks 1-6.

- [ ] **Step 1: Run typecheck**

Run:

```bash
npm run typecheck
```

Expected: PASS.

- [ ] **Step 2: Run full test suite**

Run:

```bash
npm test
```

Expected: PASS.

- [ ] **Step 3: Build CLI**

Run:

```bash
npm run build
```

Expected: PASS and `packages/boss-cli/dist/bin/boss.js` exists.

- [ ] **Step 4: Smoke test preview command**

Run:

```bash
tmpdir="$(mktemp -d)"
repo_root="$PWD"
node packages/boss-cli/dist/bin/boss.js project init preview-demo --json --dry-run >/dev/null
mkdir -p "$tmpdir/.boss/preview-demo"
cp skill/templates/ui-design.json.template "$tmpdir/.boss/preview-demo/ui-design.json"
(cd "$tmpdir" && node "$repo_root/packages/boss-cli/dist/bin/boss.js" design preview preview-demo --json --no-open --port 0)
rm -rf "$tmpdir"
```

Expected: command exits 0 and JSON output contains `"valid":true` and `"url":"http://localhost:<port>"`.

- [ ] **Step 5: Inspect git status**

Run:

```bash
git status --short
```

Expected: only intended files are modified; no `.superpowers/` files are tracked.

- [ ] **Step 6: Commit final verification docs only if needed**

If verification requires small doc corrections, commit them:

```bash
git add <verified-doc-files>
git commit -m "docs: clarify UI design preview usage"
```

If no files changed, do not create an empty commit.
