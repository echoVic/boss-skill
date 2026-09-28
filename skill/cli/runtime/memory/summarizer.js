import { queryAgentMemories } from './query.js';
export function buildStartupSummary(records, { limit = 3 } = {}) {
    return records
        .slice()
        .sort((left, right) => {
        if ((right.decayScore ?? 0) !== (left.decayScore ?? 0)) {
            return (right.decayScore ?? 0) - (left.decayScore ?? 0);
        }
        return (right.confidence ?? 0) - (left.confidence ?? 0);
    })
        .slice(0, limit)
        .map((record) => ({
        category: record.category,
        scope: record.scope,
        summary: record.summary,
    }));
}
export function buildAgentSections(records, agents) {
    const sections = {};
    for (const agent of agents) {
        sections[agent.name] = queryAgentMemories(records, {
            agent: agent.name,
            stage: agent.stage,
            limit: 3,
        }).map((record) => ({
            category: record.category,
            summary: record.summary,
        }));
    }
    return sections;
}
export function buildConversationSummary(records, { limit = 3 } = {}) {
    return records
        .slice()
        .filter((record) => record.category.startsWith('conversation_'))
        .sort((left, right) => {
        const rightScore = (right.decayScore ?? 0) * 100 + (right.confidence ?? 0) * 10;
        const leftScore = (left.decayScore ?? 0) * 100 + (left.confidence ?? 0) * 10;
        return rightScore - leftScore;
    })
        .slice(0, limit)
        .map((record) => ({
        category: record.category,
        summary: record.summary,
        scope: record.scope,
    }));
}
