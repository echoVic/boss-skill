import { findActiveFeature } from '../lib/boss-utils.js';
import { emitProgress } from '../lib/progress-emitter.js';

function isGateCommand(command) {
  return /runtime\/cli\/evaluate-gates\.js|gate-runner\.sh|gate0-|gate1-|gate2-/.test(command);
}

function isHarnessCommand(command) {
  return /runtime\/cli\/(update-stage|check-stage|replay-events|generate-summary|register-plugins|inspect-|run-plugin-hook)\.js|update-stage\.sh|check-stage\.sh|retry-stage\.sh|generate-summary\.sh|load-plugins\.sh/.test(command);
}

function isTestCommand(command) {
  return /npm test|npx vitest|npx jest|pytest|cargo test|go test|npx playwright|npx cypress/.test(command);
}

function run(rawInput) {
  const input = JSON.parse(rawInput);
  const command = (input.tool_input || {}).command || '';
  const cwd = input.cwd || '';

  if (!command) return '';

  let context = '';

  if (isGateCommand(command)) {
    context = '[Harness] 门禁命令已执行，结果已追加事件并物化到 read model（execution.json）';
    const active = findActiveFeature(cwd);
    if (active) {
      const gateMatch = command.match(/gate(\d)/);
      emitProgress(cwd, active.feature, {
        type: 'gate-result',
        data: { gate: gateMatch ? 'gate' + gateMatch[1] : 'unknown', command }
      });
    }
  }

  if (isHarnessCommand(command)) {
    context = '[Harness] 流水线状态已更新';
  }

  if (isTestCommand(command)) {
    const active = findActiveFeature(cwd);
    if (active) {
      context = `[Harness] 测试命令在活跃流水线 '${active.feature}' 上下文中执行`;
    }
  }

  if (!context) return '';

  return JSON.stringify({
    hookSpecificOutput: {
      hookEventName: 'PostToolUse',
      additionalContext: context
    }
  });
}

export { run };
