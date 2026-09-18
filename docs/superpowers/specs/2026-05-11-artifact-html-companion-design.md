# Artifact HTML Companion Design

## Summary

Boss should generate a browsable HTML companion for every Markdown artifact in `.boss/<feature>/`. Markdown remains the canonical artifact that agents author, while the runtime produces same-name HTML files from a fixed template and a constrained rendering model.

This keeps agent prompts small: agents continue writing structured Markdown, and Boss owns the HTML shell, styling, metadata, table of contents, and data shape.

## Goals

- Generate `.html` companions for every completed Markdown artifact, such as `prd.md -> prd.html`.
- Keep Markdown as the source of truth; HTML is derived output.
- Add a reusable HTML template that can be overridden by project-level templates.
- Add a JSON schema for the artifact HTML render model so the output contract is explicit and bounded.
- Generate HTML automatically during `boss runtime record-artifact` when a Markdown artifact is recorded.
- Record the generated HTML companion in the same stage artifact list.
- Document the Markdown-to-HTML companion behavior for orchestrators and agents.

## Non-Goals

- Do not require agents to write full HTML pages.
- Do not replace Markdown artifacts.
- Do not add a browser editor or live preview server for generic Markdown artifacts.
- Do not introduce a large Markdown rendering framework in the first version.
- Do not generate companions for machine-readable JSON artifacts such as `ui-design.json`.

## Artifact Behavior

When a Markdown artifact is completed:

```text
.boss/<feature>/prd.md
```

Boss should generate:

```text
.boss/<feature>/prd.html
```

The same rule applies to `design-brief.md`, `architecture.md`, `ui-spec.md`, `tech-review.md`, `tasks.md`, `qa-report.md`, `deploy-report.md`, and `summary-report.md` when those files are recorded or rendered through the runtime.

The generated HTML file is a companion artifact in the same stage. For example, recording `prd.md` for stage 1 should leave both `prd.md` and `prd.html` in stage 1's artifact list.

## Template

Add a bundled template:

```text
skill/templates/artifact.html.template
```

The template is responsible for:

- Complete HTML document structure.
- Responsive document reading layout.
- Metadata block for feature, source artifact, and generated timestamp.
- Table of contents slot.
- Summary slot.
- Body slot.
- Safe default styles for Chinese technical documents, tables, code blocks, lists, and blockquotes.

Template placeholders:

```text
{{FEATURE}}
{{TITLE}}
{{SOURCE_ARTIFACT}}
{{GENERATED_AT}}
{{SUMMARY_HTML}}
{{TOC_HTML}}
{{BODY_HTML}}
```

Project-level template override uses the existing template precedence:

```text
.boss/templates/artifact.html.template
skill/templates/artifact.html.template
```

`boss project init --template` should copy the bundled HTML template into `.boss/templates/` with the rest of the templates.

## Render Model Schema

Add a schema:

```text
packages/boss-cli/src/runtime/schema/artifact-html-schema.json
```

The schema defines the bounded intermediate model used by the renderer before template interpolation:

```json
{
  "schemaVersion": "1.0.0",
  "artifact": "artifact-html",
  "feature": "checkout-flow",
  "sourceArtifact": "prd.md",
  "title": "产品需求文档",
  "generatedAt": "2026-05-11T10:00:00.000Z",
  "summaryItems": ["核心结论 1", "核心结论 2"],
  "toc": [
    { "id": "summary", "level": 2, "text": "摘要" }
  ],
  "bodyHtml": "<h1>...</h1>"
}
```

Validation requirements:

- `artifact` must be `artifact-html`.
- `feature`, `sourceArtifact`, `title`, `generatedAt`, and `bodyHtml` are required strings.
- `sourceArtifact` must end with `.md`.
- `summaryItems` is an array of strings.
- `toc` is an array of `{ id, level, text }` entries.
- `level` must be between 1 and 6.
- `additionalProperties` is false at the root and for TOC entries.

The schema is not intended for agents to author. It is a runtime contract for tests, documentation, and future renderers.

## Runtime Flow

Add a renderer module:

```text
packages/boss-cli/src/runtime/report/render-artifact-html.ts
```

Responsibilities:

- Read Markdown content supplied by the caller.
- Convert Markdown into a constrained HTML body.
- Extract a title from the first `#` heading, falling back to the source artifact name.
- Extract summary list items from the first `## 摘要` section when present.
- Build a TOC from Markdown headings.
- Escape all raw text before HTML interpolation.
- Load `artifact.html.template` from project templates first, then bundled templates.
- Render the template using the schema-shaped model.

Initial Markdown support should cover Boss artifact templates:

- ATX headings (`#` through `######`)
- Paragraphs
- Unordered and ordered lists
- Pipe tables
- Fenced code blocks
- Inline code
- Bold text
- Blockquotes
- Horizontal rules

Unsupported Markdown should degrade to escaped paragraphs instead of raw HTML passthrough.

## CLI Integration

Update `boss runtime record-artifact`:

- After recording the requested artifact, check whether the artifact name ends with `.md`.
- If it does, read `.boss/<feature>/<artifact>.md`.
- Render HTML using the artifact HTML renderer.
- Write `.boss/<feature>/<artifact-without-md>.html`.
- Record the HTML companion with the same stage through the runtime pipeline API.
- Include the companion in CLI output:

```json
{
  "feature": "checkout-flow",
  "artifact": "prd.md",
  "stage": 1,
  "artifacts": ["prd.md", "prd.html"],
  "htmlArtifact": "prd.html",
  "htmlPath": ".boss/checkout-flow/prd.html"
}
```

If the Markdown file is missing or unreadable, `record-artifact` should fail with a user-facing error rather than silently recording a stale artifact.

If rendering fails, the command should fail before recording the HTML companion. The Markdown artifact may already have been recorded by the existing runtime operation; this is acceptable for the first version because the command can be retried after fixing the source file.

## Summary Report Integration

`boss runtime generate-summary <feature>` should continue writing `summary-report.md` by default. After writing the Markdown report, it should also generate `summary-report.html` from the same Markdown content and report both paths.

JSON mode stays unchanged and does not produce an HTML companion.

`--stdout` stays single-format and should not emit companion HTML.

Dry-run output for Markdown summary generation should list both writes:

```json
{
  "actions": [
    { "type": "write_file", "path": ".boss/checkout-flow/summary-report.md", "format": "markdown" },
    { "type": "write_file", "path": ".boss/checkout-flow/summary-report.html", "format": "html" }
  ]
}
```

## Documentation Updates

Update:

- `skill/references/artifact-guide.md`
- `skill/SKILL.md`

The documentation should say:

- Agents author Markdown only.
- Boss runtime generates HTML companions automatically.
- Markdown remains canonical.
- Project teams can override `artifact.html.template` through `.boss/templates/`.
- Downstream agents should read Markdown summaries for token efficiency; HTML exists for human browsing.

## Testing

Add focused tests before implementation:

- Recording `prd.md` creates `prd.html` with escaped content, headings, lists, tables, and code blocks.
- The HTML companion is recorded in the same stage artifact list.
- `artifact-html-schema.json` is included in schema contract tests and rejects additional root properties.
- Project template initialization copies `artifact.html.template`.
- Markdown summary generation writes both `summary-report.md` and `summary-report.html`.
- Dry-run for Markdown summary generation reports both planned writes.
- JSON summary generation remains JSON-only.

## Open Decisions

- None. The first version uses the runtime renderer and template/schema contract. Agents do not write HTML directly.
