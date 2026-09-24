import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { hostsAreConfigured } from '../../config/hosts.config';

/**
 * What this deployment hands a machine that is about to become a host: the
 * install command, the same steps written for a coding agent, the release
 * channel and the base URL artifacts come from — plus the fingerprint of the
 * control plane's own key, which the runner pins and then refuses to talk to
 * anything else by.
 *
 * All of it comes from **deploy-owned configuration**, never from a column. A
 * workspace-writable install or launch string would be remote code execution on
 * somebody's laptop, which is why the pairing response templates these here
 * instead of storing them
 * (`product/versions/mvp/09-runner-install-and-update.md` §1).
 */
@Injectable()
export class RunnerReleaseConfig {
  constructor(private readonly configService: ConfigService) {}

  /**
   * Whether a machine can actually be paired with this deployment. False leaves
   * every host route answering "not configured" and changes nothing else. It is
   * the same predicate the `hosts` capability is computed from.
   */
  get isConfigured(): boolean {
    return hostsAreConfigured(this.configService);
  }

  /** The origin a runner dials, and the audience it signs its assertions for. */
  get controlPlaneUrl(): string {
    return this.configService.get<string>('hosts.controlPlaneUrl') ?? '';
  }

  get releaseBaseUrl(): string | undefined {
    return this.configService.get<string>('hosts.releaseBaseUrl');
  }

  get channel(): string {
    return this.configService.get<string>('hosts.releaseChannel') ?? 'stable';
  }

  /**
   * SHA-256 of this control plane's Ed25519 public key, hex.
   *
   * Derived when the configuration is parsed, from a private key that never
   * leaves that factory — this is the only half of it anything here can read.
   */
  get controlPlaneFingerprint(): string | null {
    return this.configService.get<string>('hosts.signingKeyFingerprint') ?? null;
  }

  /**
   * SHA-256 of the installer, hex, or `null` when the deployment did not set
   * one. Shown beside the command and quoted in the agent prompt, so the
   * careful path — download, read, check, run — needs nothing else.
   */
  get installScriptSha256(): string | null {
    return this.configService.get<string>('hosts.installSha256') ?? null;
  }

  /**
   * The one-line install command, with the registration token in it. The token
   * can do exactly one thing — add one host, the minter's — and it expires, so
   * this is the one place it is allowed to appear.
   *
   * It rides in the installer's **environment**, not as `--token`: an argument
   * sits in the process list, readable by every account on the machine for as
   * long as the install runs, and the installer passes it on to `runner
   * register` the same way.
   */
  installCommandFor(secret: string): string {
    return `${this.fetchInstaller} | OPPENHEIMER_REGISTRATION_TOKEN=${secret} sh -s -- ${this.installerFlags}`;
  }

  /**
   * The same steps spelled out for a Claude Code or Codex already running on a
   * machine, for someone who would rather read them than pipe a script into a
   * shell.
   *
   * Every claim in it is one the runner and the installer keep: the exit codes
   * are `apps/runner/internal/cli/commands.go`'s, the lines to read are what
   * `runner status` prints, and the error codes are the catalog in
   * `apps/docs/docs/errors.md`. Its first job is to establish that the agent is
   * on the machine the person means, because the token is single-use: spent on
   * the wrong box, it leaves a host nobody wanted and no token.
   */
  agentPromptFor(secret: string): string {
    const digest = this.installScriptSha256;
    return [
      'Install the Oppenheimer runner on a machine and pair it with my account.',
      '',
      'What the runner is: one static Go binary. It opens no ports — it holds one',
      'outbound WebSocket to my control plane — and runs my coding sessions as git',
      'worktrees, each in its own tmux session. It installs as a user service (a',
      'launchd agent on macOS, a systemd user unit on Debian or Ubuntu), never as',
      'root and never system-wide.',
      '',
      'STEP 0 — Before running anything, work out where you are and ask me. Do not',
      'run the install command until I have answered every question below.',
      '',
      '1. Which machine is this? Run: uname -sr; uname -n; whoami; echo "$HOME"',
      '   If it is a container, a CI job, a devcontainer or a cloud sandbox — any',
      '   environment whose files disappear when it ends — stop and tell me. The',
      '   token is single-use; spent on a machine that disappears, it leaves me a',
      '   dead host and no token. (The runner refuses such a machine too, with',
      '   HOST_006; never pass --allow-container unless I say so.)',
      '',
      '2. Say, in one line: "I am on <hostname> (<os> <arch>) as <user>. Is this',
      '   the machine you want to add?" If it is not, ask me whether the right one',
      '   is reachable over SSH. If it is, use the SSH form in STEP 1. If not, stop',
      '   and give me the install command to run there myself. The token is still',
      '   unspent at this point.',
      '',
      '3. Ask me where session code should live on that machine. The default is',
      '   ~/oppenheimer-ai/workspaces. If I give a path, it must be absolute, not',
      '   inside ~/.oppenheimer, and not inside a synced folder (iCloud Drive,',
      '   Dropbox, Google Drive, OneDrive, ~/Library/CloudStorage); the runner',
      '   refuses the first two with HOST_007 and warns about the third.',
      '',
      '4. Check the two tools sessions need: git --version and tmux -V. If both',
      '   work, say nothing about them and move on. If one is missing, show me the',
      '   exact command that would install it (brew install <tool> on macOS; sudo',
      '   apt-get update && sudo apt-get install -y <tool> on Debian/Ubuntu) and',
      '   ask me. Run it only after I say yes, then check again. If I say no, stop:',
      '   the installer will not install anything itself when it cannot ask on a',
      '   terminal, and it stops before spending the token.',
      '',
      'STEP 1 — Install. Run this as that user, adding --workspaces with the path I',
      'chose (leave it off for the default):',
      '',
      `  ${this.installCommandFor(secret)} --workspaces '<path>'`,
      '',
      ...(digest
        ? [
            `The installer's SHA-256 is ${digest}. If you download it to read it`,
            'first, check that digest and stop if it differs.',
            '',
          ]
        : []),
      'Over SSH, keep the token out of every command line by sending it on stdin:',
      '',
      `  printf '%s\\n' '${secret}' | ssh <target> "IFS= read -r OPPENHEIMER_REGISTRATION_TOKEN && export OPPENHEIMER_REGISTRATION_TOKEN && ${this.fetchInstaller} | sh -s -- ${this.installerFlags} --workspaces '<path>'"`,
      '',
      'STEP 2 — Confirm. Run ~/.local/bin/oppenheimer-runner status and read the',
      'table; do not rely on its exit code, which is 0 even for an unpaired host or',
      'a stopped service. Report these lines: paired (the host id), service (it must',
      'say running), runner (the version), git, tmux, claude, and disk (it names the',
      'directory sessions will use and whether it was chosen or the default — check',
      'it is the one I asked for). Then ask me to confirm the host shows online in',
      'the console.',
      '',
      'If something goes wrong, stop and tell me. Do not improvise:',
      '- "This host is already paired" (PAIR_002): the machine belongs to another',
      '  control plane. The error suggests --force; do not use it unless I say so.',
      '- "The registration token was rejected" (PAIR_003, exit 3): it is expired,',
      '  used or revoked. Ask me for a new one from Add host.',
      '- "The control plane is limiting registrations" (PAIR_007): wait a minute and',
      '  run the same command again. The token was not spent.',
      '- "The control plane could not be reached" (PAIR_006, exit 6): show me the',
      '  URL and the error. Do not change the URL.',
      '- A signature or checksum mismatch: stop and show me the output. Do not',
      '  retry from anywhere else.',
      '- The output shows "paired as …" and then the service step fails: run the',
      '  same command again. It keeps the pairing, spends nothing, and retries the',
      '  service; show me what it says the second time.',
      '- claude not found: a warning, not a failure. Report it and continue.',
      '- You realise you ran it on the wrong machine: say so at once. The token is',
      '  spent, and I will unpair that host in the console.',
      '',
      'Never:',
      '- run any of this as root or with sudo, except a tool install I approved;',
      '- open a port or expose anything to the network;',
      '- write the token into a file, a script, a commit or a note, or repeat it in',
      '  your summary;',
      '- touch my repositories, my shell profile, my git config, or any credential',
      '  helper.',
    ].join('\n');
  }

  /**
   * `curl … <installer>`, pinned to HTTPS and TLS 1.2+ for an HTTPS URL. A
   * plain-HTTP URL is only ever a local development deployment, which the
   * `--proto` pin would refuse.
   */
  private get fetchInstaller(): string {
    const url = this.installUrl ?? '';
    return url.startsWith('https://')
      ? `curl --proto '=https' --tlsv1.2 -fsSL ${url}`
      : `curl -fsSL ${url}`;
  }

  private get installerFlags(): string {
    const flags = [`--url ${this.controlPlaneUrl}`];
    // `stable` is the runner's own default; naming it would only add noise to
    // the line a person pastes into a terminal.
    if (this.channel !== 'stable') flags.push(`--channel ${this.channel}`);
    // Where the installer fetches the manifest and the artifact from. The
    // script falls back to the hosted release base when this is absent, which
    // is the wrong host for every deployment but ours — a self-hosted install
    // would resolve `get.oppenheimer.dev`, or fail to, and never reach the
    // control plane it was handed. Naming it is the deployment's job precisely
    // because the script cannot guess it.
    if (this.releaseBaseUrl) flags.push(`--release-base ${this.releaseBaseUrl}`);
    return flags.join(' ');
  }

  private get installUrl(): string | undefined {
    return this.configService.get<string>('hosts.installUrl');
  }
}
