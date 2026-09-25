import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { hostsAreConfigured } from '../../config/hosts.config';

/**
 * What this deployment hands a machine that is about to become a host: the
 * install command, the same command wrapped for a coding agent, the release
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
   * It is an environment assignment on the pasted line, not an argument: it is
   * in no process's argv, so other accounts on the machine cannot read it from
   * the process list while the install runs, and the installer hands it to
   * `runner register` the same way. It is still on the line the person pastes,
   * and so in that shell's history until the token expires.
   */
  installCommandFor(secret: string): string {
    return `${this.fetchInstaller} | OPPENHEIMER_REGISTRATION_TOKEN=${secret} sh -s -- ${this.installerFlags}`;
  }

  /**
   * The install command wrapped for a Claude Code or Codex already running on
   * a machine: what to settle with the person before running it, and what to
   * show them after. Deliberately a template, not a procedure. The procedure
   * is the installer's and the runner's: they ask about the workspace path and
   * missing tools on a terminal, refuse a machine that looks temporary, and
   * say what to do next in each error. Restating those steps here would be a
   * second copy that goes stale the next time the installer changes.
   *
   * The secret appears once, inside the command.
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
      'Do not copy the token anywhere else; it expires within the hour.',
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
