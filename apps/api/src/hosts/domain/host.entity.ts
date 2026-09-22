import {
  AggregateRoot,
  ArgumentInvalidException,
  ArgumentNotProvidedException,
  type CreateEntityProps,
} from '@oppenheimer/backend-ddd';
import { HostRegisteredDomainEvent } from './events/host-registered.domain-event';

/** Whatever the runner last reported about the machine, stored as it arrived. */
export type HostCapabilities = Record<string, unknown>;

export interface HostProps {
  /** The person who paired it. A host never changes owner. */
  ownerUserId: string;
  name: string;
  hostname: string | null;
  os: string | null;
  arch: string | null;
  runnerVersion: string | null;
  /**
   * The inventory the runner sent: tools and their versions, the agents it
   * found, free disk. A hint for the console, never a gate — a session opens on
   * a machine with no `claude` and the install command appears in the terminal.
   */
  capabilities: HostCapabilities | null;
  /** Base64 of the raw Ed25519 public key, as the runner encodes it. */
  publicKey: string;
  /** SHA-256 of the raw public key, hex — the form shown beside a host. */
  publicKeyFingerprint: string;
  /** Last heartbeat. `online` is derived from it, never stored. */
  lastSeenAt: Date | null;
  /** Set when the host is unpaired, from either end. The row is kept. */
  unpairedAt: Date | null;
}

export interface RegisterHostProps {
  /**
   * The id the redemption statement recorded for this host. It is minted by the
   * repository because the statement that claims the token writes it, and the
   * row this aggregate becomes has to be the row that statement named.
   */
  id: string;
  ownerUserId: string;
  name: string;
  publicKey: string;
  publicKeyFingerprint: string;
  hostname?: string | null;
  os?: string | null;
  arch?: string | null;
  runnerVersion?: string | null;
  capabilities?: HostCapabilities | null;
  /** The token this host was paired with, recorded on the event. */
  pairingTokenId: string;
}

/** A 64-character lowercase hex digest — SHA-256 of the raw key. */
/** What a link report says about the machine, already reduced to columns. */
export interface HostReport {
  facts?: {
    hostname?: string | null;
    os?: string | null;
    arch?: string | null;
    runnerVersion?: string | null;
    capabilities?: HostCapabilities | null;
  } | null;
}

const FINGERPRINT = /^[0-9a-f]{64}$/;

/**
 * A machine someone paired with this control plane.
 *
 * Its key is **a column on this row, not a child table**: every runner boot
 * verifies an assertion against this row, so a join would sit on the hottest
 * path in the system, and when rotation arrives on the link
 * (`product/versions/mvp/09-runner-install-and-update.md` §3) the retired key
 * is one more column beside it — two keys, never N.
 */
export class HostEntity extends AggregateRoot<HostProps> {
  /** Rehydrate an existing host (used by the mapper). */
  static create(create: CreateEntityProps<HostProps>): HostEntity {
    return new HostEntity(create);
  }

  /** A machine that has just redeemed a pairing token. */
  static register(props: RegisterHostProps): HostEntity {
    const host = new HostEntity({
      id: props.id,
      props: {
        ownerUserId: props.ownerUserId,
        name: props.name,
        hostname: props.hostname ?? null,
        os: props.os ?? null,
        arch: props.arch ?? null,
        runnerVersion: props.runnerVersion ?? null,
        capabilities: props.capabilities ?? null,
        publicKey: props.publicKey,
        publicKeyFingerprint: props.publicKeyFingerprint,
        lastSeenAt: null,
        unpairedAt: null,
      },
    });

    host.addEvent(
      new HostRegisteredDomainEvent({
        aggregateId: host.id,
        ownerUserId: host.ownerUserId,
        publicKeyFingerprint: host.publicKeyFingerprint,
        pairingTokenId: props.pairingTokenId,
        reason: 'A machine finished pairing and can now be given work',
      }),
    );

    return host;
  }

  get ownerUserId(): string {
    return this.props.ownerUserId;
  }

  get name(): string {
    return this.props.name;
  }

  get hostname(): string | null {
    return this.props.hostname;
  }

  get os(): string | null {
    return this.props.os;
  }

  get arch(): string | null {
    return this.props.arch;
  }

  get runnerVersion(): string | null {
    return this.props.runnerVersion;
  }

  get capabilities(): HostCapabilities | null {
    return this.props.capabilities;
  }

  get publicKey(): string {
    return this.props.publicKey;
  }

  get publicKeyFingerprint(): string {
    return this.props.publicKeyFingerprint;
  }

  get lastSeenAt(): Date | null {
    return this.props.lastSeenAt;
  }

  get unpairedAt(): Date | null {
    return this.props.unpairedAt;
  }

  get isUnpaired(): boolean {
    return this.props.unpairedAt !== null;
  }

  /** Is this the machine we already paired under that key? */
  hasFingerprint(fingerprint: string): boolean {
    return this.props.publicKeyFingerprint === fingerprint;
  }

  /** Display-only: nothing on disk is derived from a host's name. */
  rename(name: string): void {
    this.props.name = name;
    this.setUpdatedAt(new Date());
    this.validate();
  }

  /**
   * Retire the host. Idempotent, because both ends can do it and neither knows
   * whether the other already did: the console unpairs a machine it no longer
   * trusts, and the machine itself says so when the runner is uninstalled.
   * The row is kept either way.
   */
  /**
   * The runner reported in: on hello and on every heartbeat. `online` is derived
   * from `lastSeenAt` by the repository's read, so this is the only writer of
   * the fact the sidebar dot reads. The facts are kept whole on `capabilities`,
   * as registration does, and the columns worth their own name follow them.
   */
  observe(report: HostReport, at: Date = new Date()): void {
    if (report.facts) {
      this.props.hostname = report.facts.hostname ?? this.props.hostname;
      this.props.os = report.facts.os ?? this.props.os;
      this.props.arch = report.facts.arch ?? this.props.arch;
      this.props.runnerVersion = report.facts.runnerVersion ?? this.props.runnerVersion;
      this.props.capabilities = report.facts.capabilities ?? this.props.capabilities;
    }
    this.props.lastSeenAt = at;
    this.setUpdatedAt(at);
    this.validate();
  }

  unpair(at: Date = new Date()): void {
    if (this.props.unpairedAt) return;
    this.props.unpairedAt = at;
    this.setUpdatedAt(at);
    this.validate();
  }

  public validate(): void {
    if (!this.props.ownerUserId?.trim()) {
      throw new ArgumentNotProvidedException('A host must have an owner');
    }
    if (!this.props.name?.trim()) {
      throw new ArgumentNotProvidedException('A host name cannot be empty');
    }
    if (!this.props.publicKey?.trim()) {
      throw new ArgumentNotProvidedException('A host must have a public key');
    }
    if (!FINGERPRINT.test(this.props.publicKeyFingerprint)) {
      throw new ArgumentInvalidException(
        'A host key fingerprint is the SHA-256 of the raw key, as 64 hex characters',
      );
    }
  }
}
