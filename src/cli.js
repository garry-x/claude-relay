#!/usr/bin/env node

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { spawn, execFileSync } from 'node:child_process';

const NAME = 'claude-relay';
const VERSION = '0.1.0';
const CONFIG_DIR = path.join(realHome(), '.claude-relay');
const CONFIG_FILE = path.join(CONFIG_DIR, 'config.json');
const DEFAULT_NO_PROXY = 'localhost,127.0.0.1,::1,.local';
const DEFAULT_CHECK_URL = 'https://api.anthropic.com';

function realHome() {
  const sudoUser = process.env.SUDO_USER;
  if (!sudoUser) {
    return os.homedir();
  }

  for (const prefix of ['/Users', '/home']) {
    const candidate = path.join(prefix, sudoUser);
    try {
      if (fs.statSync(candidate).isDirectory()) {
        return candidate;
      }
    } catch {
      // Continue with the next common home prefix.
    }
  }

  return os.homedir();
}

function info(message) {
  console.error(`[${NAME}] ${message}`);
}

function die(message) {
  console.error(`error: ${message}`);
  process.exit(1);
}

function loadConfig() {
  try {
    return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
  } catch {
    return {};
  }
}

function saveConfig(config) {
  fs.mkdirSync(CONFIG_DIR, { recursive: true });
  fs.writeFileSync(CONFIG_FILE, `${JSON.stringify(config, null, 2)}\n`);
}

function parseProxyUrl(value) {
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`invalid proxy URL: ${value}`);
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error('proxy URL must start with http:// or https://');
  }

  if (!url.hostname) {
    throw new Error('proxy URL must include a host');
  }

  return url.toString();
}

function redactProxyUrl(value) {
  return String(value).replace(/\/\/[^@/]+@/, '//***@');
}

function configuredProxy() {
  const config = loadConfig();
  return process.env.HTTPS_PROXY ||
    process.env.https_proxy ||
    process.env.HTTP_PROXY ||
    process.env.http_proxy ||
    config.https ||
    config.http ||
    '';
}

function findClaude() {
  try {
    return execFileSync('which', ['claude'], { encoding: 'utf8' }).trim();
  } catch {
    return '';
  }
}

function claudeVersion() {
  const bin = findClaude();
  if (!bin) {
    return '';
  }

  try {
    return execFileSync(bin, ['--version'], {
      encoding: 'utf8',
      timeout: 5000
    }).trim();
  } catch {
    return 'found, version unavailable';
  }
}

function commandExists(command) {
  try {
    execFileSync('which', [command], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

function proxySet(url) {
  if (!url) {
    die(`usage: ${NAME} proxy set <url>`);
  }

  const proxyUrl = parseProxyUrl(url);
  const config = loadConfig();
  config.http = proxyUrl;
  config.https = proxyUrl;
  saveConfig(config);
  info(`proxy set to: ${redactProxyUrl(proxyUrl)}`);
}

function proxyShow() {
  const config = loadConfig();
  const envProxy = process.env.HTTPS_PROXY ||
    process.env.https_proxy ||
    process.env.HTTP_PROXY ||
    process.env.http_proxy ||
    '';

  console.log(`config file:     ${CONFIG_FILE}`);
  console.log(`env proxy:       ${envProxy ? redactProxyUrl(envProxy) : 'none'}`);
  console.log(`config proxy:    ${config.https || config.http ? redactProxyUrl(config.https || config.http) : 'none'}`);
  console.log(`effective proxy: ${configuredProxy() ? redactProxyUrl(configuredProxy()) : 'none'}`);
}

function proxyUnset() {
  const config = loadConfig();
  delete config.http;
  delete config.https;
  saveConfig(config);
  info('proxy configuration cleared.');
}

function proxyCheck(options) {
  const testUrl = options.url || DEFAULT_CHECK_URL;
  const timeout = Number(options.timeout || 10);
  const proxyUrl = configuredProxy();
  const ok = [];
  const issues = [];

  const check = (label, condition, detail = '') => {
    const item = `${label}${detail ? ` (${detail})` : ''}`;
    if (condition) {
      ok.push(item);
    } else {
      issues.push(item);
    }
  };

  check('proxy config', Boolean(proxyUrl), proxyUrl ? redactProxyUrl(proxyUrl) : 'not configured');
  check('curl', commandExists('curl'), commandExists('curl') ? 'available' : 'not found');

  if (proxyUrl && commandExists('curl')) {
    const start = Date.now();
    try {
      const status = execFileSync('curl', [
        '-s',
        '-o',
        '/dev/null',
        '-w',
        '%{http_code}',
        '--proxy',
        proxyUrl,
        '--connect-timeout',
        String(timeout),
        '--max-time',
        String(timeout),
        testUrl
      ], {
        encoding: 'utf8',
        timeout: (timeout + 5) * 1000
      }).trim();
      const code = Number(status);
      const latency = Date.now() - start;
      check('proxy connectivity', code >= 200 && code < 500, `HTTP ${status}, ${latency}ms -> ${testUrl}`);
    } catch {
      check('proxy connectivity', false, `connection failed -> ${testUrl}`);
    }
  } else {
    check('proxy connectivity', false, proxyUrl ? 'curl not available' : 'no proxy configured');
  }

  const claudeBin = findClaude();
  check('claude CLI', Boolean(claudeBin), claudeBin ? claudeVersion() : 'not found');

  console.log(`${NAME} proxy check\n`);
  for (const item of ok) {
    console.log(`  ok  ${item}`);
  }
  if (issues.length > 0) {
    console.log('');
    for (const item of issues) {
      console.log(`  err ${item}`);
    }
  }
  console.log(`\n${ok.length} OK, ${issues.length} issue${issues.length === 1 ? '' : 's'}`);

  if (issues.length > 0) {
    process.exit(1);
  }
}

function runClaude(args) {
  const claudeBin = findClaude();
  if (!claudeBin) {
    die("'claude' not found in PATH. Install Claude Code CLI first.");
  }

  const proxyUrl = configuredProxy();
  const env = { ...process.env };

  if (proxyUrl) {
    env.HTTP_PROXY = proxyUrl;
    env.HTTPS_PROXY = proxyUrl;
    env.http_proxy = proxyUrl;
    env.https_proxy = proxyUrl;
    env.WS_PROXY = proxyUrl;
    env.WSS_PROXY = proxyUrl;
    env.NO_PROXY = DEFAULT_NO_PROXY;
    env.no_proxy = DEFAULT_NO_PROXY;
    info(`using proxy: ${redactProxyUrl(proxyUrl)}`);
  } else {
    info('no proxy configured; running claude without proxy env');
  }

  const child = spawn(claudeBin, args, {
    env,
    stdio: 'inherit'
  });

  child.on('close', (code, signal) => {
    if (signal) {
      process.kill(process.pid, signal);
      return;
    }
    process.exit(code || 0);
  });
  child.on('error', (error) => die(error.message));
}

function parseOptions(argv) {
  const options = { _: [] };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--url' || arg === '--timeout') {
      if (!argv[i + 1]) {
        die(`${arg} requires a value`);
      }
      options[arg.slice(2)] = argv[i + 1];
      i += 1;
    } else if (arg.startsWith('--url=')) {
      options.url = arg.slice('--url='.length);
    } else if (arg.startsWith('--timeout=')) {
      options.timeout = arg.slice('--timeout='.length);
    } else {
      options._.push(arg);
    }
  }
  return options;
}

function printHelp() {
  console.log(`${NAME} ${VERSION}

Claude Code CLI proxy wrapper.

Traffic path:
  claude -> static proxy -> target

Commands:
  proxy set <url>                       Save static proxy
  proxy show                            Show proxy configuration
  proxy unset                           Clear proxy configuration
  proxy check [--url URL] [--timeout S] Check proxy, curl, and claude CLI
  run <args...>                         Run claude with proxy env injected
  <args...>                             Any unknown command is passed to claude
  --version                             Show version

Quick start:
  ${NAME} proxy set http://user:pass@proxy.example.com:8080
  ${NAME} proxy check
  ${NAME} run

Config:
  ${CONFIG_FILE}`);
}

function printVersion() {
  console.log(`${NAME} ${VERSION}`);
  const version = claudeVersion();
  console.log(version ? `claude: ${version}` : 'claude: not found');
}

function main() {
  const raw = process.argv.slice(2);
  const command = raw[0];
  const args = raw.slice(1);

  switch (command) {
    case undefined:
    case '-h':
    case '--help':
      printHelp();
      break;

    case '-V':
    case '--version':
      printVersion();
      break;

    case 'proxy': {
      const action = args[0];
      const options = parseOptions(args.slice(1));
      if (action === 'set') {
        proxySet(options._[0]);
      } else if (action === 'show') {
        proxyShow();
      } else if (action === 'unset') {
        proxyUnset();
      } else if (action === 'check') {
        proxyCheck(options);
      } else {
        die(`usage: ${NAME} proxy {set|show|unset|check}`);
      }
      break;
    }

    case 'run':
      runClaude(args);
      break;

    default:
      runClaude(raw);
      break;
  }
}

try {
  main();
} catch (error) {
  die(error.message);
}
