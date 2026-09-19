import { Global, Module, type Provider } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthzModule as AuthzKernelModule } from '@oppenheimer/backend-authz';
import { HostAccessResolver } from './application/host-access.resolver';
import { HostAssertionResolver } from './application/host-assertion.resolver';
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
import { HostPairingTokenOrmEntity } from './database/host-pairing-token.orm-entity';
import { HostPairingTokenRepository } from './database/host-pairing-token.repository';
import { HostPrincipalGuard } from './guards/host-principal.guard';
import { HostMapper } from './host.mapper';
import { HostPairingTokenMapper } from './host-pairing-token.mapper';
import {
  HOST_ACCESS,
  HOST_ASSERTION,
  HOST_PAIRING_TOKEN_REPOSITORY,
  HOST_REPOSITORY,
} from './hosts.di-tokens';
import { HostResource } from './hosts.resource';
import { RunnerReleaseConfig } from './infrastructure/runner-release.config';
import { FindHostHttpController } from './queries/find-host/find-host.http.controller';
import { FindHostQueryHandler } from './queries/find-host/find-host.query-handler';
import { FindHostsHttpController } from './queries/find-hosts/find-hosts.http.controller';
import { FindHostsQueryHandler } from './queries/find-hosts/find-hosts.query-handler';
import { FindPairingTokenQueryHandler } from './queries/find-pairing-token/find-pairing-token.query-handler';
import { FindPairingTokensHttpController } from './queries/find-pairing-tokens/find-pairing-tokens.http.controller';
import { FindPairingTokensQueryHandler } from './queries/find-pairing-tokens/find-pairing-tokens.query-handler';

/**
 * Registration order matters: every static path has to be registered before
 * `:id`, or `GET /hosts/pairing` is answered by the host detail route with
 * "pairing" as an id, and `DELETE /hosts/self` by unpair.
 */
const httpControllers = [
  FindHostsHttpController,
  FindPairingTokensHttpController,
  MintPairingTokenHttpController,
  RevokePairingTokenHttpController,
  RegisterHostHttpController,
  UninstallHostHttpController,
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
];

/**
 * The machines a person has paired, how they prove they are one of them, and
 * what each last reported about itself.
 *
 * Marked `@Global` for the same reason `ApiTokensModule` is: the credential
 * resolver behind the globally registered `ScopesGuard` asks this module to
 * recognise a host's boot assertion, and that guard is instantiated outside any
 * feature module's injector.
 *
 * Only `HostResource` is contributed to the authorization kernel. The pairing
 * token's declaration exists to scope its rows and is deliberately not
 * registered — see `host-pairing-token.resource.ts`.
 */
@Global()
@Module({
  imports: [
    CqrsModule,
    TypeOrmModule.forFeature([HostOrmEntity, HostPairingTokenOrmEntity]),
    AuthzKernelModule.forFeature([HostResource]),
  ],
  controllers: [...httpControllers],
  providers: [
    ...commandHandlers,
    ...queryHandlers,
    ...mappers,
    ...repositories,
    ...resolvers,
    RunnerReleaseConfig,
    HostPrincipalGuard,
  ],
  // The two application ports are the module's published surface: the auth layer
  // needs the first to classify a bearer, and whatever runs work on a host needs
  // the second to check the caller may.
  exports: [HOST_ASSERTION, HOST_ACCESS, HOST_REPOSITORY, TypeOrmModule],
})
export class HostsModule {}
