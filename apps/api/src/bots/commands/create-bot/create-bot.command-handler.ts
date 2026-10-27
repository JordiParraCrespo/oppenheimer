import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import type { AccessScope } from '@oppenheimer/backend-authz';
import { AppError, requireFound } from '@oppenheimer/backend-core';
import type { AggregateID } from '@oppenheimer/backend-ddd';
import type { BotPermission } from '@oppenheimer/shared';
import type { HostAccessPort } from '../../../hosts/application/host-access.port';
import { HOST_ACCESS } from '../../../hosts/hosts.di-tokens';
import { NewBotProviderResolver } from '../../application/new-bot-provider.resolver';
import { BOT_GROUP_REPOSITORY, BOT_REPOSITORY } from '../../bots.di-tokens';
import type { BotCreatorCheck, BotRepositoryPort } from '../../database/bot.repository.port';
import type { BotGroupRepositoryPort } from '../../database/bot-group.repository.port';
import { BotEntity } from '../../domain/bot.entity';
import { userActor } from '../../domain/bot.types';
import {
  BotLooserThanCreatorException,
  permissionForBotMadeBy,
} from '../../domain/bot-creation.policy';
import { BotDocumentEntity } from '../../domain/bot-document.entity';
import { avatarColorFor, nameForNewBot } from '../../domain/bot-naming.policy';
import { BotErrors } from '../../domain/bots.errors';
import { CreateBotCommand } from './create-bot.command';

/**
 * A blank bot (`product/versions/mvp/25-bots.md` §1): named by `nameForNewBot`,
 * on the next avatar colour, last in its group, in the sections named. It is born
 * with a `SOUL.md` that says its name and an empty `INSTRUCTIONS.md`, both at revision 1,
 * so its history starts with its creation. A home host, when given, is one the caller may use.
 * The optional fields set what the form does not: the engine, the level,
 * both documents, a creating bot and an idempotency key (`create_bot`,
 * §4.6). The new bot is the caller's whoever creates it; a creating bot
 * marks it and caps its level, held under a lock on the creator's row until
 * the write commits; a key makes it once, however often it is retried.
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
    private readonly providers: NewBotProviderResolver,
  ) {}

  async execute(command: CreateBotCommand): Promise<AggregateID> {
    const { scope, input } = command;
    if (!scope.organizationId) throw new AppError(BotErrors.NO_ACTIVE_ORGANIZATION);
    // A retry of a creation that landed: the bot it made, checking nothing again.
    const earlier = await this.madeWith(scope, command.idempotencyKey);
    if (earlier) return earlier;
    const creator = command.creatorBotId
      ? await this.creatorAllowing(scope, command.creatorBotId, command.permission)
      : undefined;
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
      name: nameForNewBot(input.name, taken),
      description: input.description ?? '',
      avatarColor: input.avatarColor ?? avatarColorFor(taken.length),
      groupId,
      homeHostId,
      provider: await this.providers.providerFor(scope, input.provider, command.model),
      model: command.model,
      effort: command.effort,
      permission: command.permission,
      createdByBotId: command.creatorBotId,
      idempotencyKey: command.idempotencyKey,
      sections: input.sections,
    });
    const documents = BotDocumentEntity.firstOf(bot, userActor(scope.userId), command);
    const outcome = await this.bots.insert(bot, documents, creator);
    if (outcome === 'group-missing') throw new AppError(BotErrors.GROUP_NOT_FOUND);
    if (outcome === 'creator-changed') throw new BotLooserThanCreatorException();
    if (outcome === 'taken') {
      // A racing creation with this key made it first: that bot is the answer.
      const made = await this.madeWith(scope, command.idempotencyKey);
      if (made) return made;
    }
    if (outcome !== 'saved') {
      throw new Error(`Bot ${bot.id} was neither inserted nor already present`);
    }
    return bot.id;
  }

  /** The bot a creation with `key` already made; undefined when there is no key, or none did. */
  private async madeWith(scope: AccessScope, key: string | undefined): Promise<string | undefined> {
    if (!key) return undefined;
    const made = await this.bots.findOneByIdempotencyKey(scope, key);
    return made.isSome() ? made.unwrap().id : undefined;
  }

  /**
   * The creating bot, which must allow `permission` (`permissionForBotMadeBy`).
   * Answers the level it was checked at, which the insert holds it to.
   */
  private async creatorAllowing(
    scope: AccessScope,
    creatorBotId: string,
    permission: BotPermission | undefined,
  ): Promise<BotCreatorCheck> {
    const creator = requireFound(
      await this.bots.findOneById(scope, creatorBotId),
      BotErrors.NOT_FOUND,
    );
    if ('refused' in permissionForBotMadeBy(creator.permission, permission)) {
      throw new BotLooserThanCreatorException();
    }
    return { botId: creator.id, permission: creator.permission };
  }
}
