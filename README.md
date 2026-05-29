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
./claude-relay install --proxy http://user:pass@proxy.example.com:8080
claude-relay proxy check
claude-relay run
```

Development usage without installing:

```bash
node ./src/cli.js proxy set http://user:pass@proxy.example.com:8080
node ./src/cli.js run
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
install [--proxy URL] [--bin-dir DIR] Install claude-relay and Claude Code if needed
install --update                      Update Claude Code to latest
install --version VERSION             Install a specific Claude Code npm version
run <args...>                         Run claude with proxy env injected
<args...>                             Any unknown command is passed to claude
--version                             Show version
```

## Install

Default install:

```bash
./claude-relay install --proxy http://user:pass@proxy.example.com:8080
```

This does three things:

1. Saves the proxy to `~/.claude-relay/config.json`.
2. Installs `claude-relay` into the first writable bin directory from `/usr/local/bin`, `~/.local/bin`, or `~/bin`.
3. Installs Claude Code with npm if `claude` is not already available.

Claude Code is installed from the official npm package:

```bash
npm install -g @anthropic-ai/claude-code
```

To update Claude Code:

```bash
claude-relay install --update
```

To install a specific Claude Code version:

```bash
claude-relay install --version 1.2.3
```

Install options:

```text
--proxy URL      Save static proxy before installing; npm install uses this proxy
--bin-dir DIR    Install claude-relay wrapper into a specific bin directory
--force          Overwrite an existing claude-relay binary
--no-shell       Do not update shell startup files
--self-only      Install only claude-relay, not Claude Code
```

When the chosen bin directory is not already on `PATH`, `install` updates the detected shell startup file:

```text
zsh       ~/.zshrc
bash      ~/.bash_profile on macOS, otherwise ~/.bashrc
other     ~/.profile
```

When run with `sudo`, configuration and shell startup updates target the original user's home directory when it can be resolved, while the binary can still be installed system-wide.

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
