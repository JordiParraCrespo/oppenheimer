import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { hostsAreConfigured } from '../../config/hosts.config';

/**
 * What this deployment hands a machine about to become a host: the install command,
 * the same wrapped for a coding agent, the release channel, the artifacts base URL,
 * and the fingerprint of the control plane's key, which the runner pins.
 *
 * All from **deploy-owned configuration**, never a column: a workspace-writable
 * install or launch string would be remote code execution on somebody's laptop
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
   * The one-line install command, with the registration token in it: the one place
   * it may appear, since it can only add one host (the minter's) and it expires.
   *
   * An environment assignment, not an argument, so it is in no process's argv and
   * other accounts cannot read it from the process list during the install; the
   * installer hands it to `runner register` the same way. It does stay in the
   * pasting shell's history until the token expires.
   */
  installCommandFor(secret: string): string {
    return `${this.fetchInstaller} | OPPENHEIMER_REGISTRATION_TOKEN=${secret} sh -s -- ${this.installerFlags}`;
  }

  /**
   * The install command wrapped for a Claude Code or Codex already running on a
   * machine: what to settle with the person before running it, and what to show them
   * after. A template, not a procedure: asking about the workspace path and missing
   * tools, refusing a temporary-looking machine and each error's next step belong to
   * the installer and runner, and a copy here would go stale. The secret appears
   * once, inside the command.
   */
  agentPromptFor(secret: string): string {
    const digest = this.installScriptSha256;
    return [
      'Install the Oppenheimer runner on a machine of mine and pair it with my account.',
      '',
      'Before you run anything:',
      '- Tell me which machine you are on (uname -n, uname -sr, whoami) and ask whether it',
      '  is the one I mean. If it is not, stop: the token below pairs one machine only.',
      '- Ask me where session code should live. Add --workspaces with that path to the',
      '  command, or leave it off for ~/oppenheimer-ai/workspaces.',
      '- Do not install anything, run anything as root, or add --force or --allow-container',
      '  unless I say so.',
      '',
      'Then run this as that user:',
      '',
      `  ${this.installCommandFor(secret)}`,
      '',
      ...(digest
        ? [`The installer's SHA-256 is ${digest}. If you download it first, check it.`, '']
        : []),
      'Do not copy the token anywhere else; it expires soon after it is created.',
      '',
      'Afterwards, run ~/.local/bin/oppenheimer-runner status and show me what it prints.',
      'If anything fails, stop and show me the output. The error says what to do next.',
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
    // The script falls back to the hosted release base when this is absent,
    // which is the wrong host for every deployment but ours — a self-hosted
    // install would resolve `get.oppenheimer.dev`, or fail to, and never reach
    // the control plane it was handed.
    if (this.releaseBaseUrl) flags.push(`--release-base ${this.releaseBaseUrl}`);
    return flags.join(' ');
  }

  private get installUrl(): string | undefined {
    return this.configService.get<string>('hosts.installUrl');
  }
}
