# UI Design JSON Preview Design

## Summary

Boss should make the UI designer stage produce a machine-readable design artifact in addition to the existing human-readable UI spec. The new artifact, `.boss/<feature>/ui-design.json`, becomes a first-class pipeline output that can be rendered in a local browser preview and used by downstream agents to constrain frontend implementation.

The first implementation should ship a lightweight CLI previewer and a stable JSON schema that supports both `wireframe` and `hifi` modes. The renderer should prioritize reliable prototype visualization over in-browser editing.

## Goals

- Add `.boss/<feature>/ui-design.json` as a first-class UI design artifact.
- Keep `.boss/<feature>/ui-spec.md` as the human-readable design explanation.
- Add a `boss design preview <feature>` CLI command that reads `ui-design.json`, validates it, serves a local browser preview, and opens it by default in interactive terminals.
- Allow CI and headless environments to skip browser opening while still reporting how to preview manually.
- Update UI designer, frontend, and tech lead agent contracts so downstream implementation is constrained by the JSON design.
- Support a minimum `wireframe` schema now while reserving stable fields for future `hifi` rendering.

## Non-Goals

- No in-browser design editing in the first version.
- No drag-and-drop canvas editor.
- No remote collaboration, comments, or review workflow.
- No import from Figma, Pencil, Sketch, or other design tools.
- No pixel-level visual regression test suite in the first version.

## Artifact Model

The UI designer stage should produce two synchronized files:

```text
.boss/<feature>/ui-spec.md
.boss/<feature>/ui-design.json
```

`ui-spec.md` remains the human-facing explanation. It should describe design rationale, interaction guidance, accessibility notes, and implementation caveats.

`ui-design.json` becomes the machine-facing contract. It should describe pages, frames, reusable components, design tokens, prototype links, and implementation hints. Renderers, frontend agents, tests, and validation commands should treat it as the highest-priority UI source.

Frontend implementation precedence should be:

```text
ui-design.json > ui-spec.md > existing project styles > framework defaults
```

## Pipeline and DAG

The default artifact DAG should add `ui-design.json` after `prd.md`, produced by `boss-ui-designer` in the same stage as `ui-spec.md`:

```text
prd.md
  |-- architecture.md
  |-- ui-spec.md
  `-- ui-design.json

tech-review.md depends on:
  architecture.md + ui-spec.md + ui-design.json
```

Behavior by project type:

- Web and app pipeline packs enable `ui-design.json` by default.
- If `skipUI: true`, both `ui-spec.md` and `ui-design.json` are skipped.
- API-only and non-UI projects keep `ui-design.json` optional so backend-only work is not blocked.

## CLI Surface

Add a top-level command group:

```bash
boss design preview <feature>
```

The command reads `.boss/<feature>/ui-design.json`, validates it, starts a local static preview server, and renders the prototype in the browser.

Supported options:

```bash
boss design preview <feature> --no-open
boss design preview <feature> --port 5177
boss design preview <feature> --json
boss design preview --describe
```

Default behavior:

- Interactive terminal: open the browser automatically after a valid preview server starts.
- CI or headless terminal: do not open a browser; print the preview URL and the manual command.
- JSON mode: emit stable machine-readable output.

Example JSON output:

```json
{
  "feature": "checkout-flow",
  "artifact": ".boss/checkout-flow/ui-design.json",
  "url": "http://localhost:5177",
  "mode": "wireframe",
  "opened": true
}
```

The preview server should be implemented with Node standard library HTTP APIs first. It should not require Vite, React, or a browser framework as a runtime dependency.

## JSON Schema

Create a runtime schema file:

```text
packages/boss-cli/src/runtime/schema/ui-design-schema.json
```

The schema should support two modes:

- `wireframe`: minimum required mode. It must be enough to render a useful prototype.
- `hifi`: stricter mode for tokens, exact layout, component states, and responsive rules.

Minimum shape:

```json
{
  "schemaVersion": "1.0.0",
  "artifact": "ui-design",
  "mode": "wireframe",
  "feature": "checkout-flow",
  "updatedAt": "2026-05-11T10:00:00Z",
  "tokens": {
    "colors": {},
    "typography": {},
    "spacing": {},
    "radius": {}
  },
  "pages": [
    {
      "id": "checkout",
      "name": "Checkout",
      "route": "/checkout",
      "viewport": { "width": 1440, "height": 960 },
      "frames": [
        {
          "id": "checkout-main",
          "type": "page",
          "layout": "vertical",
          "children": []
        }
      ],
      "states": []
    }
  ],
  "components": [],
  "prototype": {
    "startPageId": "checkout",
    "links": []
  },
  "implementationHints": {
    "preferredFramework": "react",
    "requiredComponents": [],
    "accessibilityNotes": []
  }
}
```

Validation requirements:

- `artifact` must be `ui-design`.
- `mode` must be `wireframe` or `hifi`.
- `pages` must contain at least one page.
- `prototype.startPageId` must reference an existing page.
- Each `prototype.links[].targetPageId` must reference an existing page.
- Frame and component ids must be unique within the artifact.
- `hifi` mode must require non-empty design token sections.

## Browser Previewer

The first previewer should render a local HTML app generated by the CLI. It should include:

- Left navigation listing all pages.
- Top viewport controls for desktop, tablet, and mobile.
- Central prototype canvas rendering the selected page frames.
- Right inspector panel showing route, mode, tokens summary, components, and validation messages.
- Clickable prototype links that navigate between pages.
- Clear error view when schema validation fails or references are missing.

Rendering rules:

- `wireframe` mode uses neutral linework, section labels, layout direction, and component placeholders.
- `hifi` mode applies tokens for colors, typography, radius, spacing, and component state styling when available.
- Missing `hifi` fields fall back to `wireframe` rendering instead of blank output.
- The previewer is read-only in the first version.

## Agent Contract Changes

### UI Designer

`boss-ui-designer` must produce both:

```text
.boss/<feature>/ui-spec.md
.boss/<feature>/ui-design.json
```

The agent should:

- Read `prd.md` and any design brief.
- Define pages, user flows, reusable components, states, and key interactions.
- Explain design rationale in Markdown.
- Express renderable structure and machine constraints in JSON.
- Run or suggest `boss design preview <feature>` after producing the JSON.

### Frontend Agent

`boss-frontend` must:

- Prefer `ui-design.json` over `ui-spec.md` when both exist.
- Map `tokens` to theme variables or CSS custom properties.
- Use `pages` and `frames` to derive page structure.
- Use `prototype.links` to derive routes and navigation behavior.
- Use `components` to derive reusable component interfaces.
- Explain any intentional deviation from `ui-design.json` in its final report.

### Tech Lead

`boss-tech-lead` must:

- Include `ui-design.json` in technical review when present.
- Check for conflicts between `ui-design.json` and `ui-spec.md`.
- Check whether PRD routes and flows are represented in the design JSON.
- Flag frontend implementation risks caused by layout, state, or interaction requirements.
- Recommend task splitting or design simplification when JSON complexity is too high.

## Tests

Coverage should include:

- DAG readiness: `ui-design.json` becomes ready after `prd.md`.
- DAG skipping: `skipUI` skips both `ui-spec.md` and `ui-design.json`.
- Downstream dependency: `tech-review.md` waits for `ui-design.json` when UI is enabled.
- CLI description: root `--describe` includes the `design` command group.
- CLI description: `boss design preview --describe` emits a stable contract.
- Schema success: a valid minimal `wireframe` artifact passes.
- Schema failures: missing `pages`, invalid `mode`, duplicate ids, and invalid prototype references fail.
- Renderer success: minimal JSON produces a non-empty HTML preview.
- Renderer navigation: a prototype link can switch pages.
- Renderer error view: invalid JSON produces a clear local error page.
- Agent contracts: UI designer, frontend, and tech lead prompts mention `ui-design.json` responsibilities.

## Rollout

Implement in small steps:

1. Add schema and schema tests.
2. Add `ui-design.json` to the DAG and pipeline pack behavior.
3. Add `boss design preview <feature>` with validation and HTML generation.
4. Add automatic interactive preview after UI design artifact generation.
5. Update UI designer, frontend, and tech lead prompts.
6. Update docs and CLI contract tests.

This rollout keeps the first version shippable while preserving a path toward richer Pencil-like or Figma-like design data.
