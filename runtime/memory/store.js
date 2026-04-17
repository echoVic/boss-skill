import fs from 'node:fs';
import path from 'node:path';

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function readJson(filePath, fallback) {
  if (!fs.existsSync(filePath)) {
    return fallback;
  }
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function writeJson(filePath, value) {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2) + '\n', 'utf8');
}

function featureMemoryPath(cwd, feature) {
  return path.join(cwd, '.boss', feature, '.meta', 'feature-memory.json');
}

function featureSummaryPath(cwd, feature) {
  return path.join(cwd, '.boss', feature, '.meta', 'memory-summary.json');
}

function globalMemoryPath(cwd) {
  return path.join(cwd, '.boss', '.memory', 'global-memory.json');
}

function globalSummaryPath(cwd) {
  return path.join(cwd, '.boss', '.memory', 'global-memory-summary.json');
}

function recordKey(record) {
  const tags = Array.isArray(record.tags) ? [...record.tags].sort().join(',') : '';
  return [
    record.scope,
    record.category,
    record.feature || '',
    record.stage || '',
    record.agent || '',
    tags
  ].join(':');
}

function mergeRecords(existing, incoming) {
  const merged = new Map(
    existing.map((record) => [recordKey(record), { ...record, evidence: [...record.evidence] }])
  );

  for (const record of incoming) {
    const key = recordKey(record);
    if (!merged.has(key)) {
      merged.set(key, { ...record, evidence: [...record.evidence] });
      continue;
    }

    const current = merged.get(key);
    merged.set(key, {
      ...current,
      summary: record.summary,
      confidence: Math.max(current.confidence, record.confidence),
      lastSeenAt: record.lastSeenAt,
      decayScore: Math.max(current.decayScore, record.decayScore),
      evidence: [...current.evidence, ...record.evidence]
    });
  }

  return [...merged.values()];
}

function saveFeatureMemory(feature, records, { cwd = process.cwd() } = {}) {
  const filePath = featureMemoryPath(cwd, feature);
  const current = readJson(filePath, { feature, records: [] });
  const next = {
    feature,
    records: mergeRecords(current.records || [], records)
  };
  writeJson(filePath, next);
  return next;
}

function saveFeatureSummary(feature, summary, { cwd = process.cwd() } = {}) {
  writeJson(featureSummaryPath(cwd, feature), summary);
  return summary;
}

function saveGlobalMemory(records, { cwd = process.cwd() } = {}) {
  const filePath = globalMemoryPath(cwd);
  const current = readJson(filePath, { records: [] });
  const next = {
    records: mergeRecords(current.records || [], records)
  };
  writeJson(filePath, next);
  return next;
}

function saveGlobalSummary(summary, { cwd = process.cwd() } = {}) {
  writeJson(globalSummaryPath(cwd), summary);
  return summary;
}

const paths = {
  featureMemoryPath,
  featureSummaryPath,
  globalMemoryPath,
  globalSummaryPath
};

export {
  mergeRecords,
  saveFeatureMemory,
  saveFeatureSummary,
  saveGlobalMemory,
  saveGlobalSummary,
  paths
};
