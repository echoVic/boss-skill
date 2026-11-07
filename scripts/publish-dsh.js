#!/usr/bin/env node

/**
 * publish-dsh.js - 发布 DeepSeek Harness bundle 到 npm
 *
 * `integrations/deepseek-harness` 以独立版本号发布为 npm 包 `dsh-boss-mode`。
 * 发布前依次完成：npm 元数据校验 → 资源快照校验（dsh:check）→ npm pack 内容校验
 * → 版本占用检查 → npm publish。CI 里由 tag `dsh-boss-mode-v<version>` 触发同一流程。
 *
 * 用法:
 *   node scripts/publish-dsh.js [--dry-run] [--provenance] [--otp=<code>]
 *
 * 示例:
 *   node scripts/publish-dsh.js --dry-run
 *   node scripts/publish-dsh.js
 *   node scripts/publish-dsh.js --otp=123456     # npm 账号开启 2FA 时的一次性密码
 *   node scripts/publish-dsh.js --provenance     # CI 中生成 npm provenance
 */

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const BUNDLE_DIR = path.join(ROOT, 'integrations/deepseek-harness');
const MANIFEST_PATH = path.join(BUNDLE_DIR, 'package.json');

const PACKAGE_NAME = 'dsh-boss-mode';
const TAG_PREFIX = 'dsh-boss-mode-v';

const REQUIRED_FILES = [
  'index.js',
  'client.js',
  'resources.json',
  'cordis.patch.yml',
  'icon.svg',
  'README.md',
  'LICENSE',
  'NOTICE.md',
];

function fail(message) {
  console.error(`❌ ${message}`);
  process.exit(1);
}

function readManifest() {
  return JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));
}

function npm(args, { cwd = ROOT, tolerateFailure = false } = {}) {
  try {
    return execFileSync('npm', args, { cwd, encoding: 'utf8', stdio: 'pipe' });
  } catch (error) {
    if (tolerateFailure) return { failed: true, error };
    throw error;
  }
}

function assertPublishable(manifest) {
  if (manifest.name !== PACKAGE_NAME) {
    fail(`bundle 包名必须是 ${PACKAGE_NAME}，实际是 ${manifest.name ?? '<missing>'}`);
  }
  if (manifest.private) fail('bundle package.json 不能是 private');
  if (manifest.publishConfig?.access !== 'public') {
    fail('bundle package.json 必须声明 publishConfig.access = "public"');
  }
  if (!/^\d+\.\d+\.\d+(-[\w.]+)?$/.test(manifest.version ?? '')) {
    fail(`bundle 版本号不是合法 semver: ${manifest.version ?? '<missing>'}`);
  }
  if (manifest.repository?.directory !== 'integrations/deepseek-harness') {
    fail('bundle package.json 的 repository.directory 必须指向 integrations/deepseek-harness');
  }
  for (const file of REQUIRED_FILES) {
    if (!Array.isArray(manifest.files) || !manifest.files.includes(file)) {
      fail(`bundle files 缺少 ${file}`);
    }
    if (!fs.existsSync(path.join(BUNDLE_DIR, file))) {
      fail(`bundle 目录缺少 ${file}`);
    }
  }
}

function inspectPackedBundle() {
  const stdout = npm(['pack', '--dry-run', '--json'], { cwd: BUNDLE_DIR });
  const [packed] = JSON.parse(stdout);
  const shipped = new Set((packed.files ?? []).map((file) => file.path));
  for (const file of REQUIRED_FILES) {
    if (!shipped.has(file)) fail(`npm pack 未包含 ${file}`);
  }
  const resources = packed.files.find((file) => file.path === 'resources.json');
  if (!resources || resources.size < 100_000) {
    fail('npm pack 中的 resources.json 过小，先运行 npm run dsh:build');
  }
  return packed;
}

function assertVersionAvailable(manifest) {
  const result = npm(['view', `${manifest.name}@${manifest.version}`, 'version'], {
    tolerateFailure: true,
  });
  if (!result.failed) {
    fail(
      `${manifest.name}@${manifest.version} 已存在于 npm；先提升 integrations/deepseek-harness 的版本号`,
    );
  }
  const stderr = String(result.error.stderr ?? '');
  if (!stderr.includes('E404')) {
    fail(`无法查询 npm registry: ${stderr.trim() || result.error.message}`);
  }
}

function assertAuthenticated() {
  const result = npm(['whoami'], { tolerateFailure: true });
  if (result.failed) {
    fail('未登录 npm（npm whoami 失败）。本地发布请先 `npm login`；CI 发布请配置 NPM_TOKEN secret');
  }
  console.log(`👤 npm 身份: ${result.trim()}`);
}

function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const provenance = args.includes('--provenance');
  const manifest = readManifest();
  const tag = `${TAG_PREFIX}${manifest.version}`;

  console.log(`\n📦 发布 ${manifest.name}@${manifest.version} 到 npm${dryRun ? ' (dry-run)' : ''}`);
  console.log(`   tag: ${tag}\n`);

  console.log('🔎 校验 npm 元数据与打包内容...');
  assertPublishable(manifest);
  const packed = inspectPackedBundle();
  console.log(
    `  ✅ ${packed.entryCount} 个文件，${(packed.size / 1024).toFixed(1)} kB（unpacked ${(packed.unpackedSize / 1024).toFixed(1)} kB）`,
  );

  assertVersionAvailable(manifest);
  console.log('  ✅ npm 上该版本尚未被占用');

  console.log('\n🧪 运行资源快照校验...');
  execFileSync('node', [path.join(ROOT, 'scripts/build-dsh.js'), '--check'], {
    cwd: ROOT,
    stdio: 'inherit',
  });

  if (!dryRun) assertAuthenticated();

  const otpArg = args.find((arg) => arg.startsWith('--otp='));
  const otp = otpArg?.slice('--otp='.length);

  const publishArgs = ['publish', '--access', 'public'];
  if (provenance) publishArgs.push('--provenance');
  if (otp) publishArgs.push(`--otp=${otp}`);
  if (dryRun) publishArgs.push('--dry-run');

  console.log(`\n🚀 ${dryRun ? '模拟' : ''}发布 ${manifest.name}@${manifest.version}...`);
  console.log(`  $ npm ${publishArgs.join(' ')}`);
  try {
    execFileSync('npm', publishArgs, { cwd: BUNDLE_DIR, stdio: 'inherit' });
  } catch (error) {
    console.error(
      '\n❌ npm 发布失败。若 npm 提示 EOTP（需要一次性密码），用 npm run dsh:publish -- --otp=<6位验证码> 重试；CI 中应配置可绕过 OTP 的自动化 token。',
    );
    process.exit(typeof error.status === 'number' ? error.status : 1);
  }

  if (dryRun) {
    console.log('\n✅ dry-run 通过：打包与元数据就绪，可执行 npm run dsh:publish 正式发布');
  } else {
    console.log(`\n✅ 已发布 https://www.npmjs.com/package/${manifest.name}/v/${manifest.version}`);
    console.log(`   记得创建 GitHub Release ${tag} 并附上 tgz 资产`);
  }
}

main();
