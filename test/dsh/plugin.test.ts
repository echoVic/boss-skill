import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import vm from 'node:vm';
import { describe, expect, it } from 'vitest';

const root = path.resolve(import.meta.dirname, '../..');
const plugin = path.join(root, 'integrations/deepseek-harness');

async function host() {
  return import(pathToFileURL(path.join(plugin, 'index.js')).href);
}

function context(preset: string, member?: { role: string; name: string }) {
  return {
    get: (service: string) => {
      if (service === 'agentPresets') return { composedPreset: () => preset };
      if (service === 'agentTeams') return { tryMembership: () => member };
      return undefined;
    },
  };
}

describe('DeepSeek Harness Boss bundle', () => {
  it('loads the PM contract only for a PM in a Boss session', async () => {
    const { sectionText } = await host();
    const agent = { ctx: {} };
    const member = { role: 'teammate', name: 'boss-pm-2' };
    const text = sectionText(context('boss', member), agent);
    expect(text).toContain('Given-When-Then');
    expect(text).toContain('prd.md');
    expect(text).not.toContain('# QA 验证 Agent');
    expect(sectionText(context('standard', member), agent)).toBe('');
    expect(sectionText(context('cabinet', member), agent)).toBe('');
  });

  it('uses runtime membership for authority and rejects ambiguous role names', async () => {
    const { roleOf, sectionText } = await host();
    expect(roleOf('boss-backend-2')?.id).toBe('backend');
    expect(roleOf('boss-pm-evil/../../qa')).toBeUndefined();
    expect(roleOf('boss-pmish')).toBeUndefined();
    expect(sectionText(context('boss', { role: 'teammate', name: 'lead' }), { ctx: {} })).toBe('');
    expect(sectionText(context('boss', { role: 'teammate', name: 'unknown' }), { ctx: {} })).toBe(
      '',
    );
    const lead = sectionText(context('boss', { role: 'lead', name: 'lead' }), { ctx: {} });
    expect(lead).toContain('pm → architect → ui → review → tasks → dev → qa → ship');
    expect(lead).toContain('--stop-after');
    expect(lead).toContain('spawn_teammate');
  });

  it('supports a standalone Boss session without inventing team membership', async () => {
    const { sectionText } = await host();
    const text = sectionText(context('boss'), { ctx: {} });
    expect(text).toContain('智能体团队');
    expect(text).toContain('subagent');
    expect(sectionText(context('boss'), undefined)).toBe('');
  });

  it('registers a non-interpolating prompt section and disposes through Cordis', async () => {
    const { apply } = await host();
    let registered: any;
    let disposed = false;
    const effects: Array<() => void> = [];
    apply({
      effect: (run: () => () => void) => effects.push(run()),
      systemPrompt: {
        getSectionOrder: () => 100,
        section: (value: any) => {
          registered = value;
          return () => {
            disposed = true;
          };
        },
      },
    });
    expect(registered.interpolate).toBe(false);
    expect(registered.order).toBe(101);
    for (const dispose of effects) dispose();
    expect(disposed).toBe(true);
  });

  it('packages a complete snapshot of the existing role resources', () => {
    const resources = JSON.parse(fs.readFileSync(path.join(plugin, 'resources.json'), 'utf8'));
    const manifest = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
    expect(resources.bossVersion).toBe(manifest.version);
    for (const [file, content] of Object.entries(resources.files)) {
      expect(content, file).toBe(fs.readFileSync(path.join(root, 'skill', file), 'utf8'));
    }
    expect(resources.files['agents/boss-qa.md']).toContain('退出码');
    expect(resources.files['templates/prd.md.template']).toBeTruthy();
    expect(resources.files['skills/qa/test-execution/SKILL.md']).toBeTruthy();
    expect(Object.keys(resources.files).some((file) => file.includes('.DS_Store'))).toBe(false);
  });

  it('renders live task ownership and failure states without fabricating progress', () => {
    let module: any;
    const React = {
      createElement: (type: any, props: any, ...children: any[]) => ({ type, props, children }),
    };
    vm.runInNewContext(fs.readFileSync(path.join(plugin, 'client.js'), 'utf8'), {
      document: {
        head: { appendChild: () => {} },
        createElement: () => ({ textContent: '', remove: () => {} }),
      },
      window: {
        __ModuleLoader__: {
          load: ({ factory }: any) => {
            module = factory((name: string) => {
              if (name === 'react') return React;
              throw new Error(name);
            });
          },
        },
      },
    });
    let Panel: any;
    const ctx: any = {
      effect: (run: () => void) => run(),
      locale: { register: () => () => {}, bind: () => (key: string) => key },
      sidebarRightTabs: { register: () => () => {} },
      slots: {
        inject: (_name: string, run: () => void) => run(),
        register: (_config: any, component: any) => {
          Panel = component;
          return () => {};
        },
      },
    };
    module.apply(ctx);
    const empty = JSON.stringify(Panel({ sessionId: 'root' }));
    expect(empty).toContain('team.empty');
    const render = (selector: any) =>
      selector({
        projectionsBySession: {
          root: {
            values: {
              agentTeam: {
                failure: 'journal unavailable',
                members: [{ id: 'pm-session', name: 'boss-pm', phase: 'active' }],
                tasks: [
                  {
                    id: 'task-1',
                    subject: '<script>PRD</script>',
                    status: 'in_progress',
                    ownerName: 'boss-pm',
                  },
                ],
              },
            },
          },
        },
      });
    const populated = JSON.stringify(
      Panel({
        sessionId: 'root',
        useSessions: render,
        useSession: (selector: any) => selector({}),
        useSessionStatus: (selector: any) => selector({}),
      }),
    );
    expect(populated).toContain('team.failure');
    expect(populated).toContain('boss-pm');
    expect(populated).toContain('<script>PRD</script>');
    expect(populated).not.toContain('dangerouslySetInnerHTML');
    expect(populated).toContain('boss-task-in_progress');
  });
});
