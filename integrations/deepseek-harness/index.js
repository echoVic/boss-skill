import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const resourcesURL = new URL('./resources.json', import.meta.url);
const resources = JSON.parse(readFileSync(resourcesURL, 'utf8'));

export const roles = [
  {
    id: 'pm',
    label: 'PM',
    file: 'boss-pm',
    methods: ['pm/requirement-penetration', 'pm/prd-writing'],
  },
  {
    id: 'architect',
    label: 'Architect',
    file: 'boss-architect',
    methods: ['architect/architecture-design', 'architect/data-api-design'],
  },
  {
    id: 'ui',
    label: 'UI Designer',
    file: 'boss-ui-designer',
    methods: ['ui-designer/design-system', 'ui-designer/interaction-specification'],
  },
  {
    id: 'review',
    label: 'Tech Lead',
    file: 'boss-tech-lead',
    methods: ['tech-lead/code-review', 'tech-lead/technical-standards'],
  },
  {
    id: 'tasks',
    label: 'Scrum Master',
    file: 'boss-scrum-master',
    methods: ['scrum-master/task-breakdown', 'scrum-master/risk-assessment'],
  },
  {
    id: 'frontend',
    label: 'Frontend',
    file: 'boss-frontend',
    methods: ['frontend/component-development', 'frontend/testing-guide', 'shared/tdd'],
  },
  {
    id: 'backend',
    label: 'Backend',
    file: 'boss-backend',
    methods: ['backend/api-development', 'backend/testing-guide', 'shared/tdd'],
  },
  { id: 'qa', label: 'QA', file: 'boss-qa', methods: ['qa/test-strategy', 'qa/test-execution'] },
  {
    id: 'devops',
    label: 'DevOps',
    file: 'boss-devops',
    methods: ['devops/deployment-process', 'devops/changelog-generation'],
  },
];

export function roleOf(value) {
  if (typeof value !== 'string') return undefined;
  return roles.find((role) => new RegExp(`^boss-${role.id}(?:-[1-9][0-9]*)?$`).test(value));
}

function body(file) {
  const content = resources.files[file];
  if (typeof content !== 'string') throw new Error(`Missing Boss resource: ${file}`);
  return content.replace(/^---\s*\n[\s\S]*?\n---\s*\n/, '').trim();
}

const bridge = `## DeepSeek Harness 适配规则

本节把 Boss 的通用文档适配到 DSH，工具名、授权和角色判断以 DSH 运行时为准。
- 用户原话限定范围；默认续跑只推进已授权工作。只读评审不授权改源码，ship 阶段不自动授权上线、发消息或付费操作。
- Boss 入口 /boss、/boss:pm 等在本模式中是用户消息里的意图文本，并非本包注册的原生 slash command；也可直接说“从 QA 开始”。支持 --skip-ui、--quick、--stop-after <环节> 的意图。
- Task/Agent 表示委派：有 Agent Teams 时使用 spawn_teammate、team_task_* 与团队消息工具。保留运行时 lead 名称，成员使用 boss-pm、boss-architect、boss-ui、boss-review、boss-tasks、boss-frontend、boss-backend、boss-qa、boss-devops；同角色可追加 -2。
- 依赖顺序保持 pm → architect → ui → review → tasks → dev → qa → ship。前后端仅在写入范围互不重叠时并行。团队有成员上限，按阶段复用或释放成员，无需一次启动九人。
- 团队未开启时，先说明可在“插件 → 实验性插件”启用“智能体团队”；仅在实际可用时用 subagent 委派，并把角色规范与任务、上下文、产物路径、写入范围一起交给子代理。普通 subagent 不出现在 Team 看板中。
- 运行时明确你是 teammate 或 subagent 时，只执行分派的角色任务并向调度者回报，不自封 Boss，不自行续跑整条链。原文 Skill(...) 表示按需读取该方法论，不要求存在 Claude 的同名工具。
- Read/Write/Glob/Grep/Bash/WebSearch/WebFetch 对应实际可用的 DSH 文件、检索、shell 与 web 工具；Windows 使用 pwsh。使用工具目录中的真实名称，不虚构工具。
- 本包只提供角色规范和界面，不安装历史 Boss CLI/hooks，不运行事件引擎。质量契约由代理遵循；没有独立的运行时强制门禁。
- 所有 Markdown 产物写入项目 .boss/<feature>/，默认中文、摘要在前。没执行的测试明确写“未验证”；测试证据记录命令、退出码、通过/失败/跳过数和失败详情。
- 额外资源位于 ${JSON.stringify(fileURLToPath(resourcesURL))}，JSON 的 files 字段以 Boss 相对路径索引 agents/、references/、templates/、skills/。用文件工具或 shell 按 key 取所需文本，避免把整个资源文件加入上下文。用户项目不需要安装本仓库。
- 用户停止、达到 --stop-after、无法修复的失败或授权边界时停止相关工作，并给出实际产物与阻塞点。不得通过改断言、删测试或伪造证据凑绿。
`;

const shared = body('agents/prompts/subagent-protocol.md');
const lead = [body('SKILL.md'), body('references/continuation-chain.md'), bridge].join('\n\n');
const rolePrompts = new Map(
  roles.map((role) => [
    role.id,
    [
      body(`agents/${role.file}.md`),
      ...role.methods.map((method) => body(`skills/${method}/SKILL.md`)),
      shared,
      bridge,
    ].join('\n\n'),
  ]),
);

export function sectionText(ctx, agent) {
  if (!agent?.ctx || ctx.get('agentPresets')?.composedPreset(agent.ctx) !== 'boss') return '';
  const membership = ctx.get('agentTeams')?.tryMembership(agent);
  if (!membership || membership.role === 'lead') return lead;
  if (membership.role !== 'teammate') return '';
  const role = roleOf(membership.name);
  return role ? rolePrompts.get(role.id) : '';
}

export const name = 'boss-mode';
export const inject = ['systemPrompt'];

export function apply(ctx) {
  ctx.effect(
    () =>
      ctx.systemPrompt.section({
        name: 'boss:role',
        order: ctx.systemPrompt.getSectionOrder('DEPLOYMENT_PERSONA_PREFIX') + 1,
        text: (context) => sectionText(ctx, context.agent),
        interpolate: false,
      }),
    'boss: scoped role contract',
  );
}
