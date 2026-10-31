import { Module, type Provider } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthzModule as AuthzKernelModule } from '../authz/authz.module';
import { CloudAgentResolver } from './application/cloud-agent.resolver';
import { CloudAgentProviderRegistry } from './application/cloud-agent-provider.registry';
import { CloudRunsResolver } from './application/cloud-runs.resolver';
import { CursorCloudAgentResolver } from './application/cursor-cloud-agent.resolver';
import { CloudAgentCredentialMapper } from './cloud-agent-credential.mapper';
import {
  CLOUD_AGENT_CREDENTIAL_REPOSITORY,
  CLOUD_RUNS,
  CURSOR_CLOUD_AGENTS,
  KEY_SEALER,
} from './cloud-agents.di-tokens';
import { CloudAgentResource } from './cloud-agents.resource';
import { PutCloudAgentCredentialCommandHandler } from './commands/put-cloud-agent-credential/put-cloud-agent-credential.command-handler';
import { PutCloudAgentCredentialHttpController } from './commands/put-cloud-agent-credential/put-cloud-agent-credential.http.controller';
import { RemoveCloudAgentCredentialCommandHandler } from './commands/remove-cloud-agent-credential/remove-cloud-agent-credential.command-handler';
import { RemoveCloudAgentCredentialHttpController } from './commands/remove-cloud-agent-credential/remove-cloud-agent-credential.http.controller';
import { CloudAgentCredentialOrmEntity } from './database/cloud-agent-credential.orm-entity';
import { CloudAgentCredentialRepository } from './database/cloud-agent-credential.repository';
import { AesKeySealerAdapter } from './infrastructure/aes-key-sealer.adapter';
import { CursorCloudAgentsGateway } from './infrastructure/cursor-cloud-agents.gateway';
import { FindCloudAgentModelsHttpController } from './queries/find-cloud-agent-models/find-cloud-agent-models.http.controller';
import { FindCloudAgentModelsQueryHandler } from './queries/find-cloud-agent-models/find-cloud-agent-models.query-handler';
import { FindCloudAgentRepositoriesHttpController } from './queries/find-cloud-agent-repositories/find-cloud-agent-repositories.http.controller';
import { FindCloudAgentRepositoriesQueryHandler } from './queries/find-cloud-agent-repositories/find-cloud-agent-repositories.query-handler';
import { FindCloudAgentStatusHttpController } from './queries/find-cloud-agent-status/find-cloud-agent-status.http.controller';
import { FindCloudAgentStatusQueryHandler } from './queries/find-cloud-agent-status/find-cloud-agent-status.query-handler';

const httpControllers = [
  FindCloudAgentStatusHttpController,
  PutCloudAgentCredentialHttpController,
  RemoveCloudAgentCredentialHttpController,
  FindCloudAgentModelsHttpController,
  FindCloudAgentRepositoriesHttpController,
];

const commandHandlers: Provider[] = [
  PutCloudAgentCredentialCommandHandler,
  RemoveCloudAgentCredentialCommandHandler,
];

const queryHandlers: Provider[] = [
  FindCloudAgentStatusQueryHandler,
  FindCloudAgentModelsQueryHandler,
  FindCloudAgentRepositoriesQueryHandler,
];

/**
 * Cloud agents (`product/next-steps/cloud-agents.md`): the vendors that run a
 * coding agent in their cloud, on the caller's own key for the vendor. A cloud
 * session is the sessions module's; this module keeps the person's key, says
 * whether they have one and what the vendor offers (models, repositories), and
 * publishes `CLOUD_RUNS`, what a session asks its vendor. Who runs one is
 * `CloudAgentProviderRegistry`: an ordered list of `CloudAgentProvider`s,
 * today Cursor's Cloud Agents.
 */
@Module({
  imports: [
    CqrsModule,
    TypeOrmModule.forFeature([CloudAgentCredentialOrmEntity]),
    AuthzKernelModule.forFeature([CloudAgentResource]),
  ],
  controllers: [...httpControllers],
  providers: [
    ...commandHandlers,
    ...queryHandlers,
    CloudAgentCredentialMapper,
    CloudAgentResolver,
    CursorCloudAgentResolver,
    // The vendors, in the order the console lists them. A new one is a
    // `CloudAgentProvider` class, its id in `CLOUD_AGENT_PROVIDERS`, and a place here.
    {
      provide: CloudAgentProviderRegistry,
      inject: [CursorCloudAgentResolver],
      useFactory: (cursor: CursorCloudAgentResolver) => new CloudAgentProviderRegistry([cursor]),
    },
    { provide: CLOUD_AGENT_CREDENTIAL_REPOSITORY, useClass: CloudAgentCredentialRepository },
    { provide: KEY_SEALER, useClass: AesKeySealerAdapter },
    { provide: CURSOR_CLOUD_AGENTS, useClass: CursorCloudAgentsGateway },
    { provide: CLOUD_RUNS, useClass: CloudRunsResolver },
  ],
  exports: [CLOUD_RUNS],
})
export class CloudAgentsModule {}
