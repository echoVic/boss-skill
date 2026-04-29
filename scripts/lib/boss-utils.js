import fs from 'node:fs';
import path from 'node:path';

const STAGE_MAP = {
  'prd.md': 1,
  'architecture.md': 1,
  'ui-spec.md': 1,
  'tech-review.md': 2,
  'tasks.md': 2,
  'qa-report.md': 3,
  'deploy-report.md': 4
};

const AGENT_STAGE_MAP = {
  'boss-pm': 1,
  'boss-architect': 1,
  'boss-ui-designer': 1,
  'boss-tech-lead': 2,
  'boss-scrum-master': 2,
  'boss-frontend': 3,
  'boss-backend': 3,
  'boss-qa': 3,
  'boss-devops': 4
};

function readExecJson(cwd, feature) {
  const execPath = path.join(cwd, '.boss', feature, '.meta', 'execution.json');
  try {
    const raw = fs.readFileSync(execPath, 'utf8');
    return JSON.parse(raw);
  } catch (err) {
    process.stderr.write('[boss-skill] readExecJson: ' + err.message + '\n');
    return null;
  }
}

function findActiveFeature(cwd) {
  const bossDir = path.join(cwd, '.boss');
  if (!fs.existsSync(bossDir)) {
    return null;
  }

  let entries;
  try {
    entries = fs.readdirSync(bossDir, { withFileTypes: true });
  } catch (err) {
    process.stderr.write('[boss-skill] findActiveFeature/readdirSync: ' + err.message + '\n');
    return null;
  }

  const actives = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const execJsonPath = path.join(bossDir, entry.name, '.meta', 'execution.json');
    if (!fs.existsSync(execJsonPath)) continue;

    try {
      const raw = fs.readFileSync(execJsonPath, 'utf8');
      const data = JSON.parse(raw);
      const status = data.status || 'unknown';
      if (status === 'running' || status === 'initialized') {
        actives.push({
          feature: data.feature || entry.name,
          execJsonPath,
          status
        });
      }
    } catch (err) {
      process.stderr.write('[boss-skill] findActiveFeature/readExecJson: ' + err.message + '\n');
      continue;
    }
  }

  if (actives.length === 0) return null;

  if (actives.length > 1) {
    const names = actives.map(a => a.feature).join(', ');
    process.stderr.write('[boss-skill] findActiveFeature: 检测到多个活跃流水线 (' + names + ')，使用第一个: ' + actives[0].feature + '\n');
  }

  return actives[0];
}

function writeJson(filePath, data) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  const tmp = filePath + '.tmp.' + process.pid;
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2) + '\n', 'utf8');
  fs.renameSync(tmp, filePath);
}

function loadArtifactDag(dagPath) {
  try {
    const raw = fs.readFileSync(dagPath, 'utf8');
    return JSON.parse(raw);
  } catch (err) {
    process.stderr.write('[boss-skill] loadArtifactDag: ' + err.message + '\n');
    return null;
  }
}

function getReadyArtifacts(dag, execData, params) {
  if (!dag || !dag.artifacts || !execData) return [];

  const completedArtifacts = new Set();
  const stages = execData.stages || {};
  for (const sKey of Object.keys(stages).sort((a, b) => Number(a) - Number(b))) {
    const stage = stages[sKey] || {};
    for (const a of (stage.artifacts || [])) {
      completedArtifacts.add(a);
    }
  }

  const skipUI = (params && params.skipUI) || false;
  const skipDeploy = (params && params.skipDeploy) || false;

  function isSatisfied(name) {
    if (completedArtifacts.has(name)) return true;
    const def = dag.artifacts[name];
    if (!def) return false;
    if (def.optional) return true;
    if (name === 'ui-spec.md' && skipUI) return true;
    if (name === 'deploy-report.md' && skipDeploy) return true;
    if (name === 'design-brief') return true; // always optional
    return false;
  }

  const ready = [];
  for (const [name, def] of Object.entries(dag.artifacts)) {
    if (completedArtifacts.has(name)) continue;
    if (name === 'ui-spec.md' && skipUI) continue;
    if (name === 'deploy-report.md' && skipDeploy) continue;
    if (!def.agent) continue; // manual inputs

    const inputs = def.inputs || [];
    const allReady = inputs.every(input => isSatisfied(input));
    if (allReady) {
      ready.push({ artifact: name, agent: def.agent, stage: def.stage });
    }
  }

  return ready;
}

export {
  STAGE_MAP,
  AGENT_STAGE_MAP,
  readExecJson,
  findActiveFeature,
  writeJson,
  loadArtifactDag,
  getReadyArtifacts
};
