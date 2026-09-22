import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HostsModule } from '../hosts/hosts.module';
import { LinksModule } from '../links/links.module';
import { MemberOrmEntity } from '../organizations/database/member.orm-entity';
import { SessionsModule } from '../sessions/sessions.module';
import { BrowserAttachGateway } from './infrastructure/browser-attach.gateway';
import { RelayEventsProcessor } from './infrastructure/relay-events.processor';
import { RelayUpgradeGateway } from './infrastructure/relay-upgrade.gateway';
import { RunnerLinkGateway } from './infrastructure/runner-link.gateway';

/**
 * Relay: the two sockets of `product/versions/mvp/01-protocol.md`.
 *
 * `GET /api/v1/relay/runner` is the multiplexed link a runner dials, authenticated
 * by its boot assertion; `GET /api/v1/relay/attach` is the unmultiplexed socket a
 * browser opens with an attach ticket. Between them sits `links/`, the registry
 * that says which host is reachable, which is also what `sessions/` dispatches
 * through — so this module imports `sessions/` for the door that records what a
 * runner reports, and never the other way round.
 */
@Module({
  imports: [TypeOrmModule.forFeature([MemberOrmEntity]), LinksModule, SessionsModule, HostsModule],
  providers: [RelayEventsProcessor, RunnerLinkGateway, BrowserAttachGateway, RelayUpgradeGateway],
})
export class RelayModule {}
