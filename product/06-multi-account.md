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

*Corrected by note 16 after reading the source:* that holds for the
system-default login only. A *managed* account is captured out of a
throwaway login dir, stored under Orca's own root, refreshed by Orca
against the OAuth token endpoint, and written back before each launch.
Orca is a credential manager on that host, not a viewer. §3's "the
platform never reads the credential file's contents" is a deliberate
difference from Orca, not a copy of it.

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
- **On VMs, each account is its own persistent volume** (note 04 F13),
  attached only to the VM whose session selected it. A fresh VM sees
  exactly the accounts it was given. Two sessions on one host with
  different accounts run concurrently on different volumes; the same
  account in two VMs at once is blocked on Firecracker hosts and allowed
  on tart hosts, which share directories instead of block devices.
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

### macOS: resolved, with one headless detail

Verified against the official authentication docs and the `claude-account`
tool: since **Claude Code 2.1.144** the macOS Keychain entry is keyed to
`CLAUDE_CONFIG_DIR` (hashed), and `CLAUDE_SECURESTORAGE_CONFIG_DIR` can
pin the Keychain scope explicitly. Two config dirs mean two Keychain
items and two independent logins on one Mac, no second macOS user
needed. This is what Orca's per-account runtime homes rely on; Orca does
nothing macOS-specific beyond launching with the variable set.

The headless detail: when the Keychain rejects a write, which is what
happens in an SSH session or under a launchd agent with no unlocked
login Keychain, Claude Code falls back to `.credentials.json` (mode 0600)
inside the config dir, exactly as on Linux. So a Mac Studio driven by our
runner behaves like a Linux target: file-based credentials per account
dir. The runner should pass both variables and pin the Claude Code
version floor at 2.1.144. Codex, Kimi, and OpenCode keep files
everywhere, so they were never affected.

### Yes, you log in once per machine per account

There is no way around this, and it is the right property. A credential
is issued to a CLI on a machine; Orca's own instructions are "log in
from a terminal at least once" on every machine, and its SSH docs say
nothing about remote login because the remote just runs the CLI. The
platform makes it painless rather than making it disappear:

- "Add account on <target>" is a two-click flow that opens the PTY with
  the right env, runs the login, and turns the printed URL into a button.
  Thirty seconds per account per machine, once.
- Each account is a persistent volume on the host, so a fleet of
  ephemeral VMs behind one host counts as one machine.
- The board shows which targets have which accounts and flags
  `needs_login` or `expired` (Claude Code warns three days before a login
  expires and `/status` reports the expired state).
- For unattended runs on a machine where nobody will click a link,
  Claude Code's documented escape hatch is `claude setup-token`: a
  one-year OAuth token for a subscription, meant for CI, passed as
  `CLAUDE_CODE_OAUTH_TOKEN`. It is still one human's own token and it
  lands in the project vault as a normal secret, injected per session
  like any other. It cannot start Remote Control or fetch claude.ai
  connectors, which is fine for a headless task.

## 4. What this adds to the plan

| Piece | Where | Size | Phase |
|-------|-------|------|-------|
| Account object, per-target, per-user | control plane + db | small | 3 |
| "Add account" = login in a terminal with the config-dir env set | runner + web | small | 3 |
| Per-session account selection, env injection in the shell only | runner | tiny | 3 |
| Config mirroring into account homes; Codex `trusted_hash` maintenance | runner | small | 5 |
| Usage snapshot per account in heartbeat; board meters and 80 % warning | runner + web | medium | 5 |
| "Most headroom" account selection for a task | scheduler | small | 5 |
| Verify Keychain scoping and file fallback on a real Mac Studio, Claude Code ≥ 2.1.144 | phase-1 spike | tiny | 1 |

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
- Claude Code authentication and credential storage: <https://code.claude.com/docs/en/authentication>
- `claude-account` (per-profile Keychain scoping, 2.1.144 floor): <https://github.com/hamzarehmandeveloper/claude-account>
- Two Claude accounts on one machine (community write-up): <https://dev.to/daksh-gargas/one-brain-two-wallets-two-claude-code-accounts-on-one-machine-5ejb>
