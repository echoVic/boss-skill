window.__ModuleLoader__.load({
  id: 'dsh-boss-mode',
  factory(require) {
    const React = require('react');
    const h = React.createElement;
    const TAB_ID = 'boss-panel';

    function BossPanel({ sessionId, useSessions, useSessionStatus, t }) {
      const translate = typeof t === 'function' ? t : (key) => key;
      const sessions =
        typeof useSessions === 'function' ? useSessions((value) => value) : undefined;
      const status =
        typeof useSessionStatus === 'function' ? useSessionStatus((value) => value) : undefined;
      const team = sessions?.projectionsBySession?.[sessionId]?.values?.agentTeam;
      const members = team?.members ?? [];
      const tasks = team?.tasks ?? [];
      const active = new Set(Object.keys(status ?? {}));
      const rows = members.length
        ? members.map((member) =>
            h(
              'li',
              { key: member.id, className: `boss-member boss-${member.phase}` },
              h('strong', null, member.name),
              h('span', null, ` ${member.phase}`),
            ),
          )
        : [h('li', { key: 'empty' }, translate('boss.team.empty'))];
      const taskRows = tasks.length
        ? tasks.map((task) =>
            h(
              'li',
              { key: task.id, className: `boss-task boss-task-${task.status}` },
              h('strong', null, task.subject),
              h('span', null, ` · ${task.status}${task.ownerName ? ` · ${task.ownerName}` : ''}`),
            ),
          )
        : [h('li', { key: 'empty' }, translate('boss.tasks.empty'))];
      return h(
        'section',
        { className: 'boss-panel' },
        h(
          'header',
          null,
          h('h2', null, translate('boss.title')),
          h('p', null, translate('boss.chain')),
        ),
        team?.failure
          ? h(
              'div',
              { role: 'alert', className: 'boss-failure' },
              `${translate('boss.team.failure')}: ${team.failure}`,
            )
          : null,
        h('h3', null, translate('boss.members')),
        h('ul', null, rows),
        h('h3', null, translate('boss.tasks')),
        h('ul', null, taskRows),
        h('p', { className: 'boss-active' }, `${translate('boss.active')}: ${active.size}`),
      );
    }

    const styles = `
      .boss-panel { padding: 14px; color: var(--text-primary, #222); font-size: 13px; }
      .boss-panel h2 { margin: 0 0 4px; font-size: 17px; }
      .boss-panel h3 { margin: 16px 0 6px; font-size: 12px; text-transform: uppercase; opacity: .68; }
      .boss-panel ul { display: grid; gap: 6px; padding: 0; margin: 0; list-style: none; }
      .boss-member, .boss-task { padding: 8px 9px; border: 1px solid color-mix(in srgb, currentColor 14%, transparent); border-radius: 8px; }
      .boss-member span, .boss-task span, .boss-active, .boss-panel header p { opacity: .65; }
      .boss-failure { margin-top: 10px; padding: 8px; border-radius: 7px; color: #9b2c2c; background: #fff0f0; }
      .boss-active { margin-top: 14px; }
    `;

    function apply(ctx) {
      ctx.effect(() => {
        const style = document.createElement('style');
        style.textContent = styles;
        document.head.appendChild(style);
        return () => style.remove();
      }, 'boss-ui: styles');
      ctx.effect(
        () =>
          ctx.locale.register('boss', {
            zh: {
              'boss.title': 'Boss 专家小队',
              'boss.chain': 'pm → architect → ui → review → tasks → dev → qa → ship',
              'boss.members': '成员',
              'boss.tasks': '任务',
              'boss.active': '活跃会话',
              'boss.team.empty': '尚未创建团队成员',
              'boss.tasks.empty': '尚未创建任务',
              'boss.team.failure': '团队状态不可用',
              'boss.status.active': '执行中',
              'boss.status.failed': '失败',
            },
            en: {
              'boss.title': 'Boss Expert Squad',
              'boss.chain': 'pm → architect → ui → review → tasks → dev → qa → ship',
              'boss.members': 'Members',
              'boss.tasks': 'Tasks',
              'boss.active': 'Active sessions',
              'boss.team.empty': 'No teammates yet',
              'boss.tasks.empty': 'No tasks yet',
              'boss.team.failure': 'Team state unavailable',
              'boss.status.active': 'active',
              'boss.status.failed': 'failed',
            },
          }),
        'boss-ui: locale',
      );
      const t = ctx.locale.bind('boss');
      ctx.effect(
        () =>
          ctx.sidebarRightTabs.register({
            id: TAB_ID,
            kind: 'boss',
            priority: 'extension',
            title: () => t('boss.title'),
            guide: [
              {
                id: TAB_ID,
                order: 60,
                title: () => t('boss.title'),
                description: () => t('boss.chain'),
              },
            ],
          }),
        'boss-ui: sidebar type',
      );
      ctx.effect(
        () =>
          ctx.slots.inject('sidebar.right.pane.tab', () =>
            ctx.slots.register(
              {
                name: 'sidebar.right.pane.tab',
                key: TAB_ID,
                locale: 'boss',
              },
              BossPanel,
            ),
          ),
        'boss-ui: sidebar body',
      );
    }

    return { inject: ['locale', 'sidebarRightTabs'], apply };
  },
});
