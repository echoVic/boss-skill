#!/usr/bin/env node
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { consumeCliContractOption, createCliContext, describeCommand, readJsonInput, runMain, writeOutput, } from '../../cli/contract.js';
import { runtimeCommandDescriptions } from '../../cli/registry.js';
import { evaluateAgentReuse } from '../../runtime/application/pipeline.js';
import { optionalInputString, printRuntimeHelp, requireInputString, requireOptionValue, toFeatureNotFoundError, } from './agent-command-utils.js';
function showHelp() {
    printRuntimeHelp('agent-cache', 'boss runtime agent-cache FEATURE STAGE AGENT [options]');
}
function parseCsv(value) {
    if (!value)
        return [];
    return value
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean);
}
function parseJsonObject(value, label) {
    if (!value)
        return undefined;
    let parsed;
    try {
        parsed = JSON.parse(value);
    }
    catch {
        throw new Error(`${label} 不是有效的 JSON`);
    }
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        throw new Error(`${label} 必须是 JSON 对象`);
    }
    return parsed;
}
function parseFlatInput(argv) {
    let feature = '';
    let stage = '';
    let agent = '';
    let prompt;
    let promptFingerprint;
    let dependencyArtifacts = [];
    let opts;
    for (let index = 0; index < argv.length; index += 1) {
        const arg = argv[index];
        if (arg === '--prompt') {
            prompt = requireOptionValue('--prompt', argv[index + 1]);
            index += 1;
            continue;
        }
        if (arg === '--prompt-fingerprint') {
            promptFingerprint = requireOptionValue('--prompt-fingerprint', argv[index + 1]);
            index += 1;
            continue;
        }
        if (arg === '--depends-on') {
            dependencyArtifacts = parseCsv(requireOptionValue('--depends-on', argv[index + 1]));
            index += 1;
            continue;
        }
        if (arg === '--opts') {
            opts = parseJsonObject(requireOptionValue('--opts', argv[index + 1]), '--opts');
            index += 1;
            continue;
        }
        const contractOptionEnd = consumeCliContractOption(argv, index);
        if (contractOptionEnd !== null) {
            index = contractOptionEnd;
            continue;
        }
        if (arg.startsWith('-'))
            throw new Error(`未知选项: ${arg}`);
        if (!feature)
            feature = arg;
        else if (!stage)
            stage = arg;
        else if (!agent)
            agent = arg;
        else
            throw new Error(`多余的参数: ${arg}`);
    }
    return {
        feature: requireInputString(feature, 'feature'),
        stage: requireInputString(stage, 'stage'),
        agent: requireInputString(agent, 'agent'),
        prompt,
        promptFingerprint,
        dependencyArtifacts,
        opts,
    };
}
function resolveInput(argv, context) {
    const jsonInput = readJsonInput(context.values.jsonInput);
    if (jsonInput) {
        const input = jsonInput;
        return {
            feature: requireInputString(input.feature, 'feature'),
            stage: requireInputString(input.stage, 'stage'),
            agent: requireInputString(input.agent, 'agent'),
            prompt: optionalInputString(input.prompt),
            promptFingerprint: optionalInputString(input.promptFingerprint),
            dependencyArtifacts: Array.isArray(input.dependencyArtifacts)
                ? input.dependencyArtifacts.filter((item) => typeof item === 'string' && item.length > 0)
                : [],
            opts: input.opts && typeof input.opts === 'object' && !Array.isArray(input.opts)
                ? input.opts
                : undefined,
        };
    }
    return parseFlatInput(argv);
}
export function main(argv = process.argv.slice(2), { cwd = process.cwd() } = {}) {
    const context = createCliContext(argv, { command: 'boss runtime agent-cache' });
    if (context.values.describe) {
        writeOutput(describeCommand(runtimeCommandDescriptions['agent-cache']), context, () => `${JSON.stringify(runtimeCommandDescriptions['agent-cache'], null, 2)}\n`);
        return 0;
    }
    if (argv.length === 0 || argv.includes('-h') || argv.includes('--help')) {
        showHelp();
        return argv.length === 0 ? 1 : 0;
    }
    const input = resolveInput(argv, context);
    try {
        const decision = evaluateAgentReuse(input.feature, input.stage, input.agent, {
            cwd,
            prompt: input.prompt,
            promptFingerprint: input.promptFingerprint,
            dependencyArtifacts: input.dependencyArtifacts,
            opts: input.opts || {},
        });
        writeOutput({
            feature: input.feature,
            stage: Number(input.stage),
            agent: input.agent,
            ...decision,
        }, context, (data) => {
            const payload = data;
            return `Agent ${input.agent}: ${payload.reusable ? 'reusable' : 'rerun'} (${payload.reason})\n`;
        });
        return 0;
    }
    catch (err) {
        throw toFeatureNotFoundError(err, input.feature);
    }
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    const context = createCliContext(process.argv.slice(2), {
        command: 'boss runtime agent-cache',
        validateOptionValues: false,
    });
    process.exit(await runMain(() => main(process.argv.slice(2), { cwd: process.cwd() }), context));
}
