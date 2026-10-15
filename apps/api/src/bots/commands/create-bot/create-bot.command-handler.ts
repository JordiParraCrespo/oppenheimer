import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { AppError, requireFound } from '@oppenheimer/backend-core';
import { type AggregateID, ArgumentInvalidException } from '@oppenheimer/backend-ddd';
import { BOT_DEFAULT_NAME, botSoulFor } from '@oppenheimer/shared';
import type { HostAccessPort } from '../../../hosts/application/host-access.port';
import { HOST_ACCESS } from '../../../hosts/hosts.di-tokens';
import { BOT_GROUP_REPOSITORY, BOT_REPOSITORY } from '../../bots.di-tokens';
import type { BotRepositoryPort } from '../../database/bot.repository.port';
import type { BotGroupRepositoryPort } from '../../database/bot-group.repository.port';
import { BotEntity } from '../../domain/bot.entity';
import { userActor } from '../../domain/bot.types';
import { permissionForBotMadeBy } from '../../domain/bot-creation.policy';
import { BotDocumentEntity } from '../../domain/bot-document.entity';
import { avatarColorFor, uniqueBotName } from '../../domain/bot-naming.policy';
import { BotErrors } from '../../domain/bots.errors';
import { CreateBotCommand } from './create-bot.command';

/**
 * A blank bot (`product/versions/mvp/25-bots.md` §2): "New Bot" unless named,
 * numbered when the workspace already has the name, on the next avatar colour,
 * last in its group. It is born with a `SOUL.md` that says its name and an
 * empty `INSTRUCTIONS.md`, both at revision 1, so its history starts with its
 * creation. A home host, when given, is one the caller may use.
 *
 * A bot creating one (`create_bot`, §4.6) also names its engine, its level,
 * both documents and itself: the new bot is still the caller's, marked as
 * the creator's, never looser than it, and made once per idempotency key,
 * however often the call is retried.
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
  ) {}

  async execute({ scope, input, byBot }: CreateBotCommand): Promise<AggregateID> {
    if (!scope.organizationId) throw new AppError(BotErrors.NO_ACTIVE_ORGANIZATION);
    if (byBot) {
      // A retry of a creation that landed: answer the bot it made, checking nothing again.
      const made = await this.bots.findOneByIdempotencyKey(scope, byBot.idempotencyKey);
      if (made.isSome()) return made.unwrap().id;
      const creator = requireFound(
        await this.bots.findOneById(scope, byBot.creatorBotId),
        BotErrors.NOT_FOUND,
      );
      if ('refused' in permissionForBotMadeBy(creator.permission, byBot.permission)) {
        throw new ArgumentInvalidException(
          `A bot cannot create a bot looser than its own ${creator.permission}`,
        );
      }
    }
    const groupId = input.groupId ?? null;
    if (groupId) {
      requireFound(await this.groups.findOneById(scope, groupId), BotErrors.GROUP_NOT_FOUND);
    }
    const homeHostId = input.homeHostId ?? null;
    if (homeHostId) await this.hosts.assertUsable(scope, homeHostId);

    const taken = await this.bots.namesIn(scope);
    const bot = BotEntity.createNew({
      organizationId: scope.organizationId,
      createdByUserId: scope.userId,
      name: uniqueBotName(input.name ?? BOT_DEFAULT_NAME, taken),
      description: input.description ?? '',
      avatarColor: input.avatarColor ?? avatarColorFor(taken.length),
      groupId,
      homeHostId,
      provider: input.provider ?? 'anthropic',
      model: byBot?.model,
      effort: byBot?.effort,
      permission: byBot?.permission,
      createdByBotId: byBot?.creatorBotId,
      idempotencyKey: byBot?.idempotencyKey,
    });
    const actor = userActor(scope.userId);
    const documents = [
      BotDocumentEntity.initial({
        organizationId: bot.organizationId,
        botId: bot.id,
        name: 'soul',
        content: byBot?.soul ?? botSoulFor(bot.name),
        actor,
      }),
      BotDocumentEntity.initial({
        organizationId: bot.organizationId,
        botId: bot.id,
        name: 'instructions',
        content: byBot?.instructions ?? '',
        actor,
      }),
    ];
    const outcome = await this.bots.insert(bot, documents);
    if (outcome === 'group-missing') throw new AppError(BotErrors.GROUP_NOT_FOUND);
    if (outcome === 'taken' && bot.idempotencyKey) {
      // A racing attempt with this key made it first: that bot is the answer.
      const made = await this.bots.findOneByIdempotencyKey(scope, bot.idempotencyKey);
      if (made.isSome()) return made.unwrap().id;
    }
    if (outcome !== 'saved') {
      throw new Error(`Bot ${bot.id} was neither inserted nor already present`);
    }
    return bot.id;
  }
}
