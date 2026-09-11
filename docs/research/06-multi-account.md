# 06 — Multiple accounts per provider: how Orca does it, how we do it

Question: how does Orca let one person hold several Claude, Codex, Kimi,
OpenCode, Gemini, or MiniMax accounts, switch between them, and see usage
per account? And what does that look like on a platform where the agent
runs on a remote target or inside a VM?

## 1. How Orca does it

### Discovery, not import

Orca never asks for a credential. You log in to each account **from a
terminal at least once**, the CLI writes its own state (`~/.claude`,
`~/.codex`, and the equivalents), and Orca scans those locations. In
Settings → Agents you give each detected account a label ("personal",
"work"). Orca is a viewer over files the vendor CLI already owns.

### Switching: per-account runtime homes

The docs say Orca "rewrites the active credential pointer" and "mirrors
settings from your real `~/.codex/config.toml` into the active runtime
home". Read together with the CLIs' own config-dir variables, the
mechanism is:

- Each managed account gets its own **runtime home** directory that Orca
  owns, containing that account's credential plus a copy of the user's
  real config (so hooks, MCP servers, and preferences follow the user,
  not the account).
- New agent processes are launched with the CLI's config-dir variable
  pointing at the active account's runtime home.
- **Existing processes keep their account until restart.** A swap only
  affects sessions launched after it. Orca holds an in-progress switch
  behind a guard so two sessions do not trigger overlapping token
  refreshes on the same credential.
- The swap is one click in the status bar chip, "no re-login, no config
  editing". A keyboard shortcut for it is an open request (#15467), and
  the account switcher shipped in v1.1.14.

For Codex specifically, Orca also edits `config.toml` byte-wise to add
`trusted_hash` entries under `[hooks]` so that its lifecycle hooks
(permission requests, post-tool-use) are trusted by the CLI. That is
what feeds the "waiting for approval" state on the board.

### Usage meters: read the CLI's own bookkeeping

"No API calls, no extra auth." Orca reads the local usage state each CLI
keeps on disk and shows, per provider and per account:

- current usage against the plan,
- reset times for the 5-hour, daily, and weekly windows,
- a warning once any window passes 80 %,
- estimated cost from a local pricing table (explicitly "not
  authoritative").

The status bar follows the active account; the popover lists every
provider and every account with independent bars. Numbers refresh only
when the agent writes its state file, so they lag by one turn. The
mobile companion has the same switcher and meters. (The DeepWiki
architecture notes also describe a `RateLimitService` that polls provider
usage endpoints with caching and debouncing; the user docs describe file
reads. Treat "files first, endpoint where the vendor offers one" as the
real behavior.)

### Providers Orca tracks

Claude Code, Codex, Gemini CLI, OpenCode, Kimi Code, MiniMax, plus Cursor
CLI and GLM via OpenCode/Claude-compatible endpoints. The pattern is the
same for all: discover the home, label it, launch with the env var,
read the usage file.

## 2. The per-CLI facts we depend on

| CLI | Config-dir variable | Credential location | Login flow | Notes |
|-----|---------------------|---------------------|-----------|-------|
| Claude Code | `CLAUDE_CONFIG_DIR` | Linux: `.credentials.json` in the config dir. macOS: **Keychain** by default | browser OAuth or device URL printed in the terminal; `claude auth login` | On macOS the Keychain item is per user, not per config dir, so per-account isolation on a Mac needs care (see §4). API key via `ANTHROPIC_API_KEY` or `apiKeyHelper` bypasses this. |
| Codex | `CODEX_HOME` (default `~/.codex`) | `auth.json` in `CODEX_HOME` | ChatGPT login (browser) or API key; `forced_login_method` can pin one | Profiles: `$CODEX_HOME/<name>.config.toml`, selected with `--profile`. Hooks must be trusted via `trusted_hash` in `config.toml`. |
| Kimi Code | `KIMI_CODE_HOME` (default `~/.kimi-code`), older `~/.kimi` with `KIMI_SHARE_DIR` | `credentials/` under the home | RFC 8628 device-code flow, prints URL and code, polls; `kimi login` outside the TUI | OAuth accounts are managed with `/login` and `/logout`, not `/provider`. |
| OpenCode | none documented; relocate with `XDG_DATA_HOME` | `~/.local/share/opencode/auth.json` | `/connect` picks provider and method (OAuth or key) | One credential per provider in the file, so multiple accounts means multiple data dirs. |
| Gemini CLI | `~/.gemini` (env override to verify) | OAuth cache in the home | Google OAuth in browser | verify the variable name before relying on it |

The common shape: **one directory per account, one environment variable
to select it, one login run inside a terminal to populate it.** That is
exactly the primitive the platform already has.

## 3. How we do it

### Accounts are a first-class object, bound to a target and a human

```
Account
  id, label ("work", "personal")
  provider (claude | codex | kimi | opencode | gemini | minimax)
  target_id        the machine or persistent home volume it lives on
  owner_user_id    the human who logged it in
  home_path        e.g. ~/.oppenheimer/accounts/claude-work
  status           logged_in | needs_login | expired
  usage            last-read snapshot of the CLI's usage file
```

- **Creating an account is running the login inside a terminal.** The UI
  offers "Add account → Claude → on mac-studio". The runner opens a PTY
  with `CLAUDE_CONFIG_DIR=~/.oppenheimer/accounts/claude-work` and runs
  `claude auth login`. The login URL gets the clickable badge from note
  01. When the CLI writes its credential, the runner marks the account
  `logged_in`. Same for Codex with `CODEX_HOME`, Kimi with
  `KIMI_CODE_HOME`, OpenCode with `XDG_DATA_HOME`.
- **Choosing an account is choosing an env var.** A session has an
  `account_id` per provider. The runner sets the variable in that
  session's shell only. Nothing global changes, so two sessions on the
  same target can run two different Claude accounts at the same time.
  This is strictly better than Orca's "new sessions after the swap"
  because there is no swap: every session carries its own selection.
- **Settings follow the user, credentials follow the account.** Like
  Orca, the runner mirrors the user's base config (`settings.json`,
  hooks, MCP servers) into each account home at session start, without
  touching the credential file. On Codex, this includes maintaining the
  `trusted_hash` entries for our status hooks.
- **On VMs, accounts live on the persistent home volume** (note 02, 04
  F13). The account directory is just a subdirectory there. A fresh VM
  for that target sees all of that target's accounts.
- **The platform never reads the credential file's contents.** It reads
  the usage file and the presence and mtime of the credential file, and
  nothing else. This keeps note 01 §7 true with many accounts.

### Usage meters

The runner reads each account home's usage state on a timer and after
every agent turn (the screen-manifest state machine from note 03 knows
when a turn ended), and reports a snapshot in its heartbeat. The board
shows, per account: plan, 5-hour / daily / weekly bars, reset times,
80 % warning. Where a vendor publishes a usage endpoint, the runner may
poll it from the target using that account's own credential, exactly as
the CLI would, with caching and debouncing.

### Picking an account for a task

Default: the project's default account per provider. Optional: "use the
account with the most headroom", computed from the meters, restricted to
accounts owned by the same human. This is the same thing a person does by
hand when they see the 80 % warning and switch chips. The platform does
not pool accounts across users and does not rotate through accounts to
exceed what one person is entitled to; every account is one human's own
login on a machine that human owns, which is the posture from note 01
and the same one Orca ships with.

### macOS Keychain caveat

Claude Code on macOS stores the OAuth credential in the login Keychain,
keyed by account, not by config dir. Two accounts on one Mac therefore
need either two macOS users, or an API-key-based login for the second
account, or verification that current Claude Code versions scope the
Keychain item by `CLAUDE_CONFIG_DIR` (to be tested in phase 1 on a real
Mac Studio). On Linux targets and in VMs there is no Keychain and the
per-directory model works as described. Codex, Kimi, and OpenCode keep
files, so they are unaffected.

## 4. What this adds to the plan

| Piece | Where | Size | Phase |
|-------|-------|------|-------|
| Account object, per-target, per-user | control plane + db | small | 3 |
| "Add account" = login in a terminal with the config-dir env set | runner + web | small | 3 |
| Per-session account selection, env injection in the shell only | runner | tiny | 3 |
| Config mirroring into account homes; Codex `trusted_hash` maintenance | runner | small | 5 |
| Usage snapshot per account in heartbeat; board meters and 80 % warning | runner + web | medium | 5 |
| "Most headroom" account selection for a task | scheduler | small | 5 |
| Keychain behavior test on macOS | phase-1 spike | tiny | 1 |

## Sources

- Orca: <https://www.onorca.dev/docs/agents/codex-hot-swap>,
  <https://www.onorca.dev/docs/agents/claude-code>,
  <https://www.onorca.dev/docs/agents/usage-tracking>,
  <https://github.com/stablyai/orca/issues/15467>,
  <https://deepwiki.com/stablyai/orca/7.3-ai-agent-tracking-and-codex-accounts>
- Claude Code settings and `CLAUDE_CONFIG_DIR`: <https://code.claude.com/docs/en/settings>
- Codex config reference and `CODEX_HOME`: <https://learn.chatgpt.com/docs/config-file/config-reference>
- Kimi Code CLI data locations and OAuth: <https://www.kimi-cli.com/en/configuration/data-locations.html>,
  <https://deepwiki.com/MoonshotAI/kimi-cli/9.7-oauth-and-authentication>
- OpenCode providers and `auth.json`: <https://opencode.ai/docs/providers/>
- Two Claude accounts on one machine (community write-up): <https://dev.to/daksh-gargas/one-brain-two-wallets-two-claude-code-accounts-on-one-machine-5ejb>
