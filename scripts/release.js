#!/usr/bin/env node

/**
 * release.js - 发布脚本
 *
 * 用法:
 *   node scripts/release.js <version> [--dry-run] [--no-publish]
 *
 * 示例:
 *   node scripts/release.js 3.3.0
 *   node scripts/release.js 3.3.0 --dry-run
 *   node scripts/release.js patch
 *   node scripts/release.js minor
 */

import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');

// ── 需要同步版本号的文件 ───────────────────────────────
const VERSION_FILES = [
  {
    path: 'package.json',
    kind: 'json',
    update(content, version) {
      const obj = JSON.parse(content);
      obj.version = version;
      return JSON.stringify(obj, null, 2) + '\n';
    }
  },
  {
    path: 'packages/boss-cli/package.json',
    kind: 'json',
    update(content, version) {
      const obj = JSON.parse(content);
      obj.version = version;
      return JSON.stringify(obj, null, 2) + '\n';
    }
  },
  {
    path: '.claude-plugin/plugin.json',
    kind: 'json',
    update(content, version) {
      const obj = JSON.parse(content);
      obj.version = version;
      return JSON.stringify(obj, null, 2) + '\n';
    }
  },
  {
    path: '.claude-plugin/marketplace.json',
    kind: 'marketplace',
    update(content, version) {
      const obj = JSON.parse(content);
      obj.version = version;
      if (Array.isArray(obj.plugins)) {
        for (const p of obj.plugins) {
          p.version = version;
        }
      }
      return JSON.stringify(obj, null, 2) + '\n';
    }
  },
  {
    path: '.codex-plugin/plugin.json',
    kind: 'json',
    update(content, version) {
      const obj = JSON.parse(content);
      obj.version = version;
      return JSON.stringify(obj, null, 2) + '\n';
    }
  },
  {
    path: '.codex-plugin/marketplace.json',
    kind: 'marketplace',
    update(content, version) {
      const obj = JSON.parse(content);
      obj.version = version;
      if (Array.isArray(obj.plugins)) {
        for (const p of obj.plugins) {
          p.version = version;
        }
      }
      return JSON.stringify(obj, null, 2) + '\n';
    }
  },
  {
    path: 'skill/SKILL.md',
    kind: 'skill',
    update(content, version) {
      return content.replace(/^version:\s*.+$/m, `version: ${version}`);
    }
  }
];

// ── 辅助函数 ──────────────────────────────────────────

function run(cmd, opts) {
  console.log(`  $ ${cmd}`);
  return execSync(cmd, { cwd: ROOT, stdio: 'inherit', ...opts });
}

function readFile(rel) {
  return fs.readFileSync(path.join(ROOT, rel), 'utf8');
}

function writeFile(rel, content) {
  fs.writeFileSync(path.join(ROOT, rel), content, 'utf8');
}

function getCurrentVersion() {
  return JSON.parse(readFile('package.json')).version;
}

function verifyVersionFile(file, version) {
  const content = readFile(file.path);
  if (file.kind === 'json') {
    const obj = JSON.parse(content);
    if (obj.version !== version) {
      throw new Error(`${file.path} version=${obj.version ?? '<missing>'}`);
    }
    return;
  }

  if (file.kind === 'marketplace') {
    const obj = JSON.parse(content);
    if (obj.version !== version) {
      throw new Error(`${file.path} version=${obj.version ?? '<missing>'}`);
    }
    if (Array.isArray(obj.plugins)) {
      for (const plugin of obj.plugins) {
        if (plugin.version !== version) {
          throw new Error(`${file.path} plugin ${plugin.name ?? '<unknown>'} version=${plugin.version ?? '<missing>'}`);
        }
      }
    }
    return;
  }

  if (file.kind === 'skill') {
    const match = content.match(/^version:\s*(.+)$/m);
    if (!match || match[1].trim() !== version) {
      throw new Error(`${file.path} frontmatter version=${match ? match[1].trim() : '<missing>'}`);
    }
    return;
  }

  throw new Error(`未知版本文件类型: ${file.kind}`);
}

function bumpVersion(current, type) {
  const parts = current.split('.').map(Number);
  if (type === 'major') { parts[0]++; parts[1] = 0; parts[2] = 0; }
  else if (type === 'minor') { parts[0]; parts[1]++; parts[2] = 0; }
  else if (type === 'patch') { parts[0]; parts[1]; parts[2]++; }
  else { return null; }
  return parts.join('.');
}

function isValidSemver(v) {
  return /^\d+\.\d+\.\d+(-[\w.]+)?$/.test(v);
}

// ── 主流程 ────────────────────────────────────────────

function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const noPublish = args.includes('--no-publish');
  const versionArg = args.find(a => !a.startsWith('--'));

  if (!versionArg) {
    console.error('用法: node scripts/release.js <version|major|minor|patch> [--dry-run] [--no-publish]');
    process.exit(1);
  }

  const current = getCurrentVersion();
  let next;

  if (['major', 'minor', 'patch'].includes(versionArg)) {
    next = bumpVersion(current, versionArg);
  } else if (isValidSemver(versionArg)) {
    next = versionArg;
  } else {
    console.error(`无效版本号: ${versionArg}`);
    console.error('支持: 具体版本号 (如 3.3.0) 或 major/minor/patch');
    process.exit(1);
  }

  console.log(`\n📦 发布 @blade-ai/boss-skill`);
  console.log(`   ${current} → ${next}${dryRun ? ' (dry-run)' : ''}\n`);

  // 1. 检查工作区干净
  const status = execSync('git status --porcelain', { cwd: ROOT, encoding: 'utf8' }).trim();
  if (status) {
    console.error('❌ 工作区不干净，请先提交或暂存修改:\n' + status);
    process.exit(1);
  }

  // 2. 跑完整验证
  console.log('🧪 运行完整验证...');
  run('npm run build');
  run('npm run typecheck');
  run('npm test');
  run('npm run test:install-matrix');

  // 3. 同步所有版本号
  console.log(`\n✏️  同步版本号 → ${next}`);
  for (const file of VERSION_FILES) {
    const content = readFile(file.path);
    const updated = file.update(content, next);
    if (dryRun) {
      console.log(`  [dry-run] 将更新 ${file.path}`);
    } else {
      writeFile(file.path, updated);
      console.log(`  ✅ ${file.path}`);
    }
  }

  // 4. 验证一致性
  if (!dryRun) {
    console.log('\n🔍 验证版本一致性...');
    for (const file of VERSION_FILES) {
      try {
        verifyVersionFile(file, next);
      } catch (err) {
        console.error(`❌ ${file.path} 版本不一致: ${(err).message}`);
        process.exit(1);
      }
    }
    console.log('  ✅ 所有文件版本一致');
  }

  // 5. 验证 npm 包内容。dist 不进 Git，但必须进入 npm tarball。
  console.log('\n📦 验证 npm 包内容...');
  run('npm pack --dry-run');

  if (dryRun) {
    console.log('\n🏁 dry-run 完成，未做任何修改。');
    return;
  }

  // 6. Git commit + tag
  console.log('\n📝 提交版本更新...');
  run(`git add ${VERSION_FILES.map(f => f.path).join(' ')}`);
  run(`git commit -m "chore: release v${next}"`);
  run(`git tag v${next}`);

  // 7. 发布
  if (noPublish) {
    console.log('\n⏭️  跳过 npm publish (--no-publish)');
  } else {
    console.log('\n🚀 发布到 npm...');
    run('npm publish');
  }

  // 8. Push
  console.log('\n📤 推送到远程...');
  run('git push');
  run('git push --tags');

  console.log(`\n✅ v${next} 发布完成！`);
}

main();
