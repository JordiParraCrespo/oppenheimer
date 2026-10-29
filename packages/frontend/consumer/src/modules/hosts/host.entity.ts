import type { HostCloudAgentId } from '@oppenheimer/shared/agents';

/**
 * One word for the row, derived by the API on every read: `running` (online,
 * a session up), `idle`, `offline`, `unpaired`.
 */
export type HostStatus = 'running' | 'idle' | 'offline' | 'unpaired';

/**
 * What a host row says beyond identity (`product/versions/mvp/15-host-metadata.md`):
 * its status and running sessions, what the machine is, where it connects
 * from and how the link is doing. Every fact the runner has not reported is
 * `null`, never a placeholder.
 */
export interface HostDetails {
  status: HostStatus;
  runningSessionCount: number;
  osName: string | null;
  cpuCount: number | null;
  memoryTotalBytes: number | null;
  cloudProvider: string | null;
  countryCode: string | null;
  city: string | null;
  asnOrg: string | null;
  roundTripMillis: number | null;
  /**
   * Whether the host can start a cloud session of each agent now — Claude
   * Code's, Codex's: online, its runner takes them, and the agent's CLI is
   * installed. `null` when the API could not tell (online, its link held
   * elsewhere): worth trying, not promised.
   */
  startsCloud: Record<HostCloudAgentId, boolean | null>;
  /**
   * The claude.ai account (email) the host's `claude` is signed in as: the
   * one a Claude Code cloud session started there runs on. `null` when it is
   * not signed in, or the runner does not say.
   */
  claudeAccount: string | null;
}

const NO_DETAILS: HostDetails = {
  status: 'offline',
  runningSessionCount: 0,
  osName: null,
  cpuCount: null,
  memoryTotalBytes: null,
  cloudProvider: null,
  countryCode: null,
  city: null,
  asnOrg: null,
  roundTripMillis: null,
  startsCloud: { 'claude-code': false, codex: false },
  claudeAccount: null,
};

/**
 * A host as the console needs it: a machine the user owns that runs sessions
 * (`product/versions/mvp/00-scope.md`), which appears once its runner connects.
 *
 * `online` is a boolean because the API reports it so. The design note's
 * `pairing` state has no wire form: a host does not exist until its runner has
 * registered.
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
    public readonly details: HostDetails = NO_DETAILS,
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
 * phrased for a coding agent that is already running on the machine. The
 * secret is shown once and only the server knows it, so no surface assembles
 * either string.
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
  redeemedHostId: string | null;
}

/** One sub-directory of a listed folder: its name, its path, and its branch when it is a repository. */
export interface HostFolderEntry {
  name: string;
  /** Absolute, on the host. */
  path: string;
  branch: string | null;
}

/**
 * One directory of a host, listed by its runner now (`GET /hosts/{id}/folders`,
 * `product/versions/mvp/24-session-places.md` §4): folder names only, never
 * files, and nothing cached by the API.
 */
export interface HostFolders {
  /** The directory listed, absolute and cleaned. */
  path: string;
  /** Null at the root. */
  parent: string | null;
  /** The runner's home directory, so a path under it can be shown as `~/…`. */
  home: string;
  /** The listed directory's own branch, when it is a repository. */
  branch: string | null;
  entries: HostFolderEntry[];
  /** More directories were there than `entries` carries. */
  truncated: boolean;
  /** The caller's own earlier folder sessions on this host, newest first. */
  recent: { path: string; lastUsedAt: Date }[];
}
