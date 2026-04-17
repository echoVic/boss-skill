# CLI TypeScript + Vitest Migration Design

Date: 2026-04-17
Status: Approved in chat, pending written-spec review

## Context

The repository is currently centered on Node-based CLI/runtime code written in CommonJS JavaScript, with tests executed through `node --test`. The package entrypoint is [`bin/boss-skill.js`](/Users/qingyun/Documents/GitHub/boss-skill/bin/boss-skill.js), and the CLI command family under [`runtime/cli/`](/Users/qingyun/Documents/GitHub/boss-skill/runtime/cli) depends on runtime modules under [`runtime/`](/Users/qingyun/Documents/GitHub/boss-skill/runtime) and a small number of shared Node utilities under [`scripts/lib/`](/Users/qingyun/Documents/GitHub/boss-skill/scripts/lib).

The user wants a clean migration, not partial compatibility:

- CLI-related Node code should move to TypeScript.
- Tests should move to Vitest.
- Module format should move fully to ESM.
- Publish/build should move to a `src -> dist` pipeline.
- Shell-based runtime scripts should stay out of scope for this migration.
- Node support floor should move to `>=20`.

## Goals

- Move the CLI execution path to TypeScript and ESM.
- Introduce a clear `src/` source tree and `dist/` build output.
- Replace `node:test` with Vitest for all current tests.
- Ensure tests validate the real published CLI shape where appropriate.
- Preserve runtime resources, templates, JSON data, Markdown docs, and shell scripts required by the package.

## Non-Goals

- Converting `.sh` scripts to TypeScript.
- Migrating every repository utility script in one pass.
- Redesigning product behavior or changing the CLI surface.
- Refactoring unrelated content files, prompts, templates, or harness data beyond import-path/build compatibility needs.

## Scope

### In Scope

- `bin/` CLI entrypoint migration
- `runtime/cli/**/*.js` migration
- `runtime/**/*.js` modules used by the CLI/test path
- `scripts/lib/**/*.js` modules directly imported by the migrated CLI/runtime path
- `test/**/*.js` migration to TypeScript + Vitest
- `package.json`, `tsconfig`, Vitest config, and publish/build scripts

### Out of Scope

- `scripts/**/*.sh`
- `scripts/hooks/*.js` unless a migrated CLI/runtime module directly requires one
- `scripts/release.js`
- Markdown, JSON schema/data, templates, prompt assets, and pipeline configuration files beyond packaging adjustments

## Recommended Approach

Adopt a CLI-centered full migration:

1. Create a `src/` tree containing all TypeScript/ESM code that participates in the CLI execution path.
2. Compile with `tsc` into `dist/`.
3. Publish only `dist/` for executable Node code, while continuing to ship non-code assets from their existing locations.
4. Migrate all tests to Vitest.
5. Keep shell/runtime scripts and unrelated Node utilities outside this migration boundary.

This approach keeps the migration technically clean without expanding scope into a repository-wide toolchain rewrite.

## Source Layout

The new source boundary should be:

```text
src/
  bin/
    boss-skill.ts
  runtime/
    cli/**/*.ts
    cli/lib/**/*.ts
    domain/**/*.ts
    memory/**/*.ts
    projectors/**/*.ts
    report/**/*.ts
  scripts/
    lib/**/*.ts

test/
  **/*.test.ts
  helpers/*.ts

dist/
  ...compiled ESM output...
```

Files that remain outside `src/` are treated as static resources or non-migrated scripts and are not compiled by TypeScript.

## Build And Publish Design

### Package Shape

- Set `"type": "module"` in [`package.json`](/Users/qingyun/Documents/GitHub/boss-skill/package.json).
- Change the package `bin` target from the repository-root JS file to `dist/bin/boss-skill.js`.
- Raise `engines.node` to `>=20`.

### Build

- Use `tsc` as the canonical compiler.
- Compile from `src/` to `dist/`.
- Emit declarations to support editor/type consumption if useful, but code emission correctness is the primary goal.
- Keep asset files published via `package.json.files` rather than trying to compile/copy everything into `dist/`.

### Publish

- `prepublishOnly` should ensure the package is built before publish.
- The publish manifest must continue to include required static assets:
  - `agents/`
  - `commands/`
  - `harness/`
  - `references/`
  - `templates/`
  - `skills/`
  - `.claude/`
  - `.claude-plugin/`
  - `SKILL.md`
  - `DESIGN.md`
- `dist/` must be included in the published files list.

## TypeScript And ESM Rules

All migrated source code follows one consistent rule set:

- TypeScript source uses native ESM syntax only.
- Internal relative imports use explicit `.js` extensions in source, so emitted output matches Node 20 ESM resolution.
- `tsconfig` uses `module: "NodeNext"` and `moduleResolution: "NodeNext"`.
- `__dirname` and `__filename` are replaced with `fileURLToPath(import.meta.url)` patterns.
- JSON is generally loaded through `fs` + `JSON.parse` rather than import assertions, to avoid widening the migration surface.
- Dynamic CommonJS fallback, if absolutely needed, uses `createRequire(import.meta.url)` locally instead of leaving broad `require` usage in place.
- `module.exports` and `exports.*` are replaced with named exports, with a small number of explicit `main()` entrypoints where appropriate.

These rules intentionally forbid hybrid module patterns.

## Test Strategy

All existing tests move to Vitest.

### Test Categories

#### Unit Tests

- Import TypeScript source modules directly from `src/`.
- Use `describe`, `it`, `expect`, `beforeEach`, and `afterEach` from Vitest.
- Replace `node:assert/strict` assertions with Vitest expectations.

#### CLI Contract Tests

- Build first, then execute `dist` output through `node` or the package bin entrypoint.
- Validate stdout, stderr, exit code, and filesystem side effects against the built package shape, not old repository-root source paths.

### Test Helpers

- Migrate [`test/helpers/fixtures.js`](/Users/qingyun/Documents/GitHub/boss-skill/test/helpers/fixtures.js) to TypeScript.
- Use `vi.spyOn`, `vi.stubEnv`, and filesystem fixtures where mocking is necessary.
- Avoid leaving any tests that continue to `require` old CommonJS source paths.

## Tooling Scripts

Recommended package scripts:

- `build`: compile TypeScript to `dist`
- `typecheck`: run `tsc --noEmit`
- `test`: run `vitest run`
- `test:watch`: run `vitest`

Additional verification commands may be added if needed, but these are the required baseline commands.

## Migration Plan

1. Introduce the TypeScript/Vitest toolchain and ESM package settings.
2. Create the `src -> dist` skeleton and migrate the top-level CLI entrypoint.
3. Migrate the CLI dependency chain under `runtime/` and the CLI-used portion of `scripts/lib/`.
4. Migrate all tests and fixtures from `node:test` to Vitest.
5. Update packaging, bin wiring, and publish hooks.
6. Verify build, typecheck, tests, CLI smoke, and packed artifact contents.

## Risks And Mitigations

### ESM Path And Runtime Semantics

Risk:
ESM requires explicit extensions, different path resolution, and `import.meta.url` replacements.

Mitigation:
Standardize on `NodeNext` and explicit `.js` relative imports from the beginning.

### Test/Publish Shape Drift

Risk:
Tests may pass against source paths while published output fails.

Mitigation:
Force CLI contract tests to execute built `dist` output.

### Missing Static Assets In Publish Output

Risk:
Templates, harness data, skill docs, or schemas may be omitted during packaging.

Mitigation:
Treat assets as publish-managed files and validate with `npm pack`.

### Scope Creep Into Non-CLI Scripts

Risk:
The migration expands into unrelated repository tooling and shell integration.

Mitigation:
Keep the migration boundary explicit: CLI chain in, shell and unrelated scripts out.

## Acceptance Criteria

- CLI-chain Node source lives under `src/` in TypeScript and ESM.
- The package is configured as ESM with Node `>=20`.
- `npm run build` succeeds.
- `npm run typecheck` succeeds.
- `npm test` succeeds under Vitest.
- CLI smoke test `node dist/bin/boss-skill.js --help` succeeds.
- Published package contents still include required non-code assets.
- `npm pack` inspection confirms bin and static resources are present.

## Open Decisions Closed In This Spec

- Runtime shell scripts are excluded from migration.
- CLI code moves to TypeScript.
- Tests migrate together with the CLI migration.
- Module format becomes full ESM.
- Build/publish model becomes `src -> dist`.
- Node support floor becomes `>=20`.

## Implementation Handoff Notes

Implementation should follow TDD during code changes, but this spec itself does not contain the step-by-step execution plan. The next artifact after written-spec approval is an implementation plan based on this design.
