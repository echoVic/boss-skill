import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const REPO_ROOT = path.resolve(import.meta.dirname, '..', '..');
const pkg = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, 'package.json'), 'utf8')) as {
  files?: string[];
};
const claudePlugin = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, '.claude-plugin', 'plugin.json'), 'utf8')) as {
  skills?: string[];
};
const readme = fs.readFileSync(path.join(REPO_ROOT, 'README.md'), 'utf8');
const contributing = fs.readFileSync(path.join(REPO_ROOT, 'CONTRIBUTING.md'), 'utf8');
const design = fs.readFileSync(path.join(REPO_ROOT, 'DESIGN.md'), 'utf8');
const skill = fs.readFileSync(path.join(REPO_ROOT, 'skill', 'SKILL.md'), 'utf8');
const bossCommand = fs.readFileSync(path.join(REPO_ROOT, 'skill', 'commands', 'boss.md'), 'utf8');
const tasksTemplate = fs.readFileSync(path.join(REPO_ROOT, 'skill', 'templates', 'tasks.md.template'), 'utf8');
const scrumMaster = fs.readFileSync(path.join(REPO_ROOT, 'skill', 'agents', 'boss-scrum-master.md'), 'utf8');
const qaTemplate = fs.readFileSync(path.join(REPO_ROOT, 'skill', 'templates', 'qa-report.md.template'), 'utf8');
const qaAgent = fs.readFileSync(path.join(REPO_ROOT, 'skill', 'agents', 'boss-qa.md'), 'utf8');
const qaTestStrategy = fs.readFileSync(
  path.join(REPO_ROOT, 'skill', 'skills', 'qa', 'test-strategy', 'SKILL.md'),
  'utf8'
);
const testingStandards = fs.readFileSync(
  path.join(REPO_ROOT, 'skill', 'references', 'testing-standards.md'),
  'utf8'
);
const subagentProtocol = fs.readFileSync(
  path.join(REPO_ROOT, 'skill', 'agents', 'prompts', 'subagent-protocol.md'),
  'utf8'
);
const sharedAgentProtocol = fs.readFileSync(
  path.join(REPO_ROOT, 'skill', 'agents', 'shared', 'agent-protocol.md'),
  'utf8'
);
const protocolManifest = fs.readFileSync(
  path.join(REPO_ROOT, 'skill', 'agents', 'shared', 'protocol-manifest.md'),
  'utf8'
);
const claudeHooksConfig = fs.readFileSync(path.join(REPO_ROOT, 'skill', 'hooks', 'claude', 'hooks.json'), 'utf8');
const codexHooksConfig = fs.readFileSync(path.join(REPO_ROOT, 'skill', 'hooks', 'codex', 'hooks.json'), 'utf8');
const claudeSettings = fs.readFileSync(path.join(REPO_ROOT, '.claude', 'settings.json'), 'utf8');
const bmadMethodology = fs.readFileSync(
  path.join(REPO_ROOT, 'skill', 'references', 'bmad-methodology.md'),
  'utf8'
);
const uiDesigner = fs.readFileSync(path.join(REPO_ROOT, 'skill', 'agents', 'boss-ui-designer.md'), 'utf8');
const frontend = fs.readFileSync(path.join(REPO_ROOT, 'skill', 'agents', 'boss-frontend.md'), 'utf8');
const techLead = fs.readFileSync(path.join(REPO_ROOT, 'skill', 'agents', 'boss-tech-lead.md'), 'utf8');
const artifactGuide = fs.readFileSync(path.join(REPO_ROOT, 'skill', 'references', 'artifact-guide.md'), 'utf8');
const uiDesignTemplate = fs.readFileSync(
  path.join(REPO_ROOT, 'skill', 'templates', 'ui-design.json.template'),
  'utf8'
);
const techReviewTemplate = fs.readFileSync(
  path.join(REPO_ROOT, 'skill', 'templates', 'tech-review.md.template'),
  'utf8'
);
const evidenceGatesDesign = fs.readFileSync(
  path.join(REPO_ROOT, 'docs', 'superpowers', 'specs', '2026-05-12-boss-evidence-gates-design.md'),
  'utf8'
);
const evidenceGatesPlan = fs.readFileSync(
  path.join(REPO_ROOT, 'docs', 'superpowers', 'plans', '2026-05-12-boss-evidence-gates.md'),
  'utf8'
);
const multiDriverRuntimePlan = fs.readFileSync(
  path.join(REPO_ROOT, 'docs', 'superpowers', 'plans', '2026-05-12-boss-multi-driver-runtime.md'),
  'utf8'
);

const techDetection = fs.readFileSync(
  path.join(REPO_ROOT, 'skill', 'agents', 'shared', 'tech-detection.md'),
  'utf8'
);

describe('tech-detection.md contract', () => {
  it('documents build tool detection step', () => {
    expect(techDetection).toContain('构建工具');
    expect(techDetection).toContain('vite.config');
    expect(techDetection).toContain('webpack.config');
    expect(techDetection).toContain('esbuild');
    expect(techDetection).toContain('Rollup');
  });

  it('documents deploy environment detection step', () => {
    expect(techDetection).toContain('部署环境');
    expect(techDetection).toContain('Dockerfile');
    expect(techDetection).toContain('vercel.json');
    expect(techDetection).toContain('netlify.toml');
    expect(techDetection).toContain('fly.toml');
  });

  it('documents monorepo detection step', () => {
    expect(techDetection).toContain('Monorepo');
    expect(techDetection).toContain('pnpm-workspace.yaml');
    expect(techDetection).toContain('turbo.json');
    expect(techDetection).toContain('nx.json');
    expect(techDetection).toContain('lerna.json');
  });

  it('output format includes build tool, deploy, and monorepo dimensions', () => {
    // These should appear in the output format table
    expect(techDetection).toMatch(/构建工具.*[|｜]/m);
    expect(techDetection).toMatch(/部署环境.*[|｜]/m);
    expect(techDetection).toMatch(/Monorepo.*[|｜]/m);
  });

  it('documents source scanner isolation for .boss artifacts', () => {
    expect(techDetection).toContain('源码扫描隔离');
    expect(techDetection).toContain('.boss/');
    expect(techDetection).toContain('Tailwind v4');
    expect(techDetection).toContain('@source not');
    expect(techDetection).toContain('不是业务源码');
  });
});

describe('package metadata', () => {
  it('publishes the boss CLI workspace dist and keeps script assets during migration', () => {
    expect(pkg.files).toContain('packages/boss-cli/dist/');
    expect(pkg.files).toContain('packages/boss-cli/assets/');
    expect(pkg.files).toContain('skill/');
    expect(pkg.files).toContain('scripts/');
    expect(pkg.files).not.toContain('agents/');
    expect(pkg.files).not.toContain('commands/');
    expect(pkg.files).not.toContain('harness/');
    expect(pkg.files).not.toContain('templates/');
    expect(pkg.files).not.toContain('SKILL.md');
  });

  it('registers main and methodology skill roots for Claude Code plugin mode', () => {
    expect(claudePlugin.skills).toContain('./skill/');
    expect(claudePlugin.skills).toContain('./skill/skills/');
  });

  it('documents the src to dist layout', () => {
    expect(readme).toContain('src/');
    expect(readme).toContain('dist/');
    expect(readme).toContain('Vitest');
  });

  it('documents contributor expectations for authored source and generated output', () => {
    expect(contributing).toContain('src/');
    expect(contributing).toContain('dist/');
    expect(contributing).toContain('Vitest');
  });

  it('documents Boss CLI assets instead of a root harness directory', () => {
    const rootHarnessPathPattern = /(?:^|[\s`([{])(?:\.\/)?harness\/(?:plugins|pipeline-packs|artifact-dag|plugin-schema)?/;

    expect(readme).toContain('packages/boss-cli/assets/');
    expect(readme).not.toMatch(rootHarnessPathPattern);
    expect(contributing).toContain('packages/boss-cli/assets/');
    expect(contributing).not.toMatch(rootHarnessPathPattern);
    expect(skill).not.toMatch(rootHarnessPathPattern);
  });

  it('documents .boss project extensions and built-in CLI assets', () => {
    expect(readme).toContain('packages/boss-cli/assets/');
    expect(readme).toContain('.boss/plugins/');
    expect(skill).toContain('.boss/plugins/');
    expect(skill).not.toContain('harness/plugins/');
    expect(contributing).toContain('packages/boss-cli/assets/');
  });
});

describe('agent methodology skill contract', () => {
  const agentsDir = path.join(REPO_ROOT, 'skill', 'agents');
  const agentFiles = fs
    .readdirSync(agentsDir)
    .filter((file) => file.startsWith('boss-') && file.endsWith('.md'));

  function getAvailableSkills(content: string): Set<string> {
    const frontmatter = content.match(/^---\n([\s\S]*?)\n---/);
    const skills = new Set<string>();
    let inAvailableSkills = false;

    for (const line of frontmatter?.[1].split('\n') ?? []) {
      if (line === 'available_skills:') {
        inAvailableSkills = true;
        continue;
      }

      if (inAvailableSkills && /^[a-zA-Z_-]+:/.test(line)) {
        break;
      }

      const skill = line.match(/^\s*-\s+([a-z0-9-]+\/[a-z0-9-]+)/)?.[1];
      if (inAvailableSkills && skill) {
        skills.add(skill);
      }
    }

    return skills;
  }

  function getReferencedSkills(content: string): Set<string> {
    return new Set(
      Array.from(content.matchAll(/Skill\(\s*skill:\s*["']([^"']+)["']/g))
        .map((match) => match[1])
        .filter((skillName) => skillName.includes('/'))
    );
  }

  it('uses the canonical Skill call form in agent prompts', () => {
    const legacyCalls: string[] = [];

    for (const file of agentFiles) {
      const content = fs.readFileSync(path.join(agentsDir, file), 'utf8');
      if (content.includes('Skill({')) {
        legacyCalls.push(file);
      }
    }

    expect(legacyCalls).toEqual([]);
  });

  it('keeps agent skill references discoverable and declared', () => {
    const agentsDir = path.join(REPO_ROOT, 'skill', 'agents');
    const unresolved: string[] = [];
    const undeclared: string[] = [];
    const declaredMissing: string[] = [];

    for (const file of agentFiles) {
      const content = fs.readFileSync(path.join(agentsDir, file), 'utf8');
      const availableSkills = getAvailableSkills(content);
      const referencedSkills = getReferencedSkills(content);

      for (const skillName of new Set([...availableSkills, ...referencedSkills])) {
        const skillPath = path.join(REPO_ROOT, 'skill', 'skills', skillName, 'SKILL.md');
        if (!fs.existsSync(skillPath)) {
          unresolved.push(`${file}: ${skillName}`);
        }
      }

      for (const skillName of referencedSkills) {
        if (!availableSkills.has(skillName)) {
          undeclared.push(`${file}: ${skillName}`);
        }
      }

      for (const skillName of availableSkills) {
        if (!referencedSkills.has(skillName)) {
          declaredMissing.push(`${file}: ${skillName}`);
        }
      }
    }

    expect(unresolved).toEqual([]);
    expect(undeclared).toEqual([]);
    expect(declaredMissing).toEqual([]);
  });

  it('documents the bundled skill layout and forbids flat methodology files', () => {
    const skillsReadme = fs.readFileSync(path.join(REPO_ROOT, 'skill', 'skills', 'README.md'), 'utf8');

    expect(skillsReadme).toContain('skill/skills/<domain>/<name>/SKILL.md');
    expect(skillsReadme).toContain('不要新增平铺');
    expect(skillsReadme).toContain('available_skills');
  });
});

describe('boss natural language command contract', () => {
  it('documents feature slug derivation and constraint-only handling', () => {
    expect(skill).toContain('Feature Slug 归一化');
    expect(skill).toContain('约束类输入');
    expect(skill).toContain('不要创建 `.boss/<feature>/`');
    expect(bossCommand).toContain('自然语言需求会先归一化为 feature slug');
    expect(bossCommand).toContain('约束类输入不会启动新流水线');
    expect(bossCommand).toContain('当前 Boss Skill 的 `SKILL.md`');
    expect(bossCommand).not.toContain('skills/boss/SKILL.md');
  });
});

describe('multi-driver runtime documentation contract', () => {
  it('documents multi-driver runtime without weakening Claude Code hooks', () => {
    expect(multiDriverRuntimePlan).toContain('Claude Code');
    expect(multiDriverRuntimePlan).toContain('Codex');
    expect(multiDriverRuntimePlan).toContain('platform-neutral');
    expect(multiDriverRuntimePlan).toContain('hooks');
    expect(multiDriverRuntimePlan).toContain('CHECKPOINT_REQUIRED');
    expect(multiDriverRuntimePlan).toContain('execution.json');
    expect(skill).not.toContain('Codex-only');
  });

  it('documents Platform Driver mode in the Boss skill itself', () => {
    expect(skill).toContain('Platform Driver 模式');
    expect(skill).toContain('Runtime Core');
    expect(skill).toContain('boss status <feature>');
    expect(skill).toContain('boss continue <feature>');
    expect(skill).toContain('boss gate <feature>');
    expect(skill).toContain('boss gate final <feature>');
    expect(skill).toContain('boss qa attack <feature>');
    expect(skill).toContain('CHECKPOINT_REQUIRED');
    expect(skill).toContain('不得替代 hooks');
    expect(skill).toContain('Codex 适配是 additive');
    expect(skill).toContain('不得删除或弱化 Claude Code hooks');
  });
});

describe('subagent orchestration safety contract', () => {
  it('documents adaptable wave boundary verification before trusting subagent DONE states', () => {
    for (const doc of [skill, subagentProtocol]) {
      expect(doc).toContain('Wave 边界校验');
      expect(doc).toContain('按项目技术栈选择');
      expect(doc).toContain('类型检查');
      expect(doc).toContain('测试套件');
      expect(doc).toContain('依赖清单');
      expect(doc).toContain('orchestrator');
      expect(doc).toContain('意外 diff');
      expect(doc).not.toContain('**必跑命令**');
    }
  });

  it('documents task write-set conflict detection before parallel code dispatch', () => {
    expect(tasksTemplate).toContain('文件输出列表');
    expect(tasksTemplate).toContain('写集风险');
    expect(tasksTemplate).toContain('并行安全组');
    expect(tasksTemplate).toContain('同组任务不得写同一个文件');

    expect(scrumMaster).toContain('写集');
    expect(scrumMaster).toContain('共享文件');
    expect(scrumMaster).toContain('并行安全组');
    expect(scrumMaster).toContain('不得并行');

    expect(skill).toContain('任务写集冲突检测');
    expect(skill).toContain('从 `tasks.md` 解析');
    expect(skill).toContain('写集重叠');
    expect(skill).toContain('同一并行安全组');
    expect(skill).toContain('不得并行');
    expect(skill).toContain('共享文件');
    expect(skill).toContain('指定 owner');
  });

  it('documents risk-aware mandatory confirmation before high blast-radius code changes', () => {
    expect(tasksTemplate).toContain('Blast Radius');
    expect(tasksTemplate).toContain('风险确认触发项');
    expect(tasksTemplate).toContain('依赖安装命令');

    expect(scrumMaster).toContain('Blast Radius');
    expect(scrumMaster).toContain('风险确认触发项');
    expect(scrumMaster).toContain('package.json');
    expect(scrumMaster).toContain('install');

    expect(skill).toContain('风险等级感知确认');
    expect(skill).toContain('强制确认 trigger');
    expect(skill).toContain('Blast Radius');
    expect(skill).toContain('≥');
    expect(skill).toContain('package.json');
    expect(skill).toContain('依赖安装命令');
    expect(skill).toContain('核心模块');
    expect(skill).toContain('不得派发 code Agent');
    expect(skill).not.toContain('阶段 3 门禁后 → 可选确认');
  });

  it('documents protocol manifest, prefix cache, and on-demand protocol loading', () => {
    expect(protocolManifest).toContain('协议 manifest');
    expect(protocolManifest).toContain('prefix 缓存');
    expect(protocolManifest).toContain('按需加载');
    expect(protocolManifest).toContain('渐进式披露');
    expect(protocolManifest).toContain('agent-protocol.md');
    expect(protocolManifest).toContain('tech-detection.md');

    expect(sharedAgentProtocol).toContain('协议 manifest');
    expect(sharedAgentProtocol).toContain('prefix 缓存');
    expect(sharedAgentProtocol).toContain('按需加载');

    expect(skill).toContain('协议 manifest');
    expect(skill).toContain('prefix 缓存');
    expect(skill).toContain('按需加载');
    expect(skill).toContain('渐进式披露');
    expect(skill).toContain('agents/shared/protocol-manifest.md');
    expect(skill).not.toContain('每个 Agent 调用前 Load 对应的 Agent Prompt 文件 + `agents/shared/agent-protocol.md` + `agents/shared/tech-detection.md`');
  });

  it('documents execution conversation primitives in the shared agent protocol', () => {
    for (const primitive of ['ask', 'challenge', 'propose', 'request_change', 'escalate', 'huddle', 'resolve']) {
      expect(sharedAgentProtocol).toContain(primitive);
    }
    expect(sharedAgentProtocol).toContain('single-owner todo');
    expect(sharedAgentProtocol).toContain('artifact');
    expect(sharedAgentProtocol).toContain('task');
    expect(sharedAgentProtocol).toContain('scope');
    expect(sharedAgentProtocol).toContain('decision');
  });

  it('documents conversation anchoring and materialization in the subagent protocol', () => {
    expect(subagentProtocol).toContain('conversation_id');
    expect(subagentProtocol).toContain('resolution_summary');
    expect(subagentProtocol).toContain('todo_ids');
    expect(subagentProtocol).toContain('revision_target');
    expect(subagentProtocol).toContain('anchor');
    expect(subagentProtocol).toContain('materialize');
    expect(subagentProtocol).toContain('todo');
    expect(subagentProtocol).toContain('RevisionRequested');
  });

  it('documents conversation escalation behavior in the QA prompt', () => {
    expect(qaAgent).toContain('request_change');
    expect(qaAgent).toContain('huddle');
    expect(qaAgent).toContain('single-owner todo');
  });
});

describe('boss evidence gates contract', () => {
  it('documents repo preflight before code-stage planning and dispatch', () => {
    for (const doc of [skill, tasksTemplate]) {
      expect(doc).toContain('Repo Preflight');
      expect(doc).toContain('默认分支');
      expect(doc).toContain('CI');
      expect(doc).toContain('测试脚本');
      expect(doc).toContain('schema enum');
      expect(doc).toContain('业务常量');
      expect(doc).toContain('migration');
      expect(doc).toContain('unknown');
    }

    expect(skill).toContain('不得派发 code Agent');
    expect(skill).toContain('不得猜测');
  });

  it('requires evidence-driven waves with red tests and green gates', () => {
    for (const doc of [scrumMaster, tasksTemplate]) {
      expect(doc).toContain('Evidence Wave');
      expect(doc).toContain('红测');
      expect(doc).toContain('绿门禁');
      expect(doc).toContain('Stop Condition');
      expect(doc).toContain('下一 Wave');
    }
  });

  it('keeps code dispatch, risk confirmation, and evidence wave terminology distinct', () => {
    expect(skill).toContain('继续 D.4c');
    expect(skill).not.toMatch(/风险确认：未触发[\s\S]*继续 D\.5/);
    expect(skill).toContain('同一并行安全组');
    expect(skill).toContain('Evidence Wave');
    expect(skill).toContain('并行安全组');
  });

  it('requires cross-layer contract matrices for UI payload schema and business-rule consistency', () => {
    for (const doc of [scrumMaster, tasksTemplate]) {
      expect(doc).toContain('Contract Matrix');
      expect(doc).toContain('UI / Copy');
      expect(doc).toContain('Client Payload');
      expect(doc).toContain('Server Schema');
      expect(doc).toContain('Business Rule');
      expect(doc).toContain('Test Evidence');
      expect(doc).toContain('用户可见文案');
      expect(doc).toContain('业务规则');
    }
  });

  it('keeps evidence-gate examples business-agnostic', () => {
    const businessSpecificExamples = [
      '可爱',
      '软萌可爱',
      '积分',
      '计费',
      '扣费',
      '价格',
      'quota',
      '配额',
      '额度',
      'publish/remix',
      'generated asset',
      '生成资产',
      '最终资产',
      'ledger',
      'non-owner',
      'owner/non-owner',
    ];

    for (const doc of [
      scrumMaster,
      tasksTemplate,
      qaAgent,
      qaTemplate,
      testingStandards,
      evidenceGatesDesign,
      evidenceGatesPlan,
    ]) {
      for (const example of businessSpecificExamples) {
        expect(doc).not.toContain(example);
      }
    }
  });

  it('requires QA to replay real core paths and mark mocked critical paths unverified', () => {
    const qaMethodology = `${qaAgent}\n${qaTestStrategy}`;

    for (const doc of [qaMethodology, qaTemplate]) {
      expect(doc).toContain('核心用户路径');
      expect(doc).toContain('真实 payload');
      expect(doc).toContain('服务端响应');
      expect(doc).toContain('schema');
      expect(doc).toContain('越权');
      expect(doc).toContain('第二页');
      expect(doc).toContain('旧数据');
      expect(doc).toContain('未验证');
    }
  });

  it('forbids mocked critical-path tests as the sole proof for core flows', () => {
    expect(testingStandards).toContain('关键路径');
    expect(testingStandards).toContain('Mock');
    expect(testingStandards).toContain('唯一证据');
    expect(testingStandards).toContain('真实 server schema');
    expect(testingStandards).toContain('red-to-green');
  });
});

describe('thin skill CLI contract', () => {
  it('documents boss CLI commands instead of direct runtime/script entrypoints', () => {
    expect(skill).toContain('boss project init');
    expect(skill).toContain('boss runtime init-pipeline');
    expect(skill).toContain('boss artifact prepare');
    expect(skill).toContain('boss packs detect');
    expect(skill).not.toContain('runtime/cli/');
    expect(skill).not.toContain('scripts/prepare-artifact.sh');
    expect(bossCommand).toContain('boss project init');
  });

  it('documents runtime command boundaries that match the CLI surface', () => {
    expect(skill).toContain('boss runtime register-plugins <feature>');
    expect(skill).toContain('boss runtime query-memory <feature> --agent <agent-name>');
    expect(skill).toContain('boss runtime record-artifact <feature> <artifact-name> <N>');
    expect(skill).toContain('boss runtime resume <feature> --from-run <run-id>');
    expect(readme).toContain('boss runtime resume');
    expect(readme).toContain('workflow-plan.json');
    expect(readme).toContain('workflowHash');
    expect(skill).toContain('`project init` 已隐式执行');
    expect(skill).not.toContain('boss runtime query-memory <feature> --agent <agent-name> --json');
    expect(skill).not.toContain('update-stage <feature> <N> completed --artifact');
  });

  it('routes hook config through the boss hooks dispatcher', () => {
    expect(claudeHooksConfig).toContain('boss hooks run');
    expect(codexHooksConfig).toContain('boss hooks run');
    expect(codexHooksConfig).toContain('"matcher": "apply_patch"');
    expect(codexHooksConfig).not.toContain('SessionEnd');
    expect(codexHooksConfig).not.toContain('Notification');
    expect(claudeSettings).toContain('boss hooks run');
    expect(claudeSettings).not.toContain('scripts/lib/run-with-flags.js');
    expect(bmadMethodology).toContain('boss hooks run');
    expect(bmadMethodology).toContain('hooks/claude/hooks.json');
    expect(bmadMethodology).toContain('hooks/codex/hooks.json');
    expect(bmadMethodology).not.toContain('scripts/hooks/run-with-flags.js');
  });

  it('keeps repository Claude settings aligned with the Claude hook manifest for safety hooks', () => {
    const repositorySettings = JSON.parse(claudeSettings) as {
      hooks: Record<string, Array<{ id?: string; matcher?: string }>>;
    };
    const claudeManifest = JSON.parse(claudeHooksConfig) as {
      hooks: Record<string, Array<{ id?: string; matcher?: string }>>;
    };

    for (const hookId of ['pre:write:artifact-guard', 'pre:bash:dangerous-cmd-guard']) {
      const manifestHook = claudeManifest.hooks.PreToolUse?.find((hook) => hook.id === hookId);
      const settingsHook = repositorySettings.hooks.PreToolUse?.find((hook) => hook.id === hookId);

      expect(settingsHook).toEqual(manifestHook);
    }
  });
});

describe('ui-design artifact contract', () => {
  it('documents ui-design.json across UI, frontend, and review agents', () => {
    expect(uiDesigner).toContain('ui-design.json');
    expect(uiDesigner).toContain('.boss/<feature>/ui-spec.md');
    expect(uiDesigner).toContain('.boss/<feature>/ui-design.json');
    expect(uiDesigner).toContain('Markdown 解释设计，JSON 约束实现；两者冲突时必须先修正冲突再交付');
    expect(uiDesigner).toContain('boss design preview <feature>');
    expect(frontend).toContain('ui-design.json');
    expect(frontend).toContain('ui-design.json > ui-spec.md');
    for (const term of ['tokens', 'pages', 'frames', 'prototype.links', 'components', '最终报告中说明原因']) {
      expect(frontend).toContain(term);
    }
    expect(techLead).toContain('ui-design.json');
    expect(techLead).toContain('ui-spec.md');
  });

  it('documents ui-design.json in artifact guides and templates', () => {
    expect(skill).toContain('ui-design.json');
    expect(artifactGuide).toContain('ui-design.json');
    expect(artifactGuide).toContain('boss design preview <feature>');
    expect(artifactGuide).toContain('JSON');
    expect(artifactGuide).toContain('不要求 `## 摘要`');
    expect(artifactGuide).toContain('boss artifact prepare <feature-name> ui-spec.md');
    expect(artifactGuide).toContain('Write(".boss/<feature>/ui-spec.md", ...)');
    expect(bmadMethodology).toContain('ui-design.json');
    expect(bmadMethodology).toContain('`ui-spec.md` + `ui-design.json`');
    expect(uiDesignTemplate).toContain('"artifact": "ui-design"');
  });

  it('documents tech review UI dependencies in metadata and body', () => {
    expect(techReviewTemplate).toMatch(/dependencies:\s*\[[^\]]*ui-spec[^\]]*\]/);
    expect(techReviewTemplate).toMatch(/dependencies:\s*\[[^\]]*ui-design[^\]]*\]/);
    expect(techReviewTemplate).toContain('UI 规范：`.boss/{{FEATURE}}/ui-spec.md`');
    expect(techReviewTemplate).toContain('UI 设计 JSON：`.boss/{{FEATURE}}/ui-design.json`');
  });

  it('documents ui-design.json in active top-level docs', () => {
    for (const doc of [readme, design]) {
      expect(doc).toContain('ui-design.json');
      expect(doc).toContain('boss design preview <feature>');
    }
  });
});

describe('agent-friendly CLI documentation contract', () => {
  it('documents the agent-friendly CLI contract', () => {
    for (const doc of [readme, contributing]) {
      expect(doc).toContain('where applicable');
      expect(doc).toContain('--json');
      expect(doc).toContain('non-TTY stdout defaults to JSON');
      expect(doc).toContain('--describe');
      expect(doc).toContain('--dry-run');
      expect(doc).toContain('structured action plan');
      expect(doc).toContain('--json-input=<json|->');
      expect(doc).toContain('--fields=<a,b>');
      expect(doc).toContain('--limit=<n>');
      expect(doc).toContain('--yes');
      expect(doc).toContain('non-interactive');
      expect(doc).toContain('Structured errors');
      for (const field of ['code', 'message', 'input', 'retryable', 'suggestion']) {
        expect(doc).toContain(field);
      }
    }
    expect(contributing).toContain('structured JSON');
  });
});
