/** Whether the host's runner is currently dialled in to the control plane. */
export type HostState = 'online' | 'offline' | 'pairing';

/**
 * A host as the console needs it: a machine the user owns that runs sessions
 * (`product/versions/mvp/00-scope.md`). A host is paired with one pasted
 * install command carrying a one-hour registration token, and appears here
 * once its runner connects.
 */
export class HostEntity {
  constructor(
    public readonly id: string,
    public readonly name: string,
    public readonly state: HostState,
    /** When the runner last reported in; `null` until it has connected once. */
    public readonly lastSeenAt: Date | null,
    public readonly createdAt: Date,
  ) {}

  /** Whether a session can be started on this host right now. */
  get isOnline(): boolean {
    return this.state === 'online';
  }
}

/**
 * What Add host hands the person: a one-hour registration token and the
 * command that installs the runner with it.
 */
export interface HostPairing {
  /** The pasted command, complete with the token. */
  installCommand: string;
  /** When the token stops registering a host. */
  expiresAt: Date;
}
