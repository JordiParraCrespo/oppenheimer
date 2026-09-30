import { Module } from '@nestjs/common';
import { GithubModule } from '../github/github.module';
import { HostsModule } from '../hosts/hosts.module';
import { LinksModule } from '../links/links.module';
import { OrganizationsModule } from '../organizations/organizations.module';
import { SessionsModule } from '../sessions/sessions.module';
import { HostUnpairedDomainEventHandler } from './application/event-handlers/host-unpaired.domain-event-handler';
import { BrowserAttachGateway } from './infrastructure/browser-attach.gateway';
import { CredentialsProcessor } from './infrastructure/credentials.processor';
import { RelayEventsProcessor } from './infrastructure/relay-events.processor';
import { RelayUpgradeGateway } from './infrastructure/relay-upgrade.gateway';
import { RunnerLinkGateway } from './infrastructure/runner-link.gateway';

/**
 * Relay: the two sockets of `product/versions/mvp/01-protocol.md`.
 * `GET /api/v1/relay/runner` is the multiplexed link a runner dials with its boot
 * assertion; `GET /api/v1/relay/attach` the unmultiplexed socket a browser opens with
 * an attach ticket. `links/` sits between them as the registry of reachable hosts,
 * which `sessions/` dispatches through, so this module imports `sessions/` and never
 * the reverse. It sees other modules only through their published ports, never
 * their tables.
 */
@Module({
  imports: [LinksModule, SessionsModule, HostsModule, GithubModule, OrganizationsModule],
  providers: [
    RelayEventsProcessor,
    CredentialsProcessor,
    RunnerLinkGateway,
    BrowserAttachGateway,
    RelayUpgradeGateway,
    HostUnpairedDomainEventHandler,
  ],
})
export class RelayModule {}
