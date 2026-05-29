# claude-relay

`claude-relay` is a zero-dependency Node.js wrapper for Claude Code CLI with static proxy support.

Traffic path:

```text
claude -> static proxy -> target
```

There is no chain mode and no relay daemon. The tool stores a static proxy URL and injects proxy environment variables when launching `claude`.

## Requirements

- Node.js 18+
- Claude Code CLI available as `claude`

## Quick Start

```bash
node ./src/cli.js proxy set http://user:pass@proxy.example.com:8080
node ./src/cli.js proxy check
node ./src/cli.js run
```

With npm linking:

```bash
npm link
claude-relay proxy set http://user:pass@proxy.example.com:8080
claude-relay proxy check
claude-relay run
```

Unknown commands are passed through to `claude`, so these are equivalent:

```bash
claude-relay run
claude-relay
```

## Commands

```text
proxy set <url>                       Save static proxy
proxy show                            Show proxy configuration
proxy unset                           Clear proxy configuration
proxy check [--url URL] [--timeout S] Check proxy, curl, and claude CLI
run <args...>                         Run claude with proxy env injected
<args...>                             Any unknown command is passed to claude
--version                             Show version
```

## Proxy Environment

`run` injects:

```text
HTTP_PROXY / HTTPS_PROXY      configured proxy URL
http_proxy / https_proxy      configured proxy URL
WS_PROXY / WSS_PROXY          configured proxy URL
NO_PROXY / no_proxy           localhost,127.0.0.1,::1,.local
```

Environment proxy variables take priority over saved config:

```text
HTTPS_PROXY > https_proxy > HTTP_PROXY > http_proxy > saved config
```

This matches Claude Code's official enterprise network configuration: Claude Code respects standard `HTTP_PROXY` and `HTTPS_PROXY` environment variables, supports proxy URLs with basic authentication, and does not support SOCKS proxies.

## Config

The proxy is stored at:

```text
~/.claude-relay/config.json
```
