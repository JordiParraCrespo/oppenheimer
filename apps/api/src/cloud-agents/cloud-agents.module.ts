import { Module, type Provider } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthzModule as AuthzKernelModule } from '@oppenheimer/backend-authz';
import { CloudAgentResolver } from './application/cloud-agent.resolver';
import { CloudAgentProviderRegistry } from './application/cloud-agent-provider.registry';
import { CloudAgentSyncResolver } from './application/cloud-agent-sync.resolver';
import { CursorCloudAgentResolver } from './application/cursor-cloud-agent.resolver';
import { CloudAgentMapper } from './cloud-agent.mapper';
import { CloudAgentCredentialMapper } from './cloud-agent-credential.mapper';
import {
  CLOUD_AGENT_CREDENTIAL_REPOSITORY,
  CLOUD_AGENT_REPOSITORY,
  CURSOR_CLOUD_AGENTS,
  KEY_SEALER,
} from './cloud-agents.di-tokens';
import { CloudAgentResource } from './cloud-agents.resource';
import { CancelCloudAgentCommandHandler } from './commands/cancel-cloud-agent/cancel-cloud-agent.command-handler';
import { CancelCloudAgentHttpController } from './commands/cancel-cloud-agent/cancel-cloud-agent.http.controller';
import { FollowUpCloudAgentCommandHandler } from './commands/follow-up-cloud-agent/follow-up-cloud-agent.command-handler';
import { FollowUpCloudAgentHttpController } from './commands/follow-up-cloud-agent/follow-up-cloud-agent.http.controller';
import { LaunchCloudAgentCommandHandler } from './commands/launch-cloud-agent/launch-cloud-agent.command-handler';
import { LaunchCloudAgentHttpController } from './commands/launch-cloud-agent/launch-cloud-agent.http.controller';
import { PutCloudAgentCredentialCommandHandler } from './commands/put-cloud-agent-credential/put-cloud-agent-credential.command-handler';
import { PutCloudAgentCredentialHttpController } from './commands/put-cloud-agent-credential/put-cloud-agent-credential.http.controller';
import { RemoveCloudAgentCredentialCommandHandler } from './commands/remove-cloud-agent-credential/remove-cloud-agent-credential.command-handler';
import { RemoveCloudAgentCredentialHttpController } from './commands/remove-cloud-agent-credential/remove-cloud-agent-credential.http.controller';
import { CloudAgentOrmEntity } from './database/cloud-agent.orm-entity';
import { CloudAgentRepository } from './database/cloud-agent.repository';
import { CloudAgentCredentialOrmEntity } from './database/cloud-agent-credential.orm-entity';
import { CloudAgentCredentialRepository } from './database/cloud-agent-credential.repository';
import { AesKeySealerAdapter } from './infrastructure/aes-key-sealer.adapter';
import { CursorCloudAgentsGateway } from './infrastructure/cursor-cloud-agents.gateway';
import { FindCloudAgentHttpController } from './queries/find-cloud-agent/find-cloud-agent.http.controller';
import { FindCloudAgentQueryHandler } from './queries/find-cloud-agent/find-cloud-agent.query-handler';
import { FindCloudAgentModelsHttpController } from './queries/find-cloud-agent-models/find-cloud-agent-models.http.controller';
import { FindCloudAgentModelsQueryHandler } from './queries/find-cloud-agent-models/find-cloud-agent-models.query-handler';
import { FindCloudAgentRepositoriesHttpController } from './queries/find-cloud-agent-repositories/find-cloud-agent-repositories.http.controller';
import { FindCloudAgentRepositoriesQueryHandler } from './queries/find-cloud-agent-repositories/find-cloud-agent-repositories.query-handler';
import { FindCloudAgentStatusHttpController } from './queries/find-cloud-agent-status/find-cloud-agent-status.http.controller';
import { FindCloudAgentStatusQueryHandler } from './queries/find-cloud-agent-status/find-cloud-agent-status.query-handler';
import { FindCloudAgentsHttpController } from './queries/find-cloud-agents/find-cloud-agents.http.controller';
import { FindCloudAgentsQueryHandler } from './queries/find-cloud-agents/find-cloud-agents.query-handler';

// Static paths (`status`, `providers/…`) before `:id`.
const httpControllers = [
  FindCloudAgentStatusHttpController,
  PutCloudAgentCredentialHttpController,
  RemoveCloudAgentCredentialHttpController,
  FindCloudAgentModelsHttpController,
  FindCloudAgentRepositoriesHttpController,
  FindCloudAgentsHttpController,
  LaunchCloudAgentHttpController,
  FindCloudAgentHttpController,
  FollowUpCloudAgentHttpController,
  CancelCloudAgentHttpController,
];

const commandHandlers: Provider[] = [
  PutCloudAgentCredentialCommandHandler,
  RemoveCloudAgentCredentialCommandHandler,
  LaunchCloudAgentCommandHandler,
  FollowUpCloudAgentCommandHandler,
  CancelCloudAgentCommandHandler,
];

const queryHandlers: Provider[] = [
  FindCloudAgentStatusQueryHandler,
  FindCloudAgentsQueryHandler,
  FindCloudAgentQueryHandler,
  FindCloudAgentModelsQueryHandler,
  FindCloudAgentRepositoriesQueryHandler,
];

/**
 * Cloud agents (`product/next-steps/cloud-agents.md`): coding agents run in a
 * vendor's cloud, launched and followed from the console, on the caller's own
 * key for the vendor. Who runs one is `CloudAgentProviderRegistry`: an ordered
 * list of `CloudAgentProvider`s, today Cursor's Cloud Agents.
 */
@Module({
  imports: [
    CqrsModule,
    TypeOrmModule.forFeature([CloudAgentOrmEntity, CloudAgentCredentialOrmEntity]),
    AuthzKernelModule.forFeature([CloudAgentResource]),
  ],
  controllers: [...httpControllers],
  providers: [
    ...commandHandlers,
    ...queryHandlers,
    CloudAgentMapper,
    CloudAgentCredentialMapper,
    CloudAgentResolver,
    CloudAgentSyncResolver,
    CursorCloudAgentResolver,
    // The vendors, in the order the console lists them. A new one is a
    // `CloudAgentProvider` class, its id in `CLOUD_AGENT_PROVIDERS`, and a place here.
    {
      provide: CloudAgentProviderRegistry,
      inject: [CursorCloudAgentResolver],
      useFactory: (cursor: CursorCloudAgentResolver) => new CloudAgentProviderRegistry([cursor]),
    },
    { provide: CLOUD_AGENT_REPOSITORY, useClass: CloudAgentRepository },
    { provide: CLOUD_AGENT_CREDENTIAL_REPOSITORY, useClass: CloudAgentCredentialRepository },
    { provide: KEY_SEALER, useClass: AesKeySealerAdapter },
    { provide: CURSOR_CLOUD_AGENTS, useClass: CursorCloudAgentsGateway },
  ],
})
export class CloudAgentsModule {}
