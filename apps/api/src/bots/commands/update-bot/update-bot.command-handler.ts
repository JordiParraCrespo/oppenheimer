import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { AppError, requireFound } from '@oppenheimer/backend-core';
import type { AggregateID } from '@oppenheimer/backend-ddd';
import type { HostAccessPort } from '../../../hosts/application/host-access.port';
import { HOST_ACCESS } from '../../../hosts/hosts.di-tokens';
import { BotLookupResolver } from '../../application/bot-lookup.resolver';
import { BOT_GROUP_REPOSITORY, BOT_REPOSITORY } from '../../bots.di-tokens';
import type { BotRepositoryPort } from '../../database/bot.repository.port';
import type { BotGroupRepositoryPort } from '../../database/bot-group.repository.port';
import { isBotModel } from '../../domain/bot-launch.policy';
import { BotErrors } from '../../domain/bots.errors';
import { UpdateBotCommand } from './update-bot.command';

/**
 * Settings → Profile and Runs on, the composer's model, effort and approval
 * level, and the sidebar's drag: what changed is confirmed as the caller (a
 * group of the workspace, a host they may use, a Claude Code model) before
 * anything is written.
 */
@CommandHandler(UpdateBotCommand)
export class UpdateBotCommandHandler implements ICommandHandler<UpdateBotCommand, AggregateID> {
  constructor(
    private readonly lookup: BotLookupResolver,
    @Inject(BOT_REPOSITORY)
    private readonly bots: BotRepositoryPort,
    @Inject(BOT_GROUP_REPOSITORY)
    private readonly groups: BotGroupRepositoryPort,
    @Inject(HOST_ACCESS)
    private readonly hosts: HostAccessPort,
  ) {}

  async execute({ scope, botId, input }: UpdateBotCommand): Promise<AggregateID> {
    const bot = await this.lookup.bot(scope, botId);
    if (input.groupId && input.groupId !== bot.groupId) {
      requireFound(await this.groups.findOneById(scope, input.groupId), BotErrors.GROUP_NOT_FOUND);
    }
    if (input.homeHostId && input.homeHostId !== bot.homeHostId) {
      await this.hosts.assertUsable(scope, input.homeHostId);
    }
    if (input.model !== undefined && !isBotModel(input.model)) {
      throw new AppError(BotErrors.MODEL_UNSUPPORTED, {
        detail: `${input.model} is not a Claude Code model`,
      });
    }

    bot.edit({
      name: input.name,
      description: input.description,
      avatarColor: input.avatarColor,
      homeHostId: input.homeHostId,
      model: input.model,
      effort: input.effort,
      permission: input.permission,
      learnAutomatically: input.learnAutomatically,
    });
    bot.moveTo(input.groupId === undefined ? bot.groupId : input.groupId, input.position);

    const outcome = await this.bots.save(bot);
    if (outcome === 'missing') throw new AppError(BotErrors.NOT_FOUND);
    if (outcome === 'group-missing') throw new AppError(BotErrors.GROUP_NOT_FOUND);
    return bot.id;
  }
}
