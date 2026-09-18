import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const REPO_ROOT = path.resolve(import.meta.dirname, '..', '..');
const SRC_ROOT = path.join(REPO_ROOT, 'packages', 'boss-cli', 'src');

function walkTsFiles(dir: string, result: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules') continue;
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walkTsFiles(fullPath, result);
    } else if (entry.name.endsWith('.ts')) {
      result.push(fullPath);
    }
  }
  return result;
}

/**
 * 隐私/网络边界守卫：boss 默认零出网。knowledge 外挂 LLM 模块移除后，运行时源码里
 * 唯一允许的网络面是 design preview 的本地回环服务器。若有人重新引入出站请求或把
 * 预览服务器绑定到非回环地址，本测试立即变红。
 */
describe('privacy / network boundary guard', () => {
  const sourceFiles = walkTsFiles(SRC_ROOT).map((file) => ({
    rel: path.relative(REPO_ROOT, file),
    text: fs.readFileSync(file, 'utf8'),
  }));

  it('does not import any outbound network client', () => {
    // node:http/https 仅允许出现在本地预览服务器；其余源码不得引入网络客户端
    const forbidden = [
      /from\s+['"]node:https['"]/,
      /require\(\s*['"]node:https['"]\s*\)/,
      /\bhttps\.request\s*\(/,
      /\bhttp\.request\s*\(/,
      /\bfetch\s*\(/,
      /from\s+['"](?:axios|got|node-fetch|undici)['"]/,
      /\bnet\.connect\s*\(/,
      /from\s+['"]node:dgram['"]/,
    ];
    for (const { rel, text } of sourceFiles) {
      for (const pattern of forbidden) {
        expect(text, `${rel} matched ${pattern} — boss 应保持零出网`).not.toMatch(pattern);
      }
    }
  });

  it('only opens node:http in the loopback design-preview server', () => {
    const httpUsers = sourceFiles.filter(({ text }) => /from\s+['"]node:http['"]/.test(text));
    expect(httpUsers.map((f) => f.rel)).toEqual(['packages/boss-cli/src/runtime/design/server.ts']);
  });

  it('binds the preview server to loopback only', () => {
    const server = sourceFiles.find((f) => f.rel.endsWith('runtime/design/server.ts'));
    expect(server).toBeDefined();
    expect(server!.text).toContain("server.listen(port, '127.0.0.1'");
    // 不得绑定通配地址暴露到外网
    expect(server!.text).not.toContain("'0.0.0.0'");
  });

  it('no longer references the removed external knowledge LLM configuration', () => {
    for (const { rel, text } of sourceFiles) {
      expect(text, `${rel} 仍引用已移除的 knowledge 外挂配置`).not.toMatch(/BOSS_KNOWLEDGE_/);
    }
  });

  it('ships a PRIVACY.md declaring the zero-network default', () => {
    const privacy = fs.readFileSync(path.join(REPO_ROOT, 'PRIVACY.md'), 'utf8');
    expect(privacy).toMatch(/zero-network/i);
    expect(privacy).toContain('127.0.0.1');
  });
});
