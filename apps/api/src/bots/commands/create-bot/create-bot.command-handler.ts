import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { AppError, requireFound } from '@oppenheimer/backend-core';
import type { AggregateID } from '@oppenheimer/backend-ddd';
import { BOT_DEFAULT_NAME, botSoulFor } from '@oppenheimer/shared';
import type { HostAccessPort } from '../../../hosts/application/host-access.port';
import { HOST_ACCESS } from '../../../hosts/hosts.di-tokens';
import {
  BOT_GROUP_REPOSITORY,
  BOT_REPOSITORY,
  MODEL_PROVIDER_CREDENTIAL_REPOSITORY,
} from '../../bots.di-tokens';
import type { BotRepositoryPort } from '../../database/bot.repository.port';
import type { BotGroupRepositoryPort } from '../../database/bot-group.repository.port';
import type { ModelProviderCredentialRepositoryPort } from '../../database/model-provider-credential.repository.port';
import { BotEntity } from '../../domain/bot.entity';
import { userActor } from '../../domain/bot.types';
import { BotDocumentEntity } from '../../domain/bot-document.entity';
import { avatarColorFor, uniqueBotName } from '../../domain/bot-naming.policy';
import { BotErrors } from '../../domain/bots.errors';
import { CreateBotCommand } from './create-bot.command';

/**
 * A blank bot (`product/versions/mvp/25-bots.md` §2): "New Bot" unless named,
 * numbered when the workspace already has the name, on the next avatar colour,
 * last in its group. It is born with a `SOUL.md` that says its name and an
 * empty `INSTRUCTIONS.md`, both at revision 1, so its history starts with its
 * creation. A home host, when given, is one the caller may use. A bot that
 * names no provider starts on the workspace's default.
 */
@CommandHandler(CreateBotCommand)
export class CreateBotCommandHandler implements ICommandHandler<CreateBotCommand, AggregateID> {
  constructor(
    @Inject(BOT_REPOSITORY)
    private readonly bots: BotRepositoryPort,
    @Inject(BOT_GROUP_REPOSITORY)
    private readonly groups: BotGroupRepositoryPort,
    @Inject(HOST_ACCESS)
    private readonly hosts: HostAccessPort,
    @Inject(MODEL_PROVIDER_CREDENTIAL_REPOSITORY)
    private readonly credentials: ModelProviderCredentialRepositoryPort,
  ) {}

  async execute({ scope, input }: CreateBotCommand): Promise<AggregateID> {
    if (!scope.organizationId) throw new AppError(BotErrors.NO_ACTIVE_ORGANIZATION);
    const groupId = input.groupId ?? null;
    if (groupId) {
      requireFound(await this.groups.findOneById(scope, groupId), BotErrors.GROUP_NOT_FOUND);
    }
    const homeHostId = input.homeHostId ?? null;
    if (homeHostId) await this.hosts.assertUsable(scope, homeHostId);

    const provider = input.provider ?? (await this.credentials.defaultProvider(scope));
    const taken = await this.bots.namesIn(scope);
    const bot = BotEntity.createNew({
      organizationId: scope.organizationId,
      createdByUserId: scope.userId,
      name: uniqueBotName(input.name ?? BOT_DEFAULT_NAME, taken),
      description: input.description ?? '',
      avatarColor: input.avatarColor ?? avatarColorFor(taken.length),
      groupId,
      homeHostId,
      provider,
    });
    const actor = userActor(scope.userId);
    const documents = [
      BotDocumentEntity.initial({
        organizationId: bot.organizationId,
        botId: bot.id,
        name: 'soul',
        content: botSoulFor(bot.name),
        actor,
      }),
      BotDocumentEntity.initial({
        organizationId: bot.organizationId,
        botId: bot.id,
        name: 'instructions',
        content: '',
        actor,
      }),
    ];
    if ((await this.bots.insert(bot, documents)) === 'group-missing') {
      throw new AppError(BotErrors.GROUP_NOT_FOUND);
    }
    return bot.id;
  }
}
