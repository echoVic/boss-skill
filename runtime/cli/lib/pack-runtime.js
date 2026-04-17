import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '..', '..', '..');
const PACKS_DIR = path.join(REPO_ROOT, 'harness', 'pipeline-packs');

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function listPackDefinitions() {
  if (!fs.existsSync(PACKS_DIR)) return [];
  const entries = fs.readdirSync(PACKS_DIR, { withFileTypes: true });
  const packs = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const packDir = path.join(PACKS_DIR, entry.name);
    const pipelineJsonPath = path.join(packDir, 'pipeline.json');
    if (!fs.existsSync(pipelineJsonPath)) continue;

    const pipeline = readJson(pipelineJsonPath);
    if (pipeline.enabled === false) continue;

    packs.push({
      name: pipeline.name || entry.name,
      version: pipeline.version || '',
      type: pipeline.type || '',
      priority: Number.isFinite(Number(pipeline.priority)) ? Number(pipeline.priority) : 0,
      when: pipeline.when || null,
      config: pipeline.config && typeof pipeline.config === 'object' ? pipeline.config : {}
    });
  }

  return packs;
}

function getPackageDeps(projectDir) {
  const packageJsonPath = path.join(projectDir, 'package.json');
  if (!fs.existsSync(packageJsonPath)) {
    return { dependencies: {}, devDependencies: {} };
  }

  try {
    const pkg = readJson(packageJsonPath);
    return {
      dependencies: pkg.dependencies && typeof pkg.dependencies === 'object' ? pkg.dependencies : {},
      devDependencies: pkg.devDependencies && typeof pkg.devDependencies === 'object' ? pkg.devDependencies : {}
    };
  } catch {
    return { dependencies: {}, devDependencies: {} };
  }
}

function evaluateWhen(projectDir, when) {
  if (!when || typeof when !== 'object') return false;

  if (Array.isArray(when.fileExists) && when.fileExists.some((relPath) => !fs.existsSync(path.join(projectDir, relPath)))) {
    return false;
  }

  if (Array.isArray(when.noFileExists) && when.noFileExists.some((relPath) => fs.existsSync(path.join(projectDir, relPath)))) {
    return false;
  }

  if (Array.isArray(when.packageJsonHas) && when.packageJsonHas.length > 0) {
    const deps = getPackageDeps(projectDir);
    if (when.packageJsonHas.some((dep) => !(dep in deps.dependencies) && !(dep in deps.devDependencies))) {
      return false;
    }
  }

  return true;
}

function resolvePipelinePack(projectDir = process.cwd()) {
  const packs = listPackDefinitions();
  const defaultPack = packs.find((pack) => pack.name === 'default') || {
    name: 'default',
    version: '',
    type: 'pipeline-pack',
    priority: 0,
    config: {}
  };

  const matched = packs
    .filter((pack) => pack.when && evaluateWhen(projectDir, pack.when))
    .sort((a, b) => b.priority - a.priority);

  const selected = matched[0] || defaultPack;
  return {
    name: selected.name,
    version: selected.version,
    type: selected.type,
    priority: selected.priority,
    config: clone(selected.config || {})
  };
}

function getPackStateParameters(pack) {
  const config = pack && pack.config && typeof pack.config === 'object' ? pack.config : {};
  const parameters = {
    pipelinePack: pack && pack.name ? pack.name : 'default',
    pipelinePackVersion: pack && pack.version ? pack.version : '',
    enabledStages: Array.isArray(config.stages) ? clone(config.stages) : [],
    enabledGates: Array.isArray(config.gates) ? clone(config.gates) : [],
    activeAgents: Array.isArray(config.agents) ? clone(config.agents) : [],
    packConfig: clone(config)
  };

  if (config.roles !== undefined) parameters.roles = config.roles;
  if (config.agentStages && typeof config.agentStages === 'object') parameters.agentStages = clone(config.agentStages);
  if (config.techStack && typeof config.techStack === 'object') parameters.techStack = clone(config.techStack);

  for (const flag of ['skipUI', 'skipDeploy', 'skipFrontend', 'skipReview']) {
    if (typeof config[flag] === 'boolean') {
      parameters[flag] = config[flag];
    }
  }

  return parameters;
}

export {
  resolvePipelinePack,
  getPackStateParameters
};
