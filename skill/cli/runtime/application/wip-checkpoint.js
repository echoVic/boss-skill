import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
const DEFAULT_CONFIG = {
    enabled: true,
    strategy: 'stash',
    triggerOnStageComplete: true,
    branchPrefix: 'wip/',
};
const CHECKPOINT_PATHSPEC = ['--', '.', ':(exclude).boss'];
function isGitRepo(cwd) {
    const result = spawnSync('git', ['rev-parse', '--is-inside-work-tree'], {
        cwd,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore'],
    });
    return result.status === 0 && result.stdout.trim() === 'true';
}
function hasChanges(cwd) {
    const result = spawnSync('git', ['status', '--porcelain', '--untracked-files=all', ...CHECKPOINT_PATHSPEC], {
        cwd,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore'],
    });
    return (result.stdout || '').trim().length > 0;
}
function countChangedFiles(cwd) {
    const result = spawnSync('git', ['status', '--porcelain', '--untracked-files=all', ...CHECKPOINT_PATHSPEC], {
        cwd,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore'],
    });
    return (result.stdout || '').trim().split('\n').filter(Boolean).length;
}
function getCurrentBranch(cwd) {
    const result = spawnSync('git', ['branch', '--show-current'], {
        cwd,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore'],
    });
    return (result.stdout || '').trim();
}
export function createWipCheckpoint(feature, options = {}) {
    const cwd = options.cwd || process.cwd();
    const strategy = options.strategy || DEFAULT_CONFIG.strategy;
    const stage = options.stage ?? null;
    const timestamp = new Date().toISOString();
    const noResult = {
        created: false,
        strategy,
        ref: '',
        timestamp,
        changedFiles: 0,
        feature,
        stage,
    };
    if (!isGitRepo(cwd))
        return noResult;
    if (!hasChanges(cwd))
        return noResult;
    const changedFiles = countChangedFiles(cwd);
    const message = `boss-wip: ${feature} stage-${stage ?? '?'} ${timestamp}`;
    let ref = '';
    switch (strategy) {
        case 'stash': {
            const result = spawnSync('git', ['stash', 'push', '-m', message, '--include-untracked', ...CHECKPOINT_PATHSPEC], {
                cwd,
                encoding: 'utf8',
                stdio: ['ignore', 'pipe', 'ignore'],
            });
            if (result.status !== 0)
                return noResult;
            // Get the stash ref
            const listResult = spawnSync('git', ['stash', 'list', '--max-count=1'], {
                cwd,
                encoding: 'utf8',
                stdio: ['ignore', 'pipe', 'ignore'],
            });
            ref = (listResult.stdout || '').split(':')[0] || 'stash@{0}';
            // Re-apply, but keep the stash entry as the actual checkpoint ref.
            const applyResult = spawnSync('git', ['stash', 'apply', '--index', ref], {
                cwd,
                encoding: 'utf8',
                stdio: ['ignore', 'pipe', 'ignore'],
            });
            if (applyResult.status !== 0)
                return noResult;
            break;
        }
        case 'commit': {
            spawnSync('git', ['add', '-A'], { cwd, stdio: 'ignore' });
            const result = spawnSync('git', ['commit', '--no-verify', '-m', `wip(boss): ${message}`], {
                cwd,
                encoding: 'utf8',
                stdio: ['ignore', 'pipe', 'ignore'],
            });
            if (result.status !== 0)
                return noResult;
            const hashResult = spawnSync('git', ['rev-parse', '--short', 'HEAD'], {
                cwd,
                encoding: 'utf8',
                stdio: ['ignore', 'pipe', 'ignore'],
            });
            ref = (hashResult.stdout || '').trim();
            break;
        }
        case 'branch': {
            const currentBranch = getCurrentBranch(cwd);
            const branchName = `${DEFAULT_CONFIG.branchPrefix}${feature}-${Date.now()}`;
            spawnSync('git', ['checkout', '-b', branchName], { cwd, stdio: 'ignore' });
            spawnSync('git', ['add', '-A'], { cwd, stdio: 'ignore' });
            spawnSync('git', ['commit', '--no-verify', '-m', `wip(boss): ${message}`], {
                cwd,
                stdio: 'ignore',
            });
            const hashResult = spawnSync('git', ['rev-parse', '--short', 'HEAD'], {
                cwd,
                encoding: 'utf8',
                stdio: ['ignore', 'pipe', 'ignore'],
            });
            ref = (hashResult.stdout || '').trim();
            // Switch back to original branch
            spawnSync('git', ['checkout', currentBranch], { cwd, stdio: 'ignore' });
            break;
        }
    }
    // Record checkpoint in .boss metadata
    const metaDir = path.join(cwd, '.boss', feature, '.meta');
    if (fs.existsSync(path.dirname(metaDir))) {
        fs.mkdirSync(metaDir, { recursive: true });
        const checkpointsFile = path.join(metaDir, 'wip-checkpoints.json');
        const existing = fs.existsSync(checkpointsFile)
            ? JSON.parse(fs.readFileSync(checkpointsFile, 'utf8'))
            : [];
        existing.push({ ref, message, timestamp, strategy, changedFiles });
        fs.writeFileSync(checkpointsFile, JSON.stringify(existing, null, 2));
    }
    return { created: true, strategy, ref, timestamp, changedFiles, feature, stage };
}
export function listWipCheckpoints(feature, options = {}) {
    const cwd = options.cwd || process.cwd();
    const checkpointsFile = path.join(cwd, '.boss', feature, '.meta', 'wip-checkpoints.json');
    if (!fs.existsSync(checkpointsFile))
        return [];
    try {
        return JSON.parse(fs.readFileSync(checkpointsFile, 'utf8'));
    }
    catch {
        return [];
    }
}
export function restoreWipCheckpoint(feature, options = {}) {
    const cwd = options.cwd || process.cwd();
    if (!isGitRepo(cwd)) {
        return { restored: false, ref: '', conflicts: [] };
    }
    const checkpoints = listWipCheckpoints(feature, { cwd });
    if (checkpoints.length === 0) {
        return { restored: false, ref: '', conflicts: [] };
    }
    const target = options.ref
        ? checkpoints.find((c) => c.ref === options.ref)
        : checkpoints[checkpoints.length - 1];
    if (!target) {
        return { restored: false, ref: '', conflicts: [] };
    }
    if (target.strategy === 'stash') {
        // Find matching stash
        const listResult = spawnSync('git', ['stash', 'list'], {
            cwd,
            encoding: 'utf8',
            stdio: ['ignore', 'pipe', 'ignore'],
        });
        const stashes = (listResult.stdout || '').split('\n');
        const matchIdx = stashes.findIndex((s) => s.includes(target.message));
        if (matchIdx >= 0) {
            const applyResult = spawnSync('git', ['stash', 'apply', `stash@{${matchIdx}}`], {
                cwd,
                encoding: 'utf8',
                stdio: ['ignore', 'pipe', 'pipe'],
            });
            if (applyResult.status !== 0) {
                return {
                    restored: false,
                    ref: target.ref,
                    conflicts: [applyResult.stderr || 'stash apply failed'],
                };
            }
            return { restored: true, ref: target.ref, conflicts: [] };
        }
    }
    else if (target.strategy === 'commit') {
        const result = spawnSync('git', ['cherry-pick', '--no-commit', target.ref], {
            cwd,
            encoding: 'utf8',
            stdio: ['ignore', 'pipe', 'pipe'],
        });
        if (result.status !== 0) {
            spawnSync('git', ['cherry-pick', '--abort'], { cwd, stdio: 'ignore' });
            return {
                restored: false,
                ref: target.ref,
                conflicts: [result.stderr || 'cherry-pick failed'],
            };
        }
        return { restored: true, ref: target.ref, conflicts: [] };
    }
    else if (target.strategy === 'branch') {
        const result = spawnSync('git', ['cherry-pick', '--no-commit', target.ref], {
            cwd,
            encoding: 'utf8',
            stdio: ['ignore', 'pipe', 'pipe'],
        });
        if (result.status !== 0) {
            spawnSync('git', ['cherry-pick', '--abort'], { cwd, stdio: 'ignore' });
            return {
                restored: false,
                ref: target.ref,
                conflicts: [result.stderr || 'cherry-pick failed'],
            };
        }
        return { restored: true, ref: target.ref, conflicts: [] };
    }
    return { restored: false, ref: target.ref, conflicts: ['unknown strategy'] };
}
