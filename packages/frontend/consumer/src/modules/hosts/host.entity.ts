/**
 * A host as the console needs it: a machine the user owns that runs sessions
 * (`product/versions/mvp/00-scope.md`). A host is paired with one pasted
 * install command carrying a registration token, and appears here once its
 * runner connects.
 *
 * The API reports `online` as a boolean rather than a state word, so that is
 * what this carries. `pairing` was a third state in the design note; on the
 * wire a host simply does not exist until its runner has registered, which is
 * the same fact told a shorter way.
 */
export class HostEntity {
  constructor(
    public readonly id: string,
    public readonly name: string,
    /** Whether the runner is dialled in right now. */
    public readonly online: boolean,
    /** What the machine calls itself, once its runner has said. */
    public readonly hostname: string | null,
    /** `macos`, `linux`, … as the runner reported it. */
    public readonly os: string | null,
    public readonly arch: string | null,
    public readonly runnerVersion: string | null,
    /** When the runner last reported in; `null` until it has connected once. */
    public readonly lastSeenAt: Date | null,
    public readonly createdAt: Date,
  ) {}

  /**
   * The one-line description the summary rows show ("mac-studio · macos").
   * Falls back to the name alone rather than printing a dangling separator
   * for a host whose runner has not described itself yet.
   */
  get summary(): string {
    return this.os ? `${this.name} · ${this.os}` : this.name;
  }
}

/**
 * A pairing token as the list reports it — enough to answer "has this token
 * been spent, and on which machine". The secret is not here: it is shown once,
 * inside the command the mint returns.
 */
export interface HostPairingToken {
  id: string;
  expiresAt: Date;
  /** The host this token created, once a runner has redeemed it. */
  redeemedHostId: string | null;
}

/**
 * What Add host hands the person: a registration token, already baked into
 * both the command a human pastes into a terminal and the same instruction
 * phrased for a coding agent that is already running on the machine.
 */
export interface HostPairing {
  /** The pairing token's own id, for revoking it. */
  id: string;
  /** The pasted command, complete with the token. */
  installCommand: string;
  /** The same instruction, addressed to an agent. */
  agentPrompt: string;
  /**
   * SHA-256 of the installer the command downloads, for anyone who reads the
   * script before running it. `null` when the deployment published none.
   */
  installScriptSha256: string | null;
  /** When the token stops registering a host. */
  expiresAt: Date;
  /** The host this token created, once a runner has redeemed it. */
  redeemedHostId: string | null;
}
