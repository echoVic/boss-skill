# Boss CLI Assets Design

## Summary

Harness is a Boss operating pattern, not a standalone repository surface. The root `harness/` directory should disappear. Its current contents become Boss CLI built-in assets, while user-level extensions live under `.boss/`.

This keeps the repo shape aligned with the product shape:

- `skill/` is the thin bundle installed into coding agents.
- `packages/boss-cli/` owns all runtime logic and built-in runtime assets.
- `.boss/` is the project-local state and override area.

## Goals

- Remove the root `harness/` directory from the repository and published package.
- Move built-in DAG, pipeline packs, plugin schema, and built-in plugins into `packages/boss-cli/assets/`.
- Keep public commands under `boss ...`; do not introduce a separate `harness` CLI.
- Treat `.boss/` as the only project-local place for Boss runtime state and optional extensions.
- Centralize asset path resolution so runtime code does not hard-code repository `harness` paths.

## Non-Goals

- No backward compatibility for root `harness/` lookup.
- No separate `boss-harness` npm package.
- No user-facing `harness` command namespace.
- No change to the thin `skill/` bundle boundary except updating documentation references.

## Target Layout

```text
boss-skill/
├── skill/
├── packages/
│   └── boss-cli/
│       ├── src/
│       │   ├── bin/
│       │   ├── commands/
│       │   └── runtime/
│       └── assets/
│           ├── artifact-dag.json
│           ├── plugin-schema.json
│           ├── pipeline-packs/
│           │   ├── default/
│           │   ├── core/
│           │   ├── api-only/
│           │   └── solana-contract/
│           └── plugins/
│               └── security-audit/
└── scripts/
    ├── hooks/
    ├── lib/
    └── release.js
```

Project-local Boss files:

```text
.boss/
├── <feature>/
├── templates/
├── artifact-dag.json        # optional project DAG override
├── pipeline-packs/          # optional project pack extensions/overrides
└── plugins/                 # optional project plugins
```

## Asset Resolution

Add one runtime asset resolver module, for example `packages/boss-cli/src/runtime/assets.ts`. All runtime modules should use it instead of building paths to `harness/` directly.

Resolution rules:

| Asset | Priority |
|---|---|
| Artifact DAG | `.boss/artifact-dag.json` > selected pack DAG if configured > `packages/boss-cli/assets/artifact-dag.json` |
| Pipeline packs | `.boss/pipeline-packs/*` merged over `packages/boss-cli/assets/pipeline-packs/*` |
| Plugins | `.boss/plugins/*` merged over `packages/boss-cli/assets/plugins/*` |
| Plugin schema | `packages/boss-cli/assets/plugin-schema.json` |

For pipeline packs, project packs with the same name override built-in packs. New project pack names are added to the candidate set. `boss packs detect` evaluates the merged set.

For plugins, project-local `.boss/plugins/` is the project extension point. Project plugins with the same name override built-in plugins. New project plugin names are added to the candidate set. There is no root `harness/plugins/` fallback.

## Command Surface

Keep the current Boss CLI surface:

```bash
boss project init
boss artifact prepare
boss packs detect
boss runtime init-pipeline
boss runtime get-ready-artifacts
boss runtime evaluate-gates
boss runtime register-plugins
boss runtime run-plugin-hook
boss runtime inspect-plugins
```

Do not add `boss harness ...` or a separate `harness` binary. The harness idea is expressed through event-sourced runtime, DAG-driven artifacts, packs, gates, and plugins.

## Runtime Changes

- `pack-runtime.ts` should list packs through the asset resolver.
- `plugin-runtime.ts` should discover plugins from `.boss/plugins/` or built-in CLI assets.
- `pipeline-runtime.ts` should load the default DAG through the asset resolver.
- Gate evaluation keeps built-in gates in TypeScript. Built-in plugin assets, such as `security-audit`, live under `packages/boss-cli/assets/plugins/`.
- `package.json.files` should include `packages/boss-cli/assets/` and should not include root `harness/`.

## Error Handling

- Missing built-in assets are fatal errors with clear messages naming the expected asset.
- Invalid project packs or plugins should fail validation when used, not silently fall back.
- Invalid project overrides should not hide valid built-in assets with different names.
- If `.boss/artifact-dag.json` is malformed, runtime should fail and point to that project override.

## Documentation

Update docs and skill references so `harness` appears as a conceptual pattern only, not as a directory users should create.

Examples should use:

- `.boss/plugins/`
- `.boss/pipeline-packs/`
- `.boss/artifact-dag.json`
- `packages/boss-cli/assets/` for built-in package assets

## Testing

Add or update tests to lock the architecture:

- Repository root has no `harness/` directory.
- `package.json.files` includes `packages/boss-cli/assets/` and excludes `harness/`.
- `npm pack --dry-run` includes CLI assets under `packages/boss-cli/assets/**`.
- Source code does not hard-code `REPO_ROOT, 'harness'`.
- `boss packs detect` uses built-in assets.
- `.boss/pipeline-packs` can override or add packs.
- `.boss/artifact-dag.json` overrides the built-in DAG.
- `.boss/plugins` can register and execute project plugins.
- Docs do not instruct users to create root `harness/`.

## Migration Plan

1. Write failing architecture tests for the new asset boundary.
2. Move `harness/` contents to `packages/boss-cli/assets/`.
3. Add the runtime asset resolver and update pack/plugin/pipeline runtime modules to use it.
4. Update package publish files and dry-run package assertions.
5. Update documentation and skill references.
6. Delete root `harness/`.
7. Run build, typecheck, full tests, and package dry-run.
