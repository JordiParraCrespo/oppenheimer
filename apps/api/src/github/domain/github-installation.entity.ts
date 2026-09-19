import { randomUUID } from 'node:crypto';
import {
  AggregateRoot,
  ArgumentNotProvidedException,
  type CreateEntityProps,
} from '@oppenheimer/backend-ddd';
import { InstallationConnectedDomainEvent } from './events/installation-connected.domain-event';

/** What the installation dialog granted: every repository, or a chosen set. */
export type RepositorySelection = 'all' | 'selected';

export interface GithubInstallationProps {
  /** Tenant the installation belongs to. Immutable — a claim never moves. */
  organizationId: string;
  /** GitHub's own installation id. Globally unique, which is what makes a
   *  second workspace's claim a conflict rather than a silent takeover. */
  githubInstallationId: number;
  /** The user or organization the App is installed on. */
  accountLogin: string;
  /** `User` or `Organization`, as GitHub reports it. */
  accountType: string;
  repositorySelection: RepositorySelection;
  /** The account that completed the installation redirect. */
  installedByUserId: string;
  /** Set while GitHub reports the installation suspended. */
  suspendedAt: Date | null;
  /** Set when the installation is uninstalled on GitHub or disconnected here. */
  deletedAt: Date | null;
}

export interface ConnectInstallationProps {
  organizationId: string;
  githubInstallationId: number;
  accountLogin: string;
  accountType: string;
  repositorySelection: RepositorySelection;
  installedByUserId: string;
}

/** What GitHub reports about an installation and we keep in step with it. */
export interface RefreshInstallationProps {
  accountLogin: string;
  accountType: string;
  repositorySelection: RepositorySelection;
  installedByUserId: string;
}

/**
 * A GitHub App installation, which is the whole of what a workspace may reach
 * on GitHub: the installation *is* the allowlist and GitHub enforces it, so
 * there is no repository table and nothing here mirrors one
 * (`product/09-github-app-install.md`).
 *
 * The aggregate's only job beyond staying valid is to know whether it can still
 * be exercised — `isUsable` is what the listing and the token mint ask, so
 * "suspended" and "uninstalled" are one question with one answer.
 */
export class GithubInstallationEntity extends AggregateRoot<GithubInstallationProps> {
  /** Rehydrate an existing installation (used by the mapper). */
  static create(create: CreateEntityProps<GithubInstallationProps>): GithubInstallationEntity {
    return new GithubInstallationEntity(create);
  }

  /** Claim an installation for a workspace, with a generated id. */
  static connect(props: ConnectInstallationProps): GithubInstallationEntity {
    const installation = new GithubInstallationEntity({
      id: randomUUID(),
      props: {
        organizationId: props.organizationId,
        githubInstallationId: props.githubInstallationId,
        accountLogin: props.accountLogin,
        accountType: props.accountType,
        repositorySelection: props.repositorySelection,
        installedByUserId: props.installedByUserId,
        suspendedAt: null,
        deletedAt: null,
      },
    });

    installation.raiseConnected();
    return installation;
  }

  get organizationId(): string {
    return this.props.organizationId;
  }

  get githubInstallationId(): number {
    return this.props.githubInstallationId;
  }

  get accountLogin(): string {
    return this.props.accountLogin;
  }

  get accountType(): string {
    return this.props.accountType;
  }

  get repositorySelection(): RepositorySelection {
    return this.props.repositorySelection;
  }

  get installedByUserId(): string {
    return this.props.installedByUserId;
  }

  get suspendedAt(): Date | null {
    return this.props.suspendedAt;
  }

  get deletedAt(): Date | null {
    return this.props.deletedAt;
  }

  /** Whether GitHub would still answer for this installation. */
  get isUsable(): boolean {
    return this.props.deletedAt === null && this.props.suspendedAt === null;
  }

  /**
   * Re-claim an installation this workspace had disconnected, or refresh what
   * GitHub now reports about a live one.
   *
   * Re-running the installation redirect is the only way back from a
   * disconnect, and it arrives with the same `githubInstallationId` — so the
   * row is revived rather than duplicated, which the unique column would refuse
   * anyway.
   */
  reconnect(props: RefreshInstallationProps): void {
    const wasDisconnected = this.props.deletedAt !== null;
    this.props.accountLogin = props.accountLogin;
    this.props.accountType = props.accountType;
    this.props.repositorySelection = props.repositorySelection;
    this.props.installedByUserId = props.installedByUserId;
    this.props.deletedAt = null;
    this.props.suspendedAt = null;
    this.setUpdatedAt(new Date());
    this.validate();
    if (wasDisconnected) this.raiseConnected();
  }

  /** The workspace gave the installation up. GitHub keeps its own copy. */
  disconnect(at: Date = new Date()): void {
    this.props.deletedAt = at;
    this.setUpdatedAt(new Date());
    this.validate();
  }

  /** `installation.suspend` — the App is installed but cannot be exercised. */
  suspend(at: Date = new Date()): void {
    this.props.suspendedAt = at;
    this.setUpdatedAt(new Date());
    this.validate();
  }

  /** `installation.unsuspend`. */
  unsuspend(): void {
    this.props.suspendedAt = null;
    this.setUpdatedAt(new Date());
    this.validate();
  }

  /** `installation.deleted` — uninstalled on GitHub, by someone who is not us. */
  markUninstalled(at: Date = new Date()): void {
    this.props.deletedAt = at;
    this.setUpdatedAt(new Date());
    this.validate();
  }

  public validate(): void {
    if (!this.props.organizationId?.trim()) {
      throw new ArgumentNotProvidedException('An installation must belong to an organization');
    }
    if (
      !Number.isInteger(this.props.githubInstallationId) ||
      this.props.githubInstallationId <= 0
    ) {
      throw new ArgumentNotProvidedException('A GitHub installation id must be a positive integer');
    }
    if (!this.props.accountLogin?.trim()) {
      throw new ArgumentNotProvidedException('An installation must name the account it is on');
    }
    if (!this.props.installedByUserId?.trim()) {
      throw new ArgumentNotProvidedException('An installation must record who connected it');
    }
  }

  private raiseConnected(): void {
    this.addEvent(
      new InstallationConnectedDomainEvent({
        aggregateId: this.id,
        organizationId: this.organizationId,
        githubInstallationId: this.githubInstallationId,
        accountLogin: this.accountLogin,
        reason:
          'A workspace claimed a GitHub App installation; listeners react to new repository access',
      }),
    );
  }
}
