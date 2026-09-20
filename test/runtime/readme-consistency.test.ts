import * as fs from 'node:fs';
import * as path from 'node:path';

import { describe, expect, it } from 'vitest';

const REPO_ROOT = path.resolve(import.meta.dirname, '..', '..');
const READMES = [
  'README.md',
  'README.zh-CN.md',
  'README.ja.md',
  'README.ko.md',
  'README.es.md',
  'README.fr.md',
  'README.pt-BR.md',
];

function read(name: string): string {
  return fs.readFileSync(path.join(REPO_ROOT, name), 'utf8');
}

function sections(markdown: string): string[] {
  return [...markdown.matchAll(/^## (.+)$/gm)].map((match) => match[1]!.trim());
}

/**
 * 七个语言版本必须一起改。
 *
 * 上一轮把「门禁不可绕过」这句过度承诺从 DESIGN.md 与 skill/references 里改掉了，
 * 却漏了七个 README——最被人读到的那一面。同一轮把 Quick Start 提前的重构也只落在
 * 英文版，其余六个仍让读者先读到「适用与不适用」对照表才看到怎么安装。
 *
 * 人工同步七份翻译必然漂移，所以把「不准漂移的那几件事」钉成测试。
 */
describe('all README translations stay in sync', () => {
  it('none of them claims gates cannot be bypassed', () => {
    // 运行时从不阻止阶段推进：门禁的执行依赖编排器遵守协议，CLI 提供的是可核对的判定
    const overclaims =
      /non-bypassable|不可绕过|バイパスできない|우회할 수 없는|no eludibles|non contournables|não contornáveis/i;
    for (const name of READMES) {
      expect(overclaims.test(read(name)), `${name} still claims gates are non-bypassable`).toBe(
        false,
      );
    }
  });

  it('puts the quick start before the when-to-use table', () => {
    // 读者应先知道怎么试，再判断要不要试
    for (const name of READMES) {
      const titles = sections(read(name));
      const quick = titles.findIndex((title) =>
        /quick|快速|クイック|빠른|rápido|Démarrage/i.test(title),
      );
      const when = titles.findIndex((title) =>
        /when to use|什么时候|使うべき|사용해야|Cuándo usar|Quand utiliser|Quando usar/i.test(
          title,
        ),
      );
      expect(quick, `${name} has no quick start section`).toBeGreaterThanOrEqual(0);
      expect(when, `${name} has no when-to-use section`).toBeGreaterThanOrEqual(0);
      expect(quick, `${name} shows the deterrent table before the quick start`).toBeLessThan(when);
    }
  });

  it('leads the quick start with a read-only slice command', () => {
    for (const name of READMES) {
      expect(read(name), `${name} does not mention /boss:review`).toContain('/boss:review');
    }
  });

  it('keeps every code fence balanced', () => {
    for (const name of READMES) {
      const fences = (read(name).match(/^```/gm) ?? []).length;
      expect(fences % 2, `${name} has an unbalanced code fence`).toBe(0);
    }
  });

  it('never advertises the transposed release-gate form', () => {
    // 正确写法是 `boss gate final <feature>`；子命令在后会报「多余的参数」
    for (const name of READMES) {
      expect(read(name), `${name} advertises a broken gate invocation`).not.toMatch(
        /boss gate \S+ final/,
      );
    }
  });
});
