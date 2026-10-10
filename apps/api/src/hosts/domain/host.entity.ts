import {
  AggregateRoot,
  ArgumentInvalidException,
  ArgumentNotProvidedException,
  type CreateEntityProps,
} from '@oppenheimer/backend-ddd';
import { HOST_MAX_SESSIONS_CEILING, type HostFactsDto } from '@oppenheimer/shared';
import { HostRegisteredDomainEvent } from './events/host-registered.domain-event';
import { HostRenamedDomainEvent } from './events/host-renamed.domain-event';
import { HostUnpairedDomainEvent } from './events/host-unpaired.domain-event';
import { derivedSessionLimit, hostSizeOf } from './host-session-limit.policy';

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
  /**
   * Last heartbeat, read from `host_presence`. `online` is derived from it,
   * never stored, and nothing on this aggregate writes it: a heartbeat is
   * presence, not a change to the host (`product/versions/mvp/15-host-metadata.md`).
   */
  lastSeenAt: Date | null;
  /** Set when the host is unpaired, from either end. The row is kept. */
  unpairedAt: Date | null;
  /**
   * How many sessions may have their agent up here at once, as its owner set
   * it; `null` is the default derived from the machine (`sessionLimit`).
   */
  maxSessions: number | null;
}

export interface RegisterHostProps {
  /** The id the redemption statement recorded (see `RedeemedPairingToken.redeemedHostId`). */
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

/**
 * `<platform> <osVersion>` when the runner knew the version — `macos 15.2` —
 * the platform alone otherwise. On Linux the runner reports the distribution's
 * own name as the version ("Ubuntu 24.04.4 LTS"), which already says the
 * platform, so it stands alone rather than read "ubuntu Ubuntu 24.04.4 LTS".
 */
export function platformLabelOf(platform: string, osVersion: string | null | undefined): string {
  if (!osVersion) return platform;
  return osVersion.toLowerCase().startsWith(platform.toLowerCase())
    ? osVersion
    : `${platform} ${osVersion}`;
}

export function hostPlatformOf(facts: HostFactsDto): string {
  return platformLabelOf(facts.platform, facts.osVersion);
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
        maxSessions: null,
      },
    });

    host.addEvent(
      new HostRegisteredDomainEvent({
        aggregateId: host.id,
        ownerUserId: host.ownerUserId,
        publicKeyFingerprint: host.publicKeyFingerprint,
        pairingTokenId: props.pairingTokenId,
        name: host.name,
        hostname: host.hostname,
        os: host.os,
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

  get maxSessions(): number | null {
    return this.props.maxSessions;
  }

  /**
   * How many sessions may run here at once: what the owner set, else what the
   * machine's size gives, else no limit for a host that has not described itself.
   */
  get sessionLimit(): number | null {
    return this.props.maxSessions ?? derivedSessionLimit(hostSizeOf(this.props.capabilities));
  }

  get isUnpaired(): boolean {
    return this.props.unpairedAt !== null;
  }

  hasFingerprint(fingerprint: string): boolean {
    return this.props.publicKeyFingerprint === fingerprint;
  }

  rename(name: string): void {
    const from = this.props.name;
    if (from === name) return;
    this.props.name = name;
    this.setUpdatedAt(new Date());
    this.validate();
    this.addEvent(
      new HostRenamedDomainEvent({
        aggregateId: this.id,
        ownerUserId: this.props.ownerUserId,
        from,
        to: name,
        reason: 'A person renamed the host; its timeline records it',
      }),
    );
  }

  /** `null` goes back to the derived default. */
  limitSessions(maxSessions: number | null): void {
    if (this.props.maxSessions === maxSessions) return;
    this.props.maxSessions = maxSessions;
    this.setUpdatedAt(new Date());
    this.validate();
  }

  /**
   * Idempotent, because both ends can do it and neither knows whether the other
   * already did: the console unpairs a machine it no longer trusts, and the
   * machine itself says so when the runner is uninstalled.
   */
  unpair(at: Date = new Date()): void {
    if (this.props.unpairedAt) return;
    this.props.unpairedAt = at;
    this.setUpdatedAt(at);
    this.validate();
    this.addEvent(
      new HostUnpairedDomainEvent({
        aggregateId: this.id,
        ownerUserId: this.ownerUserId,
        reason: 'The machine is no longer a host; a link it holds must close',
      }),
    );
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
    const max = this.props.maxSessions;
    if (max !== null && (!Number.isInteger(max) || max < 1 || max > HOST_MAX_SESSIONS_CEILING)) {
      throw new ArgumentInvalidException(
        `A host session limit is a whole number from 1 to ${HOST_MAX_SESSIONS_CEILING}`,
      );
    }
    if (!FINGERPRINT.test(this.props.publicKeyFingerprint)) {
      throw new ArgumentInvalidException(
        'A host key fingerprint is the SHA-256 of the raw key, as 64 hex characters',
      );
    }
  }
}
