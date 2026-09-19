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
   * The one-line install command, with the registration token in it. The token
   * can do exactly one thing — add one host, the minter's — and it expires, so
   * this is the one place it is allowed to appear.
   */
  installCommandFor(secret: string): string {
    const flags = [`--token ${secret}`, `--url ${this.controlPlaneUrl}`];
    // `stable` is the runner's own default; naming it would only add noise to
    // the line a person pastes into a terminal.
    if (this.channel !== 'stable') flags.push(`--channel ${this.channel}`);
    return `curl -fsSL ${this.installUrl} | sh -s -- ${flags.join(' ')}`;
  }

  /**
   * The same steps spelled out for a Claude Code or Codex already running on the
   * machine, for someone who would rather read them than pipe a script into a
   * shell. The do-not list is part of the instruction, not decoration: it is
   * what keeps an agent from running the installer as root or copying the token
   * somewhere it will outlive its hour.
   */
  agentPromptFor(secret: string): string {
    return [
      'Install the Oppenheimer runner on this machine and pair it with my account.',
      '',
      'The runner is a single static Go binary. It opens no ports: it holds one',
      'outbound WebSocket to the control plane and runs my coding sessions as git',
      'worktrees with a tmux session each. The machine becomes mine, usable from',
      'any of my workspaces.',
      '',
      'Steps:',
      `1. Run the installer as the current user: ${this.installCommandFor(secret)}`,
      '2. Verify the downloaded artifact against the SHA-256 in the signed release',
      `   manifest at ${this.releaseBaseUrl ?? ''} before running it.`,
      '3. Let it install the user service (launchd agent on macOS, systemd user',
      '   unit on Debian or Ubuntu) and wait until it reports the host online.',
      '4. Show me the preflight table it prints: git, tmux, claude, free disk.',
      '',
      'Do not:',
      '- do not run any of it as root or with sudo, except a package install it',
      '  explicitly asks for and names;',
      '- do not open a port or expose anything to the network;',
      '- do not copy the registration token anywhere else, and do not put it in a',
      '  file, a shell history entry you keep, or a commit;',
      '- stop and tell me if a checksum does not match.',
    ].join('\n');
  }

  private get installUrl(): string | undefined {
    return this.configService.get<string>('hosts.installUrl');
  }
}
