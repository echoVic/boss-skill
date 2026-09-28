import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { resolveBuiltInAssetPath } from '../assets.js';
import { EVENT_TYPES } from '../domain/event-types.js';
import { materializeState } from '../projectors/materialize-state.js';
import { appendRuntimeEvent, ensureFeatureName, readExecutionView, readJson, refreshMemory, } from './state.js';
const DEFAULT_DAG_PATH = resolveBuiltInAssetPath('artifact-dag.json');
const NPM_CMD = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const NPX_CMD = process.platform === 'win32' ? 'npx.cmd' : 'npx';
function resolveGateScript(cwd, gateName, skipOnError) {
    const pluginDirs = [
        path.join(cwd, '.boss', 'plugins', gateName),
        resolveBuiltInAssetPath('plugins', gateName),
    ];
    for (const pluginDir of pluginDirs) {
        const pluginJson = path.join(pluginDir, 'plugin.json');
        if (fs.existsSync(pluginJson)) {
            try {
                const plugin = readJson(pluginJson);
                const hooks = plugin.hooks && typeof plugin.hooks === 'object'
                    ? plugin.hooks
                    : {};
                if (typeof hooks.gate === 'string' && hooks.gate.length > 0) {
                    const hookPath = path.join(pluginDir, hooks.gate);
                    if (fs.existsSync(hookPath))
                        return hookPath;
                }
            }
            catch {
                // Fall through to legacy gate.sh resolution for hand-written local plugins.
            }
        }
        const legacyGate = path.join(pluginDir, 'gate.sh');
        if (fs.existsSync(legacyGate))
            return legacyGate;
    }
    if (skipOnError)
        return '';
    throw new Error(`门禁脚本未找到: ${gateName}`);
}
function isBuiltInGate(gateName) {
    return gateName === 'gate0' || gateName === 'gate1' || gateName === 'gate2';
}
function resolveGateStage(cwd, gateName) {
    // Try to resolve from DAG first
    try {
        const dag = readJson(DEFAULT_DAG_PATH);
        const gateDef = dag.artifacts?.[gateName];
        if (gateDef && gateDef.type === 'gate' && typeof gateDef.stage === 'number') {
            return gateDef.stage;
        }
    }
    catch {
        /* fall through to legacy resolution */
    }
    if (gateName === 'gate0' || gateName === 'gate1' || gateName === 'gate2') {
        return 3;
    }
    const pluginJsonPaths = [
        path.join(cwd, '.boss', 'plugins', gateName, 'plugin.json'),
        path.join(resolveBuiltInAssetPath('plugins', gateName), 'plugin.json'),
    ];
    for (const pluginJson of pluginJsonPaths) {
        if (!fs.existsSync(pluginJson))
            continue;
        try {
            const plugin = readJson(pluginJson);
            if (plugin && Array.isArray(plugin.stages) && plugin.stages.length > 0) {
                const stage = Number(plugin.stages[0]);
                if (Number.isInteger(stage) && stage >= 1)
                    return stage;
            }
        }
        catch {
            return 3;
        }
    }
    return 3;
}
function parseGateChecks(output) {
    if (!output)
        return [];
    const trimmed = output.trim();
    if (!trimmed)
        return [];
    if (trimmed.startsWith('[')) {
        try {
            const parsed = JSON.parse(trimmed);
            if (Array.isArray(parsed))
                return parsed;
        }
        catch {
            // fall through to line parsing
        }
    }
    return trimmed
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean);
}
function check(name, passed, detail) {
    return detail ? { name, passed, detail } : { name, passed };
}
function commandExists(command) {
    const result = spawnSync(command, ['--version'], {
        encoding: 'utf8',
        stdio: ['ignore', 'ignore', 'ignore'],
    });
    return !result.error;
}
function runCommand(command, args, cwd) {
    const result = spawnSync(command, args, {
        cwd,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
    });
    return {
        status: result.status ?? 1,
        output: `${result.stdout || ''}${result.stderr || ''}`.trim().split('\n').slice(-30).join('\n'),
    };
}
function readPackageJson(cwd) {
    const pkgPath = path.join(cwd, 'package.json');
    if (!fs.existsSync(pkgPath))
        return {};
    try {
        return readJson(pkgPath);
    }
    catch {
        return {};
    }
}
function depsContain(pkg, name) {
    const deps = pkg.dependencies && typeof pkg.dependencies === 'object'
        ? pkg.dependencies
        : {};
    const devDeps = pkg.devDependencies && typeof pkg.devDependencies === 'object'
        ? pkg.devDependencies
        : {};
    return name in deps || name in devDeps;
}
function findFiles(dir, predicate, max = 1) {
    const results = [];
    function walk(current) {
        if (results.length >= max)
            return;
        for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
            if (entry.name === 'node_modules' || entry.name === '.git')
                continue;
            const fullPath = path.join(current, entry.name);
            if (entry.isDirectory()) {
                walk(fullPath);
            }
            else if (predicate(fullPath)) {
                results.push(fullPath);
                if (results.length >= max)
                    return;
            }
        }
    }
    if (fs.existsSync(dir))
        walk(dir);
    return results;
}
function fileContains(cwd, extensions, pattern) {
    return (findFiles(cwd, (file) => {
        if (!extensions.some((ext) => file.endsWith(ext)))
            return false;
        try {
            return pattern.test(fs.readFileSync(file, 'utf8'));
        }
        catch {
            return false;
        }
    }).length > 0);
}
function runGate0(cwd) {
    const checks = [];
    const logs = ['[GATE0] Gate 0: 代码质量检查'];
    let passed = true;
    if (fs.existsSync(path.join(cwd, 'tsconfig.json')) && commandExists(NPX_CMD)) {
        const result = runCommand(NPX_CMD, ['tsc', '--noEmit'], cwd);
        checks.push(check('typescript-compile', result.status === 0, result.status === 0 ? undefined : 'tsc --noEmit 失败'));
        if (result.output)
            logs.push(result.output);
        passed &&= result.status === 0;
    }
    else {
        checks.push(check('typescript-compile', true, '跳过：无 tsconfig.json'));
    }
    let lintFound = false;
    if (fs.existsSync(path.join(cwd, 'biome.json')) || fs.existsSync(path.join(cwd, 'biome.jsonc'))) {
        lintFound = true;
        const result = runCommand(NPX_CMD, ['biome', 'check', '.'], cwd);
        checks.push(check('lint', result.status === 0, result.status === 0 ? undefined : 'biome check 失败'));
        if (result.output)
            logs.push(result.output);
        passed &&= result.status === 0;
    }
    else if ([
        '.eslintrc',
        '.eslintrc.js',
        '.eslintrc.json',
        '.eslintrc.yml',
        'eslint.config.js',
        'eslint.config.mjs',
    ].some((name) => fs.existsSync(path.join(cwd, name)))) {
        lintFound = true;
        const result = runCommand(NPX_CMD, ['eslint', '.', '--max-warnings=0'], cwd);
        checks.push(check('lint', result.status === 0, result.status === 0 ? undefined : 'eslint 有 error'));
        if (result.output)
            logs.push(result.output);
        passed &&= result.status === 0;
    }
    if (!lintFound)
        checks.push(check('lint', true, '跳过：无 Lint 配置'));
    if (fs.existsSync(path.join(cwd, 'package.json')) && commandExists(NPM_CMD)) {
        const audit = spawnSync(NPM_CMD, ['audit', '--json'], {
            cwd,
            encoding: 'utf8',
            stdio: ['ignore', 'pipe', 'ignore'],
        });
        let severe = 0;
        try {
            const parsed = JSON.parse(audit.stdout || '{}');
            severe =
                Number(parsed.metadata?.vulnerabilities?.high ?? 0) +
                    Number(parsed.metadata?.vulnerabilities?.critical ?? 0);
        }
        catch {
            severe = 0;
        }
        checks.push(check('dependency-audit', severe === 0, severe > 0 ? `${severe} 个高危漏洞` : undefined));
        passed &&= severe === 0;
    }
    else {
        checks.push(check('dependency-audit', true, '跳过：无 package.json'));
    }
    const secretPatterns = [
        /AKIA[0-9A-Z]{16}/,
        /-----BEGIN (RSA |EC |DSA )?PRIVATE KEY-----/,
        /ghp_[a-zA-Z0-9]{36}/,
        /sk-[a-zA-Z0-9]{48}/,
    ];
    const secretHits = secretPatterns.filter((pattern) => fileContains(cwd, ['.ts', '.js', '.py', '.go', '.env', '.yaml', '.yml'], pattern)).length;
    checks.push(check('secrets-scan', secretHits === 0, secretHits > 0 ? `${secretHits} 类敏感信息模式` : undefined));
    passed &&= secretHits === 0;
    const unsafeHits = [
        fileContains(cwd, ['.js', '.ts'], /eval\(/),
        fileContains(cwd, ['.jsx', '.tsx'], /dangerouslySetInnerHTML/),
        fileContains(cwd, ['.js', '.ts'], /innerHTML\s*=/),
    ].filter(Boolean).length;
    checks.push(check('unsafe-patterns', unsafeHits === 0, unsafeHits > 0 ? `发现 ${unsafeHits} 类不安全模式` : undefined));
    passed &&= unsafeHits === 0;
    return {
        status: passed ? 0 : 1,
        stdout: `${JSON.stringify(checks)}\n`,
        stderr: `${logs.join('\n')}\n`,
    };
}
function runGate1(cwd, coverageThreshold) {
    const checks = [];
    const logs = ['[GATE1] Gate 1: 测试门禁'];
    let passed = true;
    const pkg = readPackageJson(cwd);
    let testCommand = null;
    let coverageCommand = null;
    if (fs.existsSync(path.join(cwd, 'package.json'))) {
        if (depsContain(pkg, 'vitest')) {
            testCommand = [NPX_CMD, ['vitest', 'run']];
            coverageCommand = [NPX_CMD, ['vitest', 'run', '--coverage', '--reporter=json']];
        }
        else if (depsContain(pkg, 'jest')) {
            testCommand = [NPX_CMD, ['jest']];
            coverageCommand = [NPX_CMD, ['jest', '--coverage', '--coverageReporters=json-summary']];
        }
        else {
            const scripts = pkg.scripts && typeof pkg.scripts === 'object'
                ? pkg.scripts
                : {};
            if (typeof scripts.test === 'string' &&
                scripts.test !== 'echo "Error: no test specified" && exit 1') {
                testCommand = [NPM_CMD, ['test']];
            }
        }
    }
    else if (fs.existsSync(path.join(cwd, 'pyproject.toml')) && commandExists('pytest')) {
        testCommand = ['pytest', []];
        coverageCommand = ['pytest', ['--cov', '--cov-report=json']];
    }
    else if (fs.existsSync(path.join(cwd, 'Cargo.toml'))) {
        testCommand = ['cargo', ['test']];
    }
    else if (fs.existsSync(path.join(cwd, 'go.mod'))) {
        testCommand = ['go', ['test', './...']];
        coverageCommand = ['go', ['test', '-coverprofile=coverage.out', './...']];
    }
    if (!testCommand) {
        checks.push(check('unit-tests', true, '跳过：未检测到测试框架'));
        checks.push(check('coverage', true, '跳过：未检测到测试框架'));
        checks.push(check('e2e-tests', true, '跳过：未检测到测试框架'));
        return { status: 0, stdout: `${JSON.stringify(checks)}\n`, stderr: `${logs.join('\n')}\n` };
    }
    const testResult = runCommand(testCommand[0], testCommand[1], cwd);
    checks.push(check('unit-tests', testResult.status === 0, testResult.status === 0 ? undefined : `${testCommand.join(' ')} 执行失败`));
    if (testResult.output)
        logs.push(testResult.output);
    passed &&= testResult.status === 0;
    if (coverageCommand) {
        runCommand(coverageCommand[0], coverageCommand[1], cwd);
        let pct = null;
        const summaryPath = path.join(cwd, 'coverage', 'coverage-summary.json');
        const coverageJson = path.join(cwd, 'coverage.json');
        if (fs.existsSync(summaryPath)) {
            const summary = readJson(summaryPath);
            pct = Number(summary.total?.lines?.pct ?? summary.total?.statements?.pct ?? NaN);
        }
        else if (fs.existsSync(coverageJson)) {
            const summary = readJson(coverageJson);
            pct = Number(summary.totals?.percent_covered ?? NaN);
        }
        if (pct != null && Number.isFinite(pct)) {
            const ok = Math.floor(pct) >= coverageThreshold;
            checks.push(check('coverage', ok, `${pct}%${ok ? '' : ` < ${coverageThreshold}%`}`));
            passed &&= ok;
        }
        else {
            checks.push(check('coverage', true, '无法解析覆盖率，跳过'));
        }
    }
    else {
        checks.push(check('coverage', true, '跳过：无覆盖率工具'));
    }
    if (fs.existsSync(path.join(cwd, 'playwright.config.ts')) ||
        fs.existsSync(path.join(cwd, 'playwright.config.js'))) {
        const result = runCommand(NPX_CMD, ['playwright', 'test'], cwd);
        checks.push(check('e2e-tests', result.status === 0, result.status === 0 ? 'Playwright' : 'Playwright 测试失败'));
        passed &&= result.status === 0;
    }
    else if (fs.existsSync(path.join(cwd, 'cypress.config.ts')) ||
        fs.existsSync(path.join(cwd, 'cypress.config.js'))) {
        const result = runCommand(NPX_CMD, ['cypress', 'run'], cwd);
        checks.push(check('e2e-tests', result.status === 0, result.status === 0 ? 'Cypress' : 'Cypress 测试失败'));
        passed &&= result.status === 0;
    }
    else {
        checks.push(check('e2e-tests', true, '跳过：未检测到 E2E 测试框架'));
    }
    return {
        status: passed ? 0 : 1,
        stdout: `${JSON.stringify(checks)}\n`,
        stderr: `${logs.join('\n')}\n`,
    };
}
function runGate2(cwd) {
    const checks = [];
    const logs = ['[GATE2] Gate 2: 性能门禁'];
    const pkg = readPackageJson(cwd);
    const isWeb = ['next', 'react', 'vue', 'svelte', '@angular/core'].some((dep) => depsContain(pkg, dep));
    const hasApi = ['express', 'fastify', 'koa', 'hono'].some((dep) => depsContain(pkg, dep)) ||
        ['go.mod', 'requirements.txt', 'pyproject.toml'].some((file) => fs.existsSync(path.join(cwd, file)));
    checks.push(check('lighthouse', true, isWeb ? '跳过：未执行 Lighthouse（TS gate 暂不启动浏览器服务）' : '跳过：非 Web 前端项目'));
    checks.push(check('api-p99', true, hasApi ? '跳过：未执行 API 压测（服务可能未启动）' : '跳过：无 API 框架'));
    return { status: 0, stdout: `${JSON.stringify(checks)}\n`, stderr: `${logs.join('\n')}\n` };
}
function runBuiltInGate(gateName, cwd, coverageThreshold) {
    if (gateName === 'gate0')
        return runGate0(cwd);
    if (gateName === 'gate1')
        return runGate1(cwd, coverageThreshold);
    if (gateName === 'gate2')
        return runGate2(cwd);
    throw new Error(`未知内置门禁: ${gateName}`);
}
export function resolveGateConfig(feature, _gateName, { cwd = process.cwd() } = {}) {
    const defaults = { coverage: 70 };
    try {
        const execution = readExecutionView(cwd, feature);
        const packConfig = execution.parameters?.packConfig;
        return { coverage: packConfig?.gateConfig?.coverage ?? defaults.coverage };
    }
    catch {
        return defaults;
    }
}
export function evaluateGates(feature, gateName, { cwd = process.cwd(), dryRun = false, skipOnError = false, } = {}) {
    ensureFeatureName(feature);
    if (!gateName)
        throw new Error('缺少 gate-name 参数');
    readExecutionView(cwd, feature);
    // pack 的 config.gates 声明启用哪些门禁；此前没有读取方，声明了也照跑不误。
    // 未启用的门禁按「跳过」处理，而不是判失败——它本就不属于这条流水线。
    // 只约束内置门禁：config.gates 声明的是「内置门禁的子集」，
    // 插件门禁来自 .boss/plugins，不在该列表里并不代表被禁用。
    const packGates = readExecutionView(cwd, feature).parameters?.enabledGates;
    if (isBuiltInGate(gateName) &&
        Array.isArray(packGates) &&
        packGates.length > 0 &&
        !packGates.includes(gateName)) {
        return {
            gate: gateName,
            passed: true,
            checks: [],
            skipped: true,
            execution: readExecutionView(cwd, feature),
        };
    }
    const gateConfig = resolveGateConfig(feature, gateName, { cwd });
    let result;
    if (isBuiltInGate(gateName)) {
        result = runBuiltInGate(gateName, cwd, gateConfig.coverage);
    }
    else {
        const gateScript = resolveGateScript(cwd, gateName, skipOnError);
        if (!gateScript) {
            return {
                gate: gateName,
                passed: true,
                checks: [],
                skipped: true,
                execution: readExecutionView(cwd, feature),
            };
        }
        const command = gateScript.endsWith('.sh') ? 'bash' : gateScript;
        const args = gateScript.endsWith('.sh') ? [gateScript, feature] : [feature];
        const external = spawnSync(command, args, {
            cwd,
            encoding: 'utf8',
            stdio: ['ignore', 'pipe', 'pipe'],
            env: { ...process.env, GATE_COVERAGE_THRESHOLD: String(gateConfig.coverage) },
        });
        if (external.error) {
            throw external.error;
        }
        result = {
            status: external.status ?? 1,
            stdout: external.stdout || '',
            stderr: external.stderr || '',
        };
    }
    const combinedOutput = `${result.stdout || ''}${result.stderr || ''}`;
    const checks = parseGateChecks(result.stdout || combinedOutput);
    const passed = result.status === 0;
    if (result.stderr) {
        process.stderr.write(result.stderr);
    }
    if (dryRun) {
        return {
            gate: gateName,
            passed,
            checks,
            dryRun: true,
            execution: readExecutionView(cwd, feature),
        };
    }
    const stage = resolveGateStage(cwd, gateName);
    appendRuntimeEvent(cwd, feature, EVENT_TYPES.GATE_EVALUATED, {
        gate: gateName,
        passed,
        stage,
        checks,
    });
    const { state } = materializeState(feature, cwd);
    refreshMemory(feature, cwd);
    return {
        gate: gateName,
        passed,
        checks,
        execution: state,
    };
}
