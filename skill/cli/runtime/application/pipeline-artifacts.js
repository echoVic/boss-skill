/**
 * Pipeline artifact recording — event appending, artifact versioning,
 * backup, and skip-up-to logic.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { appendLineSync, readJsonlTolerant } from '../../infrastructure/fs.js';
import { EVENT_TYPES } from '../domain/event-types.js';
import { materializeState } from '../projectors/materialize-state.js';
import { collectCompletedArtifacts, loadDagForFeature } from './pipeline-dag.js';
import { appendEvent, ensureFeatureName, readExecutionView, refreshMemory } from './state.js';
export function getArtifactVersion(feature, artifactName, { cwd = process.cwd() } = {}) {
    ensureFeatureName(feature);
    const eventsFile = path.join(cwd, '.boss', feature, '.meta', 'events.jsonl');
    if (!fs.existsSync(eventsFile))
        return 0;
    return readJsonlTolerant(eventsFile).records.filter((e) => e.type === EVENT_TYPES.ARTIFACT_RECORDED && e.data.artifact === artifactName).length;
}
export function collectCompletedArtifactsVersioned(feature, { cwd = process.cwd() } = {}) {
    ensureFeatureName(feature);
    const eventsFile = path.join(cwd, '.boss', feature, '.meta', 'events.jsonl');
    if (!fs.existsSync(eventsFile))
        return new Map();
    const map = new Map();
    for (const event of readJsonlTolerant(eventsFile).records) {
        if (event.type === EVENT_TYPES.ARTIFACT_RECORDED) {
            const name = String(event.data.artifact);
            map.set(name, (map.get(name) ?? 0) + 1);
        }
    }
    return map;
}
function backupArtifactVersion(cwd, feature, artifactName, version) {
    const artifactPath = path.join(cwd, '.boss', feature, artifactName);
    if (!fs.existsSync(artifactPath))
        return;
    const versionsDir = path.join(cwd, '.boss', feature, '.versions');
    fs.mkdirSync(versionsDir, { recursive: true });
    fs.copyFileSync(artifactPath, path.join(versionsDir, `${artifactName}.v${version}`));
}
function readNextEventId(eventsFile) {
    // 与 state.appendEvent 一致：只数可解析的记录，损坏行不占用 id，避免 id 撞车
    return readJsonlTolerant(eventsFile).records.length + 1;
}
function assertSafeArtifactName(artifact) {
    if (artifact !== path.basename(artifact) ||
        path.isAbsolute(artifact) ||
        artifact.includes('/') ||
        artifact.includes('\\') ||
        artifact.split(/[\\/]/).includes('..') ||
        artifact.includes('..')) {
        throw new Error(`无效 artifact 路径: ${artifact}`);
    }
}
export function recordArtifact(feature, artifact, stage, { cwd = process.cwd() } = {}) {
    ensureFeatureName(feature);
    if (!artifact)
        throw new Error('缺少 artifact 参数');
    return recordArtifacts(feature, [artifact], stage, { cwd });
}
export function recordArtifacts(feature, artifacts, stage, { cwd = process.cwd(), beforeAppend, } = {}) {
    ensureFeatureName(feature);
    if (artifacts.length === 0)
        throw new Error('缺少 artifact 参数');
    for (const artifact of artifacts) {
        if (!artifact)
            throw new Error('缺少 artifact 参数');
        assertSafeArtifactName(artifact);
    }
    if (stage == null) {
        throw new Error('缺少 stage 参数');
    }
    const stageNumber = Number(stage);
    if (!Number.isInteger(stageNumber)) {
        throw new Error('stage 必须是整数');
    }
    if (stageNumber < 1 || stageNumber > 4) {
        throw new Error('stage 必须是 1-4');
    }
    const metaDir = path.join(cwd, '.boss', feature, '.meta');
    const eventsFile = path.join(metaDir, 'events.jsonl');
    if (!fs.existsSync(eventsFile)) {
        throw new Error(`未找到事件文件: ${path.relative(cwd, eventsFile)}`);
    }
    const versions = artifacts.map((artifact) => ({
        artifact,
        currentVersion: getArtifactVersion(feature, artifact, { cwd }),
    }));
    for (const version of versions) {
        if (version.currentVersion >= 1) {
            backupArtifactVersion(cwd, feature, version.artifact, version.currentVersion);
        }
    }
    const now = new Date().toISOString();
    const nextId = readNextEventId(eventsFile);
    const events = versions.map((version, index) => ({
        id: nextId + index,
        type: EVENT_TYPES.ARTIFACT_RECORDED,
        timestamp: now,
        data: {
            artifact: version.artifact,
            stage: stageNumber,
            version: version.currentVersion + 1,
        },
    }));
    const rollback = beforeAppend?.();
    try {
        for (const event of events) {
            appendLineSync(eventsFile, JSON.stringify(event));
        }
    }
    catch (err) {
        if (typeof rollback === 'function') {
            rollback();
        }
        throw err;
    }
    const { state } = materializeState(feature, cwd);
    refreshMemory(feature, cwd);
    return state;
}
export function skipUpTo(feature, artifactName, { cwd = process.cwd(), dagPath } = {}) {
    ensureFeatureName(feature);
    if (!artifactName)
        throw new Error('缺少 artifact 参数');
    const { dag } = loadDagForFeature(cwd, feature, dagPath);
    const artifacts = dag.artifacts || {};
    if (!artifacts[artifactName]) {
        throw new Error(`DAG 中未定义产物: ${artifactName}`);
    }
    const toSkip = new Set();
    const queue = [artifactName];
    while (queue.length > 0) {
        const current = queue.pop();
        if (toSkip.has(current))
            continue;
        toSkip.add(current);
        const def = artifacts[current];
        if (def && Array.isArray(def.inputs)) {
            for (const input of def.inputs) {
                if (!toSkip.has(input))
                    queue.push(input);
            }
        }
    }
    const execution = readExecutionView(cwd, feature);
    const completed = collectCompletedArtifacts(execution);
    const skipped = [];
    const eventsFile = path.join(cwd, '.boss', feature, '.meta', 'events.jsonl');
    for (const name of toSkip) {
        const def = artifacts[name];
        if (!def)
            continue;
        if (def.type === 'gate')
            continue;
        skipped.push(name);
        if (completed.has(name))
            continue;
        const stage = typeof def.stage === 'number' ? def.stage : 1;
        if (stage < 1)
            continue;
        appendEvent(eventsFile, {
            type: EVENT_TYPES.ARTIFACT_RECORDED,
            timestamp: new Date().toISOString(),
            data: { artifact: name, stage, version: 1 },
        });
    }
    materializeState(feature, cwd);
    refreshMemory(feature, cwd);
    return skipped;
}
