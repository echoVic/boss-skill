#!/usr/bin/env node
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createCliContext, describeCommand, runMain, writeOutput } from '../../cli/contract.js';
import { runtimeCommandDescriptions } from '../../cli/registry.js';
import { printRuntimeHelp } from './agent-command-utils.js';
import { listConversationsRuntime, renderConversationListText, toFeatureNotFoundError, } from './conversation-command-utils.js';
function showHelp() {
    printRuntimeHelp('list-conversations', 'boss runtime list-conversations FEATURE [options]');
}
function resolveFeature(argv) {
    const feature = argv.find((arg) => !arg.startsWith('-'));
    if (!feature) {
        throw new Error('缺少 feature 参数');
    }
    return feature;
}
export function main(argv = process.argv.slice(2), { cwd = process.cwd() } = {}) {
    const context = createCliContext(argv, { command: 'boss runtime list-conversations' });
    if (context.values.describe) {
        writeOutput(describeCommand(runtimeCommandDescriptions['list-conversations']), context, () => `${JSON.stringify(runtimeCommandDescriptions['list-conversations'], null, 2)}\n`);
        return 0;
    }
    if (argv.length === 0 || argv.includes('-h') || argv.includes('--help')) {
        showHelp();
        return argv.length === 0 ? 1 : 0;
    }
    const feature = resolveFeature(argv);
    try {
        const payload = listConversationsRuntime(feature, context, { cwd });
        writeOutput(payload, context, (data) => renderConversationListText(data));
        return 0;
    }
    catch (err) {
        throw toFeatureNotFoundError(err, feature);
    }
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    const context = createCliContext(process.argv.slice(2), {
        command: 'boss runtime list-conversations',
    });
    process.exit(await runMain(() => main(process.argv.slice(2), { cwd: process.cwd() }), context));
}
