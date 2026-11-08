import { Inject, Logger } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import type { AccessScope } from '@oppenheimer/backend-authz';
import { AppError } from '@oppenheimer/backend-core';
import type { AggregateID } from '@oppenheimer/backend-ddd';
import { TELEGRAM_ACCOUNTS_MAX, type TelegramAccountStatus } from '@oppenheimer/shared';
import type { HostAccessPort } from '../../../hosts/application/host-access.port';
import { HOST_ACCESS } from '../../../hosts/hosts.di-tokens';
import type {
  TelegramDevicePort,
  TelegramLinkRefusal,
} from '../../application/telegram-device.port';
import type { TelegramAccountRepositoryPort } from '../../database/telegram-account.repository.port';
import { TelegramErrors } from '../../domain/telegram.errors';
import { TelegramAccountEntity } from '../../domain/telegram-account.entity';
import { TELEGRAM_ACCOUNT_REPOSITORY, TELEGRAM_DEVICE } from '../../telegram.di-tokens';
import { LinkTelegramCommand } from './link-telegram.command';

/**
 * Connects a Telegram bot on one of the caller's hosts (`telegram.md` §2):
 * hands the host's runner the bot's token, which it checks with Telegram,
 * keeps, and polls with. The host's `telegram.state` tells how it went; a
 * token the host refuses marks the account `revoked` with the host's reason,
 * so Settings offers to connect again. The caller's bot already on that host
 * takes the token too, keeping its row and its messages: that is how a
 * revoked token is replaced. A host holds one Telegram bot, so another
 * person's there refuses. The token is never stored or logged here.
 */
@CommandHandler(LinkTelegramCommand)
export class LinkTelegramCommandHandler
  implements ICommandHandler<LinkTelegramCommand, AggregateID>
{
  private readonly logger = new Logger(LinkTelegramCommandHandler.name);

  constructor(
    @Inject(HOST_ACCESS)
    private readonly hosts: HostAccessPort,
    @Inject(TELEGRAM_DEVICE)
    private readonly device: TelegramDevicePort,
    @Inject(TELEGRAM_ACCOUNT_REPOSITORY)
    private readonly accounts: TelegramAccountRepositoryPort,
  ) {}

  async execute({ scope, hostId, token, label }: LinkTelegramCommand): Promise<AggregateID> {
    const organizationId = scope.organizationId;
    if (!organizationId) throw new AppError(TelegramErrors.NO_ACTIVE_ORGANIZATION);
    await this.hosts.assertUsable(scope, hostId);
    const reach = this.device.reach(hostId);
    if (reach === 'offline') throw new AppError(TelegramErrors.HOST_OFFLINE);
    if (reach === 'unsupported') throw new AppError(TelegramErrors.HOST_UNSUPPORTED);

    const { account, statusBefore } = await this.accountFor(scope, organizationId, hostId, label);
    const attempt = this.device.link(hostId, token);
    if (!attempt.sent) throw new AppError(TelegramErrors.HOST_OFFLINE);
    void attempt.refused
      .then((refusal) =>
        refusal ? this.refused(hostId, account.id, refusal, statusBefore) : undefined,
      )
      .catch((error: unknown) =>
        this.logger.warn({
          message: 'a refused Telegram token could not be recorded',
          hostId,
          error: String(error),
        }),
      );
    return account.id;
  }

  /** The host would not take the token: the account says so until the next try. */
  private async refused(
    hostId: string,
    accountId: string,
    refusal: TelegramLinkRefusal,
    statusBefore: TelegramAccountStatus,
  ): Promise<void> {
    const found = await this.accounts.findByHostForSystem(hostId);
    if (found.isNone()) return;
    const account = found.unwrap();
    // A newer connect, or a disconnect, may have replaced the row meanwhile.
    if (account.id !== accountId || account.status !== 'connecting') return;
    account.refuseToken(
      refusal.code === 'TG_001'
        ? 'Telegram refused that token'
        : (refusal.detail ?? `the host refused it (${refusal.code})`),
      statusBefore,
    );
    await this.accounts.save(account);
  }

  private async accountFor(
    scope: AccessScope,
    organizationId: string,
    hostId: string,
    label: string | undefined,
  ): Promise<{ account: TelegramAccountEntity; statusBefore: TelegramAccountStatus }> {
    const found = await this.accounts.findByHostForSystem(hostId);
    if (found.isSome()) {
      const account = found.unwrap();
      if (account.userId !== scope.userId || account.organizationId !== organizationId) {
        throw new AppError(TelegramErrors.HOST_TAKEN);
      }
      const statusBefore = account.status;
      account.reconnect(label);
      await this.accounts.save(account);
      return { account, statusBefore };
    }
    const own = await this.accounts.findAllOwn(scope);
    if (own.length >= TELEGRAM_ACCOUNTS_MAX) {
      throw new AppError(TelegramErrors.ACCOUNT_LIMIT_REACHED, {
        detail: `A person connects at most ${TELEGRAM_ACCOUNTS_MAX} Telegram bots.`,
      });
    }
    const account = TelegramAccountEntity.link({
      organizationId,
      userId: scope.userId,
      hostId,
      label: label ?? '',
    });
    await this.accounts.insert(account);
    return { account, statusBefore: 'unlinked' };
  }
}
