import { BullModule } from '@nestjs/bullmq';
import { Module, type Provider, type Type } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthzModule as AuthzKernelModule } from '@oppenheimer/backend-authz';
import { QUEUE_NAMES } from '@oppenheimer/shared';
import { AuthModule } from '../auth/auth.module';
import { LinksModule } from '../links/links.module';
import { UsersModule } from '../users/user.module';
import { HostRegisteredDomainEventHandler } from './application/event-handlers/host-registered.domain-event-handler';
import { HostAccessResolver } from './application/host-access.resolver';
import { HostAssertionResolver } from './application/host-assertion.resolver';
import { HostCredentialResolver } from './application/host-credential.resolver';
import { HostKeyResolver } from './application/host-key.resolver';
import { HostPresenceResolver } from './application/host-presence.resolver';
import type { HostUsagePort } from './application/host-usage.port';
import { HostUsageRegistry } from './application/host-usage.registry';
import { CollectSessionImageCommandHandler } from './commands/collect-session-image/collect-session-image.command-handler';
import { CollectSessionImageHttpController } from './commands/collect-session-image/collect-session-image.http.controller';
import { MintPairingTokenCommandHandler } from './commands/mint-pairing-token/mint-pairing-token.command-handler';
import { MintPairingTokenHttpController } from './commands/mint-pairing-token/mint-pairing-token.http.controller';
import { RegisterHostCommandHandler } from './commands/register-host/register-host.command-handler';
import { RegisterHostHttpController } from './commands/register-host/register-host.http.controller';
import { RenameHostCommandHandler } from './commands/rename-host/rename-host.command-handler';
import { RenameHostHttpController } from './commands/rename-host/rename-host.http.controller';
import { RevokePairingTokenCommandHandler } from './commands/revoke-pairing-token/revoke-pairing-token.command-handler';
import { RevokePairingTokenHttpController } from './commands/revoke-pairing-token/revoke-pairing-token.http.controller';
import { UninstallHostCommandHandler } from './commands/uninstall-host/uninstall-host.command-handler';
import { UninstallHostHttpController } from './commands/uninstall-host/uninstall-host.http.controller';
import { UnpairHostCommandHandler } from './commands/unpair-host/unpair-host.command-handler';
import { UnpairHostHttpController } from './commands/unpair-host/unpair-host.http.controller';
import { HostOrmEntity } from './database/host.orm-entity';
import { HostRepository } from './database/host.repository';
import { HostEventOrmEntity } from './database/host-event.orm-entity';
import { HostInventoryOrmEntity } from './database/host-inventory.orm-entity';
import { HostNetworkOrmEntity } from './database/host-network.orm-entity';
import { HostPairingTokenOrmEntity } from './database/host-pairing-token.orm-entity';
import { HostPairingTokenRepository } from './database/host-pairing-token.repository';
import { HostPresenceOrmEntity } from './database/host-presence.orm-entity';
import { HostPrincipalGuard } from './guards/host-principal.guard';
import { HostMapper } from './host.mapper';
import { HostPairingTokenMapper } from './host-pairing-token.mapper';
import {
  HOST_ACCESS,
  HOST_ASSERTION,
  HOST_KEY,
  HOST_PAIRING_TOKEN_REPOSITORY,
  HOST_PRESENCE,
  HOST_REPOSITORY,
} from './hosts.di-tokens';
import { HostResource } from './hosts.resource';
import { RunnerReleaseConfig } from './infrastructure/runner-release.config';
import { FindHostHttpController } from './queries/find-host/find-host.http.controller';
import { FindHostQueryHandler } from './queries/find-host/find-host.query-handler';
import { FindHostsHttpController } from './queries/find-hosts/find-hosts.http.controller';
import { FindHostsQueryHandler } from './queries/find-hosts/find-hosts.query-handler';
import { FindPairingTokenHttpController } from './queries/find-pairing-token/find-pairing-token.http.controller';
import { FindPairingTokenQueryHandler } from './queries/find-pairing-token/find-pairing-token.query-handler';
import { FindPairingTokensHttpController } from './queries/find-pairing-tokens/find-pairing-tokens.http.controller';
import { FindPairingTokensQueryHandler } from './queries/find-pairing-tokens/find-pairing-tokens.query-handler';

/**
 * Registration order matters: every static path has to be registered before
 * `:id`, or `GET /hosts/pairing` is answered by the host detail route with
 * "pairing" as an id, and `DELETE /hosts/self` by the console's unpair.
 */
const httpControllers = [
  FindHostsHttpController,
  FindPairingTokensHttpController,
  FindPairingTokenHttpController,
  MintPairingTokenHttpController,
  RevokePairingTokenHttpController,
  RegisterHostHttpController,
  UninstallHostHttpController,
  CollectSessionImageHttpController,
  FindHostHttpController,
  RenameHostHttpController,
  UnpairHostHttpController,
];

const commandHandlers: Provider[] = [
  MintPairingTokenCommandHandler,
  RevokePairingTokenCommandHandler,
  RegisterHostCommandHandler,
  RenameHostCommandHandler,
  UnpairHostCommandHandler,
  UninstallHostCommandHandler,
  CollectSessionImageCommandHandler,
];

const queryHandlers: Provider[] = [
  FindHostsQueryHandler,
  FindHostQueryHandler,
  FindPairingTokensQueryHandler,
  FindPairingTokenQueryHandler,
];

const mappers: Provider[] = [HostMapper, HostPairingTokenMapper];

const repositories: Provider[] = [
  { provide: HOST_REPOSITORY, useClass: HostRepository },
  { provide: HOST_PAIRING_TOKEN_REPOSITORY, useClass: HostPairingTokenRepository },
];

const resolvers: Provider[] = [
  { provide: HOST_ASSERTION, useClass: HostAssertionResolver },
  { provide: HOST_ACCESS, useClass: HostAccessResolver },
  { provide: HOST_PRESENCE, useClass: HostPresenceResolver },
  { provide: HOST_KEY, useClass: HostKeyResolver },
];

/**
 * The machines a person has paired, how they prove they are one of them, and
 * what each last reported about itself.
 *
 * A host's boot assertion is a credential kind this module **contributes** to
 * the auth kernel: `HostCredentialResolver` goes in the providers below, so it
 * is constructed in this module's own injector and injects this module's
 * `HOST_ASSERTION` port. That is why nothing here is `@Global` — the kernel
 * reaches only its own registry, and recognising a machine costs this module no
 * application-wide publication.
 *
 * Only `HostResource` is contributed to the authorization kernel. The pairing
 * token's declaration exists to scope its rows and is deliberately not
 * registered — see `host-pairing-token.resource.ts`.
 */
@Module({
  imports: [
    CqrsModule,
    // The parked images a runner collects (`GET /hosts/self/images/{id}`).
    LinksModule,
    TypeOrmModule.forFeature([
      HostOrmEntity,
      HostPairingTokenOrmEntity,
      HostInventoryOrmEntity,
      HostPresenceOrmEntity,
      HostNetworkOrmEntity,
      HostEventOrmEntity,
    ]),
    AuthzKernelModule.forFeature([HostResource]),
    // The owner's address for the new-host notice, and the queue it goes out on.
    UsersModule,
    BullModule.registerQueue({ name: QUEUE_NAMES.EMAIL }),
  ],
  controllers: [...httpControllers],
  providers: [
    ...commandHandlers,
    ...queryHandlers,
    ...mappers,
    ...repositories,
    ...resolvers,
    ...AuthModule.contributeCredentials([HostCredentialResolver]),
    RunnerReleaseConfig,
    HostUsageRegistry,
    HostPrincipalGuard,
    HostRegisteredDomainEventHandler,
  ],
  // The two application ports, and nothing else. A consumer that could inject
  // the repository could skip `assertUsable` and read unpaired rows unscoped,
  // which is exactly the check the port exists to make unavoidable.
  //
  // `HostUsageRegistry` is the other half of that surface: what runs on a host
  // is contributed into it by the module that owns the work.
  exports: [HOST_ASSERTION, HOST_ACCESS, HOST_PRESENCE, HOST_KEY, HostUsageRegistry],
})
export class HostsModule {
  /**
   * The providers a module adds to say what is running on a host:
   *
   * ```ts
   * providers: [...HostsModule.contributeUsage([SessionHostUsage])]
   * ```
   *
   * The same shape as `ProjectsModule.contributeUsage`, for the same reason: the
   * implementation is constructed in the injector of the module that owns the
   * work, so it injects that module's own repository without anything being
   * published application-wide, and a module that is never imported contributes
   * nothing.
   */
  static contributeUsage(usages: Type<HostUsagePort>[]): Provider[] {
    return [
      ...usages,
      {
        provide: Symbol('HOST_USAGE_CONTRIBUTION'),
        inject: [HostUsageRegistry, ...usages],
        useFactory: (registry: HostUsageRegistry, ...contributed: HostUsagePort[]) => {
          registry.registerAll(contributed);
          return contributed;
        },
      },
    ];
  }
}
