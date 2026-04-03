#!/usr/bin/env node
'use strict';

var path = require('path');
var fs = require('fs');
var childProcess = require('child_process');
var hookFlags = require('./hook-flags');

var MAX_STDIN = 1024 * 1024;
var hookId = process.argv[2];
var scriptRel = process.argv[3];
var profilesCsv = process.argv[4] || '';

function passthrough(buf) {
  if (buf && buf.length) {
    process.stdout.write(buf);
  }
  process.exit(0);
}

function resolvePluginRoot() {
  return process.env.SKILL_DIR
    || process.env.CLAUDE_PROJECT_DIR
    || process.env.CLAUDE_PLUGIN_ROOT
    || path.resolve(__dirname, '..', '..');
}

function readStdin() {
  var chunks = [];
  var total = 0;
  try {
    var fd = fs.openSync('/dev/stdin', 'r');
    var buf = Buffer.alloc(4096);
    var n;
    while (true) {
      n = fs.readSync(fd, buf, 0, buf.length);
      if (n <= 0) break;
      total += n;
      if (total > MAX_STDIN) {
        chunks.push(buf.slice(0, n));
        break;
      }
      chunks.push(buf.slice(0, n));
    }
    fs.closeSync(fd);
  } catch (_e) {}
  return Buffer.concat(chunks);
}

if (!hookId || !scriptRel) {
  process.stderr.write('Usage: run-with-flags.js <hookId> <scriptRelativePath> [profilesCsv]\n');
  process.exit(1);
}

var stdinBuf = readStdin();

if (!hookFlags.isHookEnabled(hookId, { profiles: profilesCsv })) {
  passthrough(stdinBuf);
}

var pluginRoot = resolvePluginRoot();
var scriptAbs = path.resolve(pluginRoot, scriptRel);

var relative = path.relative(pluginRoot, scriptAbs);
if (relative.startsWith('..') || path.isAbsolute(relative)) {
  process.stderr.write('Path traversal blocked: ' + scriptRel + '\n');
  passthrough(stdinBuf);
}

var stdinStr = stdinBuf.toString('utf8');

try {
  var mod = require(scriptAbs);
  if (typeof mod.run === 'function') {
    var result = mod.run(stdinStr);

    if (result && typeof result === 'object' && !Buffer.isBuffer(result)) {
      if (result.stderr) {
        process.stderr.write(String(result.stderr));
      }
      if (result.stdout) {
        process.stdout.write(String(result.stdout));
      }
      process.exit(typeof result.exitCode === 'number' ? result.exitCode : 0);
    }

    if (typeof result === 'string') {
      process.stdout.write(result);
      process.exit(0);
    }

    passthrough(stdinBuf);
  }
} catch (_requireErr) {}

try {
  var child = childProcess.spawnSync(process.execPath, [scriptAbs], {
    input: stdinBuf,
    stdio: ['pipe', 'pipe', 'pipe'],
    timeout: 30000,
    maxBuffer: MAX_STDIN
  });

  if (child.stderr && child.stderr.length) {
    process.stderr.write(child.stderr);
  }

  if (child.stdout && child.stdout.length) {
    process.stdout.write(child.stdout);
  } else {
    passthrough(stdinBuf);
  }

  process.exit(child.status || 0);
} catch (_spawnErr) {
  passthrough(stdinBuf);
}
