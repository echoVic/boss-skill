import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '..', '..', '..', '..');
const PACKS_DIR = path.join(REPO_ROOT, 'harness', 'pipeline-packs');

export interface PipelinePackWhen {
  fileExists?: string[];
  noFileExists?: string[];
  packageJsonHas?: string[];
}

export interface PipelinePackConfig extends Record<string, unknown> {
  stages?: number[];
  gates?: string[];
  agents?: string[];
  roles?: unknown;
  agentStages?: Record<string, unknown>;
  techStack?: Record<string, unknown>;
  skipUI?: boolean;
  skipDeploy?: boolean;
  skipFrontend?: boolean;
  skipReview?: boolean;
  gateConfig?: { coverage?: number };
}

export interface PipelinePackDefinition {
  name: string;
  version: string;
  type: string;
  priority: number;
  when: PipelinePackWhen | null;
  config: PipelinePackConfig;
}

export interface PipelinePackStateParameters {
  pipelinePack: string;
  pipelinePackVersion: string;
  enabledStages: number[];
  enabledGates: string[];
  activeAgents: string[];
  packConfig: PipelinePackConfig;
  roles?: unknown;
  agentStages?: Record<string, unknown>;
  techStack?: Record<string, unknown>;
  skipUI?: boolean;
  skipDeploy?: boolean;
  skipFrontend?: boolean;
  skipReview?: boolean;
}

function readJson<T>(filePath: string): T {
  return JSON.parse(fs.readFileSync(filePath, 'utf8')) as T;
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function listPackDefinitions(): PipelinePackDefinition[] {
  if (!fs.existsSync(PACKS_DIR)) return [];
  const entries = fs.readdirSync(PACKS_DIR, { withFileTypes: true });
  const packs: PipelinePackDefinition[] = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const packDir = path.join(PACKS_DIR, entry.name);
    const pipelineJsonPath = path.join(packDir, 'pipeline.json');
    if (!fs.existsSync(pipelineJsonPath)) continue;

    const pipeline = readJson<Record<string, unknown>>(pipelineJsonPath);
    if (pipeline.enabled === false) continue;

    packs.push({
      name: typeof pipeline.name === 'string' && pipeline.name.length > 0 ? pipeline.name : entry.name,
      version: typeof pipeline.version === 'string' ? pipeline.version : '',
      type: typeof pipeline.type === 'string' ? pipeline.type : '',
      priority: Number.isFinite(Number(pipeline.priority)) ? Number(pipeline.priority) : 0,
      when: isObject(pipeline.when) ? (pipeline.when as PipelinePackWhen) : null,
      config: isObject(pipeline.config) ? (pipeline.config as PipelinePackConfig) : {}
    });
  }

  return packs;
}

function getPackageDeps(projectDir: string): { dependencies: Record<string, unknown>; devDependencies: Record<string, unknown> } {
  const packageJsonPath = path.join(projectDir, 'package.json');
  if (!fs.existsSync(packageJsonPath)) {
    return { dependencies: {}, devDependencies: {} };
  }

  try {
    const pkg = readJson<Record<string, unknown>>(packageJsonPath);
    return {
      dependencies: isObject(pkg.dependencies) ? pkg.dependencies : {},
      devDependencies: isObject(pkg.devDependencies) ? pkg.devDependencies : {}
    };
  } catch {
    return { dependencies: {}, devDependencies: {} };
  }
}

function evaluateWhen(projectDir: string, when: PipelinePackWhen | null): boolean {
  if (!when || typeof when !== 'object') return false;

  if (
    Array.isArray(when.fileExists) &&
    when.fileExists.some((relPath) => !fs.existsSync(path.join(projectDir, relPath)))
  ) {
    return false;
  }

  if (
    Array.isArray(when.noFileExists) &&
    when.noFileExists.some((relPath) => fs.existsSync(path.join(projectDir, relPath)))
  ) {
    return false;
  }

  if (Array.isArray(when.packageJsonHas) && when.packageJsonHas.length > 0) {
    const deps = getPackageDeps(projectDir);
    if (
      when.packageJsonHas.some(
        (dep) => !(dep in deps.dependencies) && !(dep in deps.devDependencies)
      )
    ) {
      return false;
    }
  }

  return true;
}

export function resolvePipelinePack(projectDir = process.cwd()): PipelinePackDefinition {
  const packs = listPackDefinitions();
  const defaultPack =
    packs.find((pack) => pack.name === 'default') ?? {
      name: 'default',
      version: '',
      type: 'pipeline-pack',
      priority: 0,
      when: null,
      config: {}
    };

  const matched = packs
    .filter((pack) => pack.when && evaluateWhen(projectDir, pack.when))
    .sort((left, right) => right.priority - left.priority);

  const selected = matched[0] ?? defaultPack;
  return {
    name: selected.name,
    version: selected.version,
    type: selected.type,
    priority: selected.priority,
    when: selected.when,
    config: clone(selected.config ?? {})
  };
}

export function getPackStateParameters(pack: PipelinePackDefinition | null | undefined): PipelinePackStateParameters {
  const config =
    pack && pack.config && typeof pack.config === 'object'
      ? pack.config
      : ({} as PipelinePackConfig);
  const parameters: PipelinePackStateParameters = {
    pipelinePack: pack?.name || 'default',
    pipelinePackVersion: pack?.version || '',
    enabledStages: Array.isArray(config.stages) ? clone(config.stages) : [],
    enabledGates: Array.isArray(config.gates) ? clone(config.gates) : [],
    activeAgents: Array.isArray(config.agents) ? clone(config.agents) : [],
    packConfig: clone(config)
  };

  if (config.roles !== undefined) parameters.roles = config.roles;
  if (config.agentStages && typeof config.agentStages === 'object') {
    parameters.agentStages = clone(config.agentStages);
  }
  if (config.techStack && typeof config.techStack === 'object') {
    parameters.techStack = clone(config.techStack);
  }

  for (const flag of ['skipUI', 'skipDeploy', 'skipFrontend', 'skipReview'] as const) {
    if (typeof config[flag] === 'boolean') {
      parameters[flag] = config[flag];
    }
  }

  return parameters;
}
