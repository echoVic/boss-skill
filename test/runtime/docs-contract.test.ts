import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const REPO_ROOT = path.resolve(import.meta.dirname, '..', '..');
const pkg = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, 'package.json'), 'utf8')) as {
  files?: string[];
};
const readme = fs.readFileSync(path.join(REPO_ROOT, 'README.md'), 'utf8');
const contributing = fs.readFileSync(path.join(REPO_ROOT, 'CONTRIBUTING.md'), 'utf8');
const skill = fs.readFileSync(path.join(REPO_ROOT, 'skill', 'SKILL.md'), 'utf8');
const bossCommand = fs.readFileSync(path.join(REPO_ROOT, 'skill', 'commands', 'boss.md'), 'utf8');
const tasksTemplate = fs.readFileSync(path.join(REPO_ROOT, 'skill', 'templates', 'tasks.md.template'), 'utf8');
const scrumMaster = fs.readFileSync(path.join(REPO_ROOT, 'skill', 'agents', 'boss-scrum-master.md'), 'utf8');
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
const hooksConfig = fs.readFileSync(path.join(REPO_ROOT, 'skill', 'hooks', 'hooks.json'), 'utf8');
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
    expect(skill).toContain('同一 Wave');
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
    expect(skill).toContain('`project init` 已隐式执行');
    expect(skill).not.toContain('boss runtime query-memory <feature> --agent <agent-name> --json');
    expect(skill).not.toContain('update-stage <feature> <N> completed --artifact');
  });

  it('routes hook config through the boss hooks dispatcher', () => {
    expect(hooksConfig).toContain('boss hooks run');
    expect(hooksConfig).not.toContain('scripts/lib/run-with-flags.js');
    expect(claudeSettings).toContain('boss hooks run');
    expect(claudeSettings).not.toContain('scripts/lib/run-with-flags.js');
    expect(bmadMethodology).toContain('boss hooks run');
    expect(bmadMethodology).not.toContain('scripts/hooks/run-with-flags.js');
  });
});

describe('ui-design artifact contract', () => {
  it('documents ui-design.json across UI, frontend, and review agents', () => {
    expect(uiDesigner).toContain('ui-design.json');
    expect(uiDesigner).toContain('boss design preview <feature>');
    expect(frontend).toContain('ui-design.json');
    expect(frontend).toContain('ui-design.json > ui-spec.md');
    expect(techLead).toContain('ui-design.json');
    expect(techLead).toContain('ui-spec.md');
  });

  it('documents ui-design.json in artifact guides and templates', () => {
    expect(skill).toContain('ui-design.json');
    expect(artifactGuide).toContain('ui-design.json');
    expect(bmadMethodology).toContain('ui-design.json');
    expect(uiDesignTemplate).toContain('"artifact": "ui-design"');
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
