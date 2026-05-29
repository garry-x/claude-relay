import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

const CLI = path.resolve('src/cli.js');

test('prints help', () => {
  const output = run(['--help']);
  assert.match(output, /Claude Code CLI proxy wrapper/);
  assert.match(output, /proxy set <url>/);
  assert.match(output, /install \[--proxy URL\]/);
});

test('stores and shows a static proxy', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'claude-relay-'));
  const env = { HOME: home };

  run(['proxy', 'set', 'http://user:pass@proxy.example.com:8080'], env);
  const configPath = path.join(home, '.claude-relay', 'config.json');
  const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  assert.equal(config.http, 'http://user:pass@proxy.example.com:8080/');
  assert.equal(config.https, 'http://user:pass@proxy.example.com:8080/');

  const output = run(['proxy', 'show'], env);
  assert.match(output, /config proxy:\s+http:\/\/\*\*\*@proxy\.example\.com:8080\//);
  assert.match(output, /effective proxy:\s+http:\/\/\*\*\*@proxy\.example\.com:8080\//);
});

test('rejects unsupported proxy protocols', () => {
  assert.throws(
    () => run(['proxy', 'set', 'socks5://127.0.0.1:1080']),
    /proxy URL must start with http:\/\/ or https:\/\//
  );
});

test('installs a bash wrapper and saves proxy config', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'claude-relay-home-'));
  const binDir = fs.mkdtempSync(path.join(os.tmpdir(), 'claude-relay-bin-'));
  const env = { HOME: home, SHELL: '/bin/zsh' };

  run([
    'install',
    '--self-only',
    '--no-shell',
    '--bin-dir',
    binDir,
    '--proxy',
    'http://user:pass@proxy.example.com:8080'
  ], env);

  const installedBin = path.join(binDir, 'claude-relay');
  assert.equal(fs.statSync(installedBin).mode & 0o111, 0o111);
  assert.match(fs.readFileSync(installedBin, 'utf8'), /exec node/);

  const configPath = path.join(home, '.claude-relay', 'config.json');
  const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  assert.equal(config.http, 'http://user:pass@proxy.example.com:8080/');

  const output = execFileSync(installedBin, ['--help'], {
    encoding: 'utf8',
    env: {
      ...process.env,
      ...env,
      HTTPS_PROXY: '',
      HTTP_PROXY: '',
      https_proxy: '',
      http_proxy: ''
    }
  });
  assert.match(output, /Claude Code CLI proxy wrapper/);
});

test('adds bin directory to shell startup file when needed', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'claude-relay-home-'));
  const binDir = fs.mkdtempSync(path.join(os.tmpdir(), 'claude-relay-bin-'));
  const env = {
    HOME: home,
    SHELL: '/usr/bin/fish',
    PATH: '/usr/bin:/bin'
  };

  run([
    'install',
    '--self-only',
    '--bin-dir',
    binDir
  ], env);

  const profile = fs.readFileSync(path.join(home, '.profile'), 'utf8');
  assert.match(profile, /# claude-relay path/);
  assert.match(profile, new RegExp(`export PATH="${escapeRegExp(binDir)}:\\$PATH"`));
});

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function run(args, extraEnv = {}) {
  return execFileSync(process.execPath, [CLI, ...args], {
    encoding: 'utf8',
    env: {
      ...process.env,
      ...extraEnv,
      HTTPS_PROXY: '',
      HTTP_PROXY: '',
      https_proxy: '',
      http_proxy: ''
    },
    stdio: ['ignore', 'pipe', 'pipe']
  });
}
