export type RuntimeModule = {
  main: (argv: string[], options?: { cwd?: string }) => number | Promise<number>;
};

const runtimeCommands: Record<string, () => Promise<RuntimeModule>> = {
  'build-memory-summary': () => import('../runtime/cli/build-memory-summary.js'),
  'check-stage': () => import('../runtime/cli/check-stage.js'),
  'evaluate-gates': () => import('../runtime/cli/evaluate-gates.js'),
  'extract-memory': () => import('../runtime/cli/extract-memory.js'),
  'generate-summary': () => import('../runtime/cli/generate-summary.js'),
  'get-ready-artifacts': () => import('../runtime/cli/get-ready-artifacts.js'),
  'init-pipeline': () => import('../runtime/cli/init-pipeline.js'),
  'inspect-events': () => import('../runtime/cli/inspect-events.js'),
  'inspect-pipeline': () => import('../runtime/cli/inspect-pipeline.js'),
  'inspect-plugins': () => import('../runtime/cli/inspect-plugins.js'),
  'inspect-progress': () => import('../runtime/cli/inspect-progress.js'),
  'query-memory': () => import('../runtime/cli/query-memory.js'),
  'record-artifact': () => import('../runtime/cli/record-artifact.js'),
  'record-feedback': () => import('../runtime/cli/record-feedback.js'),
  'register-plugins': () => import('../runtime/cli/register-plugins.js'),
  'render-diagnostics': () => import('../runtime/cli/render-diagnostics.js'),
  'replay-events': () => import('../runtime/cli/replay-events.js'),
  'retry-agent': () => import('../runtime/cli/retry-agent.js'),
  'retry-stage': () => import('../runtime/cli/retry-stage.js'),
  'run-plugin-hook': () => import('../runtime/cli/run-plugin-hook.js'),
  'update-agent': () => import('../runtime/cli/update-agent.js'),
  'update-stage': () => import('../runtime/cli/update-stage.js')
};

export function loadRuntimeCommand(name: string): (() => Promise<RuntimeModule>) | undefined {
  return runtimeCommands[name];
}
