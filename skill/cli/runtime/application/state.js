import * as fs from 'node:fs';
import * as path from 'node:path';
import { appendLineSync, readJsonlTolerant } from '../../infrastructure/fs.js';
import { EVENT_TYPE_VALUES } from '../domain/event-types.js';
import { buildFeatureSummary, rebuildFeatureMemory, rebuildGlobalMemory } from './memory.js';
export function readJson(filePath) {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}
export function writeJson(filePath, data) {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n', 'utf8');
}
export function ensureDir(dirPath) {
    fs.mkdirSync(dirPath, { recursive: true });
}
export function ensureFeatureName(feature) {
    if (!feature)
        throw new Error('缺少 feature 参数');
}
export function readExecutionView(cwd, feature) {
    const execJsonPath = path.join(cwd, '.boss', feature, '.meta', 'execution.json');
    if (!fs.existsSync(execJsonPath)) {
        throw new Error(`未找到执行文件: ${path.relative(cwd, execJsonPath)}`);
    }
    return readJson(execJsonPath);
}
export function ensureEventsFile(cwd, feature) {
    const metaDir = path.join(cwd, '.boss', feature, '.meta');
    const eventsFile = path.join(metaDir, 'events.jsonl');
    if (!fs.existsSync(eventsFile)) {
        throw new Error(`未找到事件文件: ${path.relative(cwd, eventsFile)}`);
    }
    return eventsFile;
}
export function appendEvent(eventsFile, event) {
    let id = 1;
    if (fs.existsSync(eventsFile)) {
        // 只数能被解析的行：崩溃残留的损坏尾行不计入 id，避免 id 被虚增后与后续冲突。
        const { records } = readJsonlTolerant(eventsFile);
        id = records.length + 1;
    }
    const payload = { ...event, id };
    appendLineSync(eventsFile, JSON.stringify(payload));
    return payload;
}
export function appendRuntimeEvent(cwd, feature, eventType, data = {}) {
    if (!EVENT_TYPE_VALUES.includes(eventType)) {
        throw new Error(`无效事件类型: ${eventType}`);
    }
    const eventsFile = ensureEventsFile(cwd, feature);
    return appendEvent(eventsFile, {
        type: eventType,
        timestamp: new Date().toISOString(),
        data,
    });
}
export function refreshMemory(feature, cwd) {
    try {
        rebuildFeatureMemory(feature, { cwd });
        rebuildGlobalMemory({ cwd });
        buildFeatureSummary(feature, { cwd });
    }
    catch (err) {
        const message = err.message;
        process.stderr.write(`[boss-skill] memory refresh skipped: ${message}\n`);
    }
}
