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
