import { Module, type Provider } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthzModule as AuthzKernelModule } from '@oppenheimer/backend-authz';
import { HostsModule } from '../hosts/hosts.module';
import { BotLookupResolver } from './application/bot-lookup.resolver';
import { ModelProviderResolver } from './application/model-provider.resolver';
import { BotMapper } from './bot.mapper';
import { BotDocumentMapper } from './bot-document.mapper';
import { BotGroupMapper } from './bot-group.mapper';
import { BotMemoryFactMapper } from './bot-memory-fact.mapper';
import {
  BOT_DOCUMENT_REPOSITORY,
  BOT_GROUP_REPOSITORY,
  BOT_LOOKUP,
  BOT_MEMORY_FACT_REPOSITORY,
  BOT_REPOSITORY,
  MODEL_PROVIDER_CREDENTIAL_REPOSITORY,
  PROVIDER_KEY_SEALER,
} from './bots.di-tokens';
import { BotResource } from './bots.resource';
import { ClearBotMemoryCommandHandler } from './commands/clear-bot-memory/clear-bot-memory.command-handler';
import { ClearBotMemoryHttpController } from './commands/clear-bot-memory/clear-bot-memory.http.controller';
import { CreateBotCommandHandler } from './commands/create-bot/create-bot.command-handler';
import { CreateBotHttpController } from './commands/create-bot/create-bot.http.controller';
import { CreateBotGroupCommandHandler } from './commands/create-bot-group/create-bot-group.command-handler';
import { CreateBotGroupHttpController } from './commands/create-bot-group/create-bot-group.http.controller';
import { CreateBotMemoryFactCommandHandler } from './commands/create-bot-memory-fact/create-bot-memory-fact.command-handler';
import { CreateBotMemoryFactHttpController } from './commands/create-bot-memory-fact/create-bot-memory-fact.http.controller';
import { DeleteBotCommandHandler } from './commands/delete-bot/delete-bot.command-handler';
import { DeleteBotHttpController } from './commands/delete-bot/delete-bot.http.controller';
import { DeleteBotGroupCommandHandler } from './commands/delete-bot-group/delete-bot-group.command-handler';
import { DeleteBotGroupHttpController } from './commands/delete-bot-group/delete-bot-group.http.controller';
import { DeleteBotMemoryFactCommandHandler } from './commands/delete-bot-memory-fact/delete-bot-memory-fact.command-handler';
import { DeleteBotMemoryFactHttpController } from './commands/delete-bot-memory-fact/delete-bot-memory-fact.http.controller';
import { DeleteModelProviderCredentialCommandHandler } from './commands/delete-model-provider-credential/delete-model-provider-credential.command-handler';
import { DeleteModelProviderCredentialHttpController } from './commands/delete-model-provider-credential/delete-model-provider-credential.http.controller';
import { PutModelProviderCredentialCommandHandler } from './commands/put-model-provider-credential/put-model-provider-credential.command-handler';
import { PutModelProviderCredentialHttpController } from './commands/put-model-provider-credential/put-model-provider-credential.http.controller';
import { RevertBotDocumentCommandHandler } from './commands/revert-bot-document/revert-bot-document.command-handler';
import { RevertBotDocumentHttpController } from './commands/revert-bot-document/revert-bot-document.http.controller';
import { SetDefaultModelProviderCommandHandler } from './commands/set-default-model-provider/set-default-model-provider.command-handler';
import { SetDefaultModelProviderHttpController } from './commands/set-default-model-provider/set-default-model-provider.http.controller';
import { UpdateBotCommandHandler } from './commands/update-bot/update-bot.command-handler';
import { UpdateBotHttpController } from './commands/update-bot/update-bot.http.controller';
import { UpdateBotDocumentCommandHandler } from './commands/update-bot-document/update-bot-document.command-handler';
import { UpdateBotDocumentHttpController } from './commands/update-bot-document/update-bot-document.http.controller';
import { UpdateBotGroupCommandHandler } from './commands/update-bot-group/update-bot-group.command-handler';
import { UpdateBotGroupHttpController } from './commands/update-bot-group/update-bot-group.http.controller';
import { UpdateBotMemoryFactCommandHandler } from './commands/update-bot-memory-fact/update-bot-memory-fact.command-handler';
import { UpdateBotMemoryFactHttpController } from './commands/update-bot-memory-fact/update-bot-memory-fact.http.controller';
import { BotOrmEntity } from './database/bot.orm-entity';
import { BotRepository } from './database/bot.repository';
import { BotDocumentOrmEntity } from './database/bot-document.orm-entity';
import { BotDocumentRepository } from './database/bot-document.repository';
import { BotDocumentRevisionOrmEntity } from './database/bot-document-revision.orm-entity';
import { BotGroupOrmEntity } from './database/bot-group.orm-entity';
import { BotGroupRepository } from './database/bot-group.repository';
import { BotMemoryFactOrmEntity } from './database/bot-memory-fact.orm-entity';
import { BotMemoryFactRepository } from './database/bot-memory-fact.repository';
import { ModelProviderCredentialOrmEntity } from './database/model-provider-credential.orm-entity';
import { ModelProviderCredentialRepository } from './database/model-provider-credential.repository';
import { AesProviderKeySealerAdapter } from './infrastructure/aes-provider-key-sealer.adapter';
import { ModelProviderCredentialMapper } from './model-provider-credential.mapper';
import { FindBotHttpController } from './queries/find-bot/find-bot.http.controller';
import { FindBotQueryHandler } from './queries/find-bot/find-bot.query-handler';
import { FindBotDocumentQueryHandler } from './queries/find-bot-document/find-bot-document.query-handler';
import { FindBotDocumentRevisionsHttpController } from './queries/find-bot-document-revisions/find-bot-document-revisions.http.controller';
import { FindBotDocumentRevisionsQueryHandler } from './queries/find-bot-document-revisions/find-bot-document-revisions.query-handler';
import { FindBotDocumentsHttpController } from './queries/find-bot-documents/find-bot-documents.http.controller';
import { FindBotDocumentsQueryHandler } from './queries/find-bot-documents/find-bot-documents.query-handler';
import { FindBotGroupQueryHandler } from './queries/find-bot-group/find-bot-group.query-handler';
import { FindBotGroupsHttpController } from './queries/find-bot-groups/find-bot-groups.http.controller';
import { FindBotGroupsQueryHandler } from './queries/find-bot-groups/find-bot-groups.query-handler';
import { FindBotMemoryHttpController } from './queries/find-bot-memory/find-bot-memory.http.controller';
import { FindBotMemoryQueryHandler } from './queries/find-bot-memory/find-bot-memory.query-handler';
import { FindBotMemoryFactQueryHandler } from './queries/find-bot-memory-fact/find-bot-memory-fact.query-handler';
import { FindBotsHttpController } from './queries/find-bots/find-bots.http.controller';
import { FindBotsQueryHandler } from './queries/find-bots/find-bots.query-handler';
import { FindModelProviderCredentialsHttpController } from './queries/find-model-provider-credentials/find-model-provider-credentials.http.controller';
import { FindModelProviderCredentialsQueryHandler } from './queries/find-model-provider-credentials/find-model-provider-credentials.query-handler';

const httpControllers = [
  FindBotsHttpController,
  CreateBotHttpController,
  FindBotHttpController,
  UpdateBotHttpController,
  DeleteBotHttpController,
  FindBotDocumentsHttpController,
  UpdateBotDocumentHttpController,
  FindBotDocumentRevisionsHttpController,
  RevertBotDocumentHttpController,
  FindBotMemoryHttpController,
  CreateBotMemoryFactHttpController,
  ClearBotMemoryHttpController,
  UpdateBotMemoryFactHttpController,
  DeleteBotMemoryFactHttpController,
  FindBotGroupsHttpController,
  CreateBotGroupHttpController,
  UpdateBotGroupHttpController,
  DeleteBotGroupHttpController,
  FindModelProviderCredentialsHttpController,
  PutModelProviderCredentialHttpController,
  DeleteModelProviderCredentialHttpController,
  SetDefaultModelProviderHttpController,
];

const commandHandlers: Provider[] = [
  CreateBotCommandHandler,
  UpdateBotCommandHandler,
  DeleteBotCommandHandler,
  CreateBotGroupCommandHandler,
  UpdateBotGroupCommandHandler,
  DeleteBotGroupCommandHandler,
  UpdateBotDocumentCommandHandler,
  RevertBotDocumentCommandHandler,
  CreateBotMemoryFactCommandHandler,
  UpdateBotMemoryFactCommandHandler,
  DeleteBotMemoryFactCommandHandler,
  ClearBotMemoryCommandHandler,
  PutModelProviderCredentialCommandHandler,
  DeleteModelProviderCredentialCommandHandler,
  SetDefaultModelProviderCommandHandler,
];

const queryHandlers: Provider[] = [
  FindBotsQueryHandler,
  FindBotQueryHandler,
  FindBotGroupsQueryHandler,
  FindBotGroupQueryHandler,
  FindBotDocumentsQueryHandler,
  FindBotDocumentQueryHandler,
  FindBotDocumentRevisionsQueryHandler,
  FindBotMemoryQueryHandler,
  FindBotMemoryFactQueryHandler,
  FindModelProviderCredentialsQueryHandler,
];

/**
 * Bots (`product/versions/mvp/25-bots.md`): who a bot is, the sidebar groups,
 * its soul and instructions with their history, what it remembers, and the
 * workspace's model provider keys it runs on.
 */
@Module({
  imports: [
    CqrsModule,
    TypeOrmModule.forFeature([
      BotOrmEntity,
      BotGroupOrmEntity,
      BotDocumentOrmEntity,
      BotDocumentRevisionOrmEntity,
      BotMemoryFactOrmEntity,
      ModelProviderCredentialOrmEntity,
    ]),
    AuthzKernelModule.forFeature([BotResource]),
    // A home host is one the caller may use, asked through the hosts module's port.
    HostsModule,
  ],
  controllers: [...httpControllers],
  providers: [
    ...commandHandlers,
    ...queryHandlers,
    BotMapper,
    BotGroupMapper,
    BotDocumentMapper,
    BotMemoryFactMapper,
    BotLookupResolver,
    ModelProviderCredentialMapper,
    ModelProviderResolver,
    { provide: PROVIDER_KEY_SEALER, useClass: AesProviderKeySealerAdapter },
    {
      provide: MODEL_PROVIDER_CREDENTIAL_REPOSITORY,
      useClass: ModelProviderCredentialRepository,
    },
    { provide: BOT_REPOSITORY, useClass: BotRepository },
    { provide: BOT_GROUP_REPOSITORY, useClass: BotGroupRepository },
    { provide: BOT_DOCUMENT_REPOSITORY, useClass: BotDocumentRepository },
    { provide: BOT_MEMORY_FACT_REPOSITORY, useClass: BotMemoryFactRepository },
    { provide: BOT_LOOKUP, useExisting: BotLookupResolver },
  ],
  // What the chat (`BotsChatModule`) reads a bot, its parts and its key through.
  exports: [
    BOT_LOOKUP,
    BOT_REPOSITORY,
    BOT_DOCUMENT_REPOSITORY,
    BOT_MEMORY_FACT_REPOSITORY,
    MODEL_PROVIDER_CREDENTIAL_REPOSITORY,
    PROVIDER_KEY_SEALER,
  ],
})
export class BotsModule {}
