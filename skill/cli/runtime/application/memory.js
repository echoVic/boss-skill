import * as fs from 'node:fs';
import * as path from 'node:path';
import { readJsonlTolerant } from '../../infrastructure/fs.js';
import { extractFeatureMemories } from '../memory/extractor.js';
import { extractPreferenceMemories } from '../memory/preferences.js';
import { queryAgentMemories } from '../memory/query.js';
import { paths, replaceFeatureMemory, saveFeatureMemory, saveFeatureSummary, saveGlobalMemory, saveGlobalSummary, } from '../memory/store.js';
import { buildAgentSections, buildConversationSummary, buildStartupSummary, } from '../memory/summarizer.js';
function readJson(filePath, fallback) {
    if (!fs.existsSync(filePath)) {
        return fallback;
    }
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}
function readExecution(feature, { cwd = process.cwd() } = {}) {
    const filePath = paths
        .featureMemoryPath(cwd, feature)
        .replace('feature-memory.json', 'execution.json');
    return readJson(filePath, null);
}
function readEvents(feature, { cwd = process.cwd() } = {}) {
    const filePath = paths
        .featureMemoryPath(cwd, feature)
        .replace('feature-memory.json', 'events.jsonl');
    if (!fs.existsSync(filePath)) {
        return [];
    }
    return readJsonlTolerant(filePath).records;
}
export function readFeatureMemory(feature, { cwd = process.cwd() } = {}) {
    const filePath = paths.featureMemoryPath(cwd, feature);
    return readJson(filePath, { feature, records: [] });
}
export function readFeatureSummary(feature, { cwd = process.cwd() } = {}) {
    const filePath = paths.featureSummaryPath(cwd, feature);
    return readJson(filePath, {
        feature,
        generatedAt: null,
        startupSummary: [],
        agentSections: {},
    });
}
export function readGlobalMemory({ cwd = process.cwd() } = {}) {
    return readJson(paths.globalMemoryPath(cwd), { records: [] });
}
export function writeFeatureMemory(feature, records, { cwd = process.cwd() } = {}) {
    return saveFeatureMemory(feature, records, { cwd });
}
export function rebuildFeatureMemory(feature, { cwd = process.cwd(), now = new Date().toISOString() } = {}) {
    const execution = readExecution(feature, { cwd }) ?? { parameters: {}, stages: {} };
    const events = readEvents(feature, { cwd });
    const records = [
        ...extractFeatureMemories({ feature, execution, events, now }),
        // 用户选择偏好：对事件流做确定性 fold，与其余 memory 记录同源、可重放
        ...extractPreferenceMemories(feature, events),
    ];
    // 全量替换而非 merge：这是一次完整重放，结果必须直接覆盖旧投影
    return replaceFeatureMemory(feature, records, { cwd });
}
export function buildFeatureSummary(feature, { cwd = process.cwd() } = {}) {
    const payload = readFeatureMemory(feature, { cwd });
    const globalPayload = readGlobalMemory({ cwd });
    const execution = readExecution(feature, { cwd }) ?? { stages: {} };
    const agents = [];
    for (const [stageId, stage] of Object.entries(execution.stages ?? {})) {
        for (const agentName of Object.keys(stage.agents ?? {})) {
            agents.push({ name: agentName, stage: Number(stageId) });
        }
    }
    const combined = [...(payload.records ?? []), ...(globalPayload.records ?? [])];
    const summary = {
        feature,
        generatedAt: new Date().toISOString(),
        startupSummary: buildStartupSummary(combined),
        agentSections: {
            ...buildAgentSections(combined, agents),
            conversation: buildConversationSummary(combined),
        },
        conversationSummary: buildConversationSummary(combined),
    };
    saveFeatureSummary(feature, summary, { cwd });
    return summary;
}
export function rebuildGlobalMemory({ cwd = process.cwd() } = {}) {
    const bossRoot = path.join(cwd, '.boss');
    const features = fs.existsSync(bossRoot)
        ? fs
            .readdirSync(bossRoot)
            .filter((name) => !name.startsWith('.') && fs.existsSync(paths.featureMemoryPath(cwd, name)))
        : [];
    const grouped = new Map();
    for (const feature of features) {
        const payload = readFeatureMemory(feature, { cwd });
        for (const record of payload.records ?? []) {
            const key = [
                record.category,
                record.stage ?? '',
                record.agent ?? '',
                ...(record.tags ?? []),
            ].join(':');
            const bucket = grouped.get(key) ?? [];
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
            summary: latest.summary,
        });
    }
    const memory = saveGlobalMemory(promoted, { cwd });
    const summary = {
        generatedAt: new Date().toISOString(),
        startupSummary: buildStartupSummary(memory.records ?? []),
        agentSections: {},
    };
    saveGlobalSummary(summary, { cwd });
    return memory;
}
export function queryAgentSection(feature, { cwd = process.cwd(), agent, stage, limit = 3, } = {}) {
    const summary = readFeatureSummary(feature, { cwd });
    const summarySection = summary.agentSections && agent && summary.agentSections[agent]
        ? summary.agentSections[agent]
        : [];
    if (summarySection.length > 0) {
        return summarySection.slice(0, limit);
    }
    const payload = readFeatureMemory(feature, { cwd });
    const globalPayload = readGlobalMemory({ cwd });
    return queryAgentMemories([...(payload.records ?? []), ...(globalPayload.records ?? [])], {
        agent,
        stage,
        limit,
    }).map((record) => ({
        category: record.category,
        summary: record.summary,
        scope: record.scope,
    }));
}
