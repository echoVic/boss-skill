import * as fs from 'node:fs';
import * as path from 'node:path';
import { listPipelinePackManifestPaths } from '../assets.js';
function readJson(filePath) {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}
function clone(value) {
    return JSON.parse(JSON.stringify(value));
}
function isObject(value) {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}
function listPackDefinitions(projectDir = process.cwd()) {
    const packs = [];
    for (const item of listPipelinePackManifestPaths({ cwd: projectDir })) {
        const pipeline = readJson(item.path);
        if (pipeline.enabled === false)
            continue;
        packs.push({
            name: typeof pipeline.name === 'string' && pipeline.name.length > 0 ? pipeline.name : item.name,
            version: typeof pipeline.version === 'string' ? pipeline.version : '',
            type: typeof pipeline.type === 'string' ? pipeline.type : '',
            priority: Number.isFinite(Number(pipeline.priority)) ? Number(pipeline.priority) : 0,
            when: isObject(pipeline.when) ? pipeline.when : null,
            config: isObject(pipeline.config) ? pipeline.config : {},
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
            dependencies: isObject(pkg.dependencies) ? pkg.dependencies : {},
            devDependencies: isObject(pkg.devDependencies) ? pkg.devDependencies : {},
        };
    }
    catch {
        return { dependencies: {}, devDependencies: {} };
    }
}
function evaluateWhen(projectDir, when) {
    if (!when || typeof when !== 'object')
        return { matched: false, evidence: [] };
    const evidence = [];
    if (Array.isArray(when.fileExists)) {
        for (const relPath of when.fileExists) {
            evidence.push({
                type: 'fileExists',
                value: relPath,
                matched: fs.existsSync(path.join(projectDir, relPath)),
            });
        }
    }
    if (Array.isArray(when.noFileExists)) {
        for (const relPath of when.noFileExists) {
            evidence.push({
                type: 'noFileExists',
                value: relPath,
                matched: !fs.existsSync(path.join(projectDir, relPath)),
            });
        }
    }
    if (Array.isArray(when.packageJsonHas) && when.packageJsonHas.length > 0) {
        const deps = getPackageDeps(projectDir);
        for (const dep of when.packageJsonHas) {
            evidence.push({
                type: 'packageJsonHas',
                value: dep,
                matched: dep in deps.dependencies || dep in deps.devDependencies,
            });
        }
    }
    return {
        matched: evidence.length > 0 && evidence.every((item) => item.matched),
        evidence,
    };
}
export function resolvePipelinePack(projectDir = process.cwd()) {
    return detectPipelinePacks(projectDir).detected;
}
export function detectPipelinePacks(projectDir = process.cwd()) {
    const packs = listPackDefinitions(projectDir);
    const defaultPack = packs.find((pack) => pack.name === 'default') ?? {
        name: 'default',
        version: '',
        type: 'pipeline-pack',
        priority: 0,
        when: null,
        config: {},
    };
    const evaluated = packs.map((pack) => ({
        pack,
        evaluation: evaluateWhen(projectDir, pack.when),
    }));
    const matched = evaluated
        .filter(({ evaluation }) => evaluation.matched)
        .map(({ pack, evaluation }) => ({ ...pack, evidence: evaluation.evidence }))
        .sort((left, right) => right.priority - left.priority);
    const selected = matched[0] ?? defaultPack;
    const detected = {
        name: selected.name,
        version: selected.version,
        type: selected.type,
        priority: selected.priority,
        when: selected.when,
        evidence: clone(selected.evidence ?? []),
        config: clone(selected.config ?? {}),
    };
    return {
        detected,
        matched: matched.map((pack) => ({
            name: pack.name,
            version: pack.version,
            type: pack.type,
            priority: pack.priority,
            when: pack.when,
            evidence: clone(pack.evidence ?? []),
            config: clone(pack.config ?? {}),
        })),
    };
}
export function getPackStateParameters(pack) {
    const config = pack && pack.config && typeof pack.config === 'object'
        ? pack.config
        : {};
    // stages / agentStages 从未被任何代码消费——阶段实际由 artifact DAG 决定。
    // 与其继续静默忽略，不如明确告知：照文档写了却没有效果，比报错更难排查。
    for (const key of ['stages', 'agentStages']) {
        if (config[key] !== undefined) {
            process.stderr.write(`[boss-skill] pipeline pack「${pack?.name ?? 'unknown'}」声明了 config.${key}，但阶段由 config.artifactDag 决定，该字段不会生效；请移除它。\n`);
        }
    }
    const parameters = {
        pipelinePack: pack?.name || 'default',
        pipelinePackVersion: pack?.version || '',
        enabledGates: Array.isArray(config.gates) ? clone(config.gates) : [],
        activeAgents: Array.isArray(config.agents) ? clone(config.agents) : [],
        packConfig: clone(config),
    };
    if (config.roles !== undefined)
        parameters.roles = config.roles;
    if (config.techStack && typeof config.techStack === 'object') {
        parameters.techStack = clone(config.techStack);
    }
    for (const flag of ['skipUI', 'skipDeploy', 'skipFrontend', 'skipReview']) {
        if (typeof config[flag] === 'boolean') {
            parameters[flag] = config[flag];
        }
    }
    return parameters;
}
