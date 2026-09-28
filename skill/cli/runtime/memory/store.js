import * as fs from 'node:fs';
import * as path from 'node:path';
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
        record.scope ?? '',
        record.category,
        record.feature ?? '',
        record.stage ?? '',
        record.agent ?? '',
        tags,
    ].join(':');
}
function cloneRecord(record) {
    return {
        ...record,
        evidence: [...record.evidence],
        tags: [...record.tags],
    };
}
export function mergeRecords(existing, incoming) {
    const merged = new Map(existing.map((record) => [recordKey(record), cloneRecord(record)]));
    for (const record of incoming) {
        const key = recordKey(record);
        if (!merged.has(key)) {
            merged.set(key, cloneRecord(record));
            continue;
        }
        const current = merged.get(key);
        const currentEvidence = current.evidence;
        const incomingEvidence = record.evidence;
        merged.set(key, {
            ...current,
            summary: record.summary,
            confidence: Math.max(current.confidence ?? 0, record.confidence ?? 0),
            lastSeenAt: record.lastSeenAt,
            decayScore: Math.max(current.decayScore ?? 0, record.decayScore ?? 0),
            evidence: [...currentEvidence, ...incomingEvidence],
        });
    }
    return [...merged.values()];
}
export function saveFeatureMemory(feature, records, { cwd = process.cwd() } = {}) {
    const filePath = featureMemoryPath(cwd, feature);
    const current = readJson(filePath, { feature, records: [] });
    const next = {
        feature,
        records: mergeRecords(current.records ?? [], records),
    };
    writeJson(filePath, next);
    return next;
}
/**
 * 全量覆盖写入 feature memory，不与磁盘上的旧副本合并。
 *
 * 供 `rebuildFeatureMemory` 使用：它是对事件流的完整重放（projection），
 * 结果必须直接替换旧投影。若走 `saveFeatureMemory` 的 merge 路径，会把上一次
 * 投影当作"既有记录"再合并——`max(confidence)` 会掩盖偏好递减、evidence 会
 * 每次重放累积，破坏"派生状态可从事件流精确重建"的不变量。
 */
export function replaceFeatureMemory(feature, records, { cwd = process.cwd() } = {}) {
    const next = { feature, records };
    writeJson(featureMemoryPath(cwd, feature), next);
    return next;
}
export function saveFeatureSummary(feature, summary, { cwd = process.cwd() } = {}) {
    writeJson(featureSummaryPath(cwd, feature), summary);
    return summary;
}
export function saveGlobalMemory(records, { cwd = process.cwd() } = {}) {
    const filePath = globalMemoryPath(cwd);
    const current = readJson(filePath, { records: [] });
    const next = {
        records: mergeRecords(current.records ?? [], records),
    };
    writeJson(filePath, next);
    return next;
}
export function saveGlobalSummary(summary, { cwd = process.cwd() } = {}) {
    writeJson(globalSummaryPath(cwd), summary);
    return summary;
}
export const paths = {
    featureMemoryPath,
    featureSummaryPath,
    globalMemoryPath,
    globalSummaryPath,
};
