import { DomainEvent, type DomainEventProps } from '@oppenheimer/backend-ddd';

/**
 * Raised when a workspace claims a GitHub App installation.
 *
 * Carries the tenant and GitHub's own installation id so a listener can act
 * without re-reading the row — and, importantly, without needing an access
 * scope of its own to do it.
 */
export class InstallationConnectedDomainEvent extends DomainEvent {
  readonly organizationId: string;
  readonly githubInstallationId: number;
  readonly accountLogin: string;

  constructor(props: DomainEventProps<InstallationConnectedDomainEvent>) {
    super(props);
    this.organizationId = props.organizationId;
    this.githubInstallationId = props.githubInstallationId;
    this.accountLogin = props.accountLogin;
  }
}
