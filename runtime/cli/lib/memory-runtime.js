import fs from 'node:fs';
import path from 'node:path';

import {
  saveFeatureMemory,
  saveFeatureSummary,
  saveGlobalMemory,
  saveGlobalSummary,
  paths
} from '../../memory/store.js';
import { extractFeatureMemories } from '../../memory/extractor.js';
import { buildStartupSummary, buildAgentSections } from '../../memory/summarizer.js';

function readJson(filePath, fallback) {
  if (!fs.existsSync(filePath)) {
    return fallback;
  }
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function readExecution(feature, { cwd = process.cwd() } = {}) {
  const filePath = paths.featureMemoryPath(cwd, feature).replace('feature-memory.json', 'execution.json');
  return readJson(filePath, null);
}

function readEvents(feature, { cwd = process.cwd() } = {}) {
  const filePath = paths.featureMemoryPath(cwd, feature).replace('feature-memory.json', 'events.jsonl');
  if (!fs.existsSync(filePath)) {
    return [];
  }

  const raw = fs.readFileSync(filePath, 'utf8').trim();
  if (!raw) {
    return [];
  }

  return raw.split('\n').filter(Boolean).map((line) => JSON.parse(line));
}

function readFeatureMemory(feature, { cwd = process.cwd() } = {}) {
  const filePath = paths.featureMemoryPath(cwd, feature);
  return readJson(filePath, { feature, records: [] });
}

function readFeatureSummary(feature, { cwd = process.cwd() } = {}) {
  const filePath = paths.featureSummaryPath(cwd, feature);
  return readJson(filePath, {
    feature,
    generatedAt: null,
    startupSummary: [],
    agentSections: {}
  });
}

function readGlobalMemory({ cwd = process.cwd() } = {}) {
  return readJson(paths.globalMemoryPath(cwd), { records: [] });
}

function writeFeatureMemory(feature, records, { cwd = process.cwd() } = {}) {
  return saveFeatureMemory(feature, records, { cwd });
}

function rebuildFeatureMemory(feature, { cwd = process.cwd(), now = new Date().toISOString() } = {}) {
  const execution = readExecution(feature, { cwd }) || { parameters: {}, stages: {} };
  const events = readEvents(feature, { cwd });
  const records = extractFeatureMemories({ feature, execution, events, now });
  return writeFeatureMemory(feature, records, { cwd });
}

function buildFeatureSummary(feature, { cwd = process.cwd() } = {}) {
  const payload = readFeatureMemory(feature, { cwd });
  const globalPayload = readGlobalMemory({ cwd });
  const execution = readExecution(feature, { cwd }) || { stages: {} };
  const agents = [];

  for (const [stageId, stage] of Object.entries(execution.stages || {})) {
    for (const agentName of Object.keys(stage.agents || {})) {
      agents.push({ name: agentName, stage: Number(stageId) });
    }
  }

  const combined = [...(payload.records || []), ...(globalPayload.records || [])];

  const summary = {
    feature,
    generatedAt: new Date().toISOString(),
    startupSummary: buildStartupSummary(combined),
    agentSections: buildAgentSections(combined, agents)
  };

  saveFeatureSummary(feature, summary, { cwd });
  return summary;
}

function rebuildGlobalMemory({ cwd = process.cwd() } = {}) {
  const bossRoot = path.join(cwd, '.boss');
  const features = fs.existsSync(bossRoot)
    ? fs.readdirSync(bossRoot).filter((name) => !name.startsWith('.') && fs.existsSync(paths.featureMemoryPath(cwd, name)))
    : [];

  const grouped = new Map();
  for (const feature of features) {
    const payload = readFeatureMemory(feature, { cwd });
    for (const record of payload.records || []) {
      const key = [record.category, record.stage || '', record.agent || '', ...(record.tags || [])].join(':');
      const bucket = grouped.get(key) || [];
      bucket.push(record);
      grouped.set(key, bucket);
    }
  }

  const promoted = [];
  for (const [key, bucket] of grouped.entries()) {
    if (bucket.length < 2) {
      continue;
    }
    const latest = bucket[bucket.length - 1];
    promoted.push({
      ...latest,
      id: `global-${key}`,
      scope: 'global',
      feature: null,
      summary: latest.summary
    });
  }

  const memory = saveGlobalMemory(promoted, { cwd });
  saveGlobalSummary({
    generatedAt: new Date().toISOString(),
    startupSummary: buildStartupSummary(memory.records || []),
    agentSections: {}
  }, { cwd });
  return memory;
}

function queryAgentSection(feature, { cwd = process.cwd(), agent, stage, limit = 3 } = {}) {
  const summary = readFeatureSummary(feature, { cwd });
  const section = summary.agentSections && summary.agentSections[agent]
    ? summary.agentSections[agent]
    : [];
  if (stage == null) {
    return section.slice(0, limit);
  }
  return section.slice(0, limit);
}

export {
  buildFeatureSummary,
  queryAgentSection,
  readFeatureMemory,
  readFeatureSummary,
  readGlobalMemory,
  rebuildFeatureMemory,
  rebuildGlobalMemory,
  writeFeatureMemory
};
