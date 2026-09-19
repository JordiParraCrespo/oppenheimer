import { randomUUID } from 'node:crypto';
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
  /** The key being retired, still accepted until its window closes. */
  previousPublicKey: string | null;
  previousPublicKeyFingerprint: string | null;
  previousPublicKeyExpiresAt: Date | null;
  /** Last heartbeat. `online` is derived from it, never stored. */
  lastSeenAt: Date | null;
  /** Set when the host is unpaired, from either end. The row is kept. */
  unpairedAt: Date | null;
}

export interface RegisterHostProps {
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
const FINGERPRINT = /^[0-9a-f]{64}$/;

/**
 * A machine someone paired with this control plane.
 *
 * The key pair is **two columns on this row, not a child table**: rotation
 * needs the old key to stay valid for a grace window, which is two keys and
 * never N, and every runner boot verifies an assertion against this row — so a
 * join here would sit on the hottest path in the system
 * (`product/versions/mvp/09-runner-install-and-update.md` §3). A host must
 * never be left with zero valid keys, which is why the pair lives on the
 * aggregate that can enforce it.
 */
export class HostEntity extends AggregateRoot<HostProps> {
  /** Rehydrate an existing host (used by the mapper). */
  static create(create: CreateEntityProps<HostProps>): HostEntity {
    return new HostEntity(create);
  }

  /** A machine that has just redeemed a pairing token. */
  static register(props: RegisterHostProps): HostEntity {
    const host = new HostEntity({
      id: randomUUID(),
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
        previousPublicKey: null,
        previousPublicKeyFingerprint: null,
        previousPublicKeyExpiresAt: null,
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

  get previousPublicKey(): string | null {
    return this.props.previousPublicKey;
  }

  get previousPublicKeyFingerprint(): string | null {
    return this.props.previousPublicKeyFingerprint;
  }

  get previousPublicKeyExpiresAt(): Date | null {
    return this.props.previousPublicKeyExpiresAt;
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

  /**
   * The keys that may sign for this host at `now`: the current one always, and
   * the retired one only while its window is open.
   *
   * Asking the aggregate rather than reading two columns at the call site is
   * what keeps "a host is never left with zero valid keys" a property of the
   * host instead of a rule each verifier remembers.
   */
  keysValidAt(now: Date): string[] {
    const keys = [this.props.publicKey];
    const previous = this.props.previousPublicKey;
    const expiresAt = this.props.previousPublicKeyExpiresAt;
    if (previous && expiresAt && expiresAt.getTime() > now.getTime()) keys.push(previous);
    return keys;
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
    // Losing the retired key while its window is still open would leave a
    // running runner unable to authenticate at its next boot.
    if (this.props.previousPublicKey && !this.props.previousPublicKeyExpiresAt) {
      throw new ArgumentInvalidException('A retired host key must carry the end of its window');
    }
  }
}
