import { Inject, Logger } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import type { TelegramDevicePort } from '../../application/telegram-device.port';
import type { TelegramAccountRepositoryPort } from '../../database/telegram-account.repository.port';
import { TELEGRAM_ACCOUNT_REPOSITORY, TELEGRAM_DEVICE } from '../../telegram.di-tokens';
import { TelegramAccountMapper } from '../../telegram-account.mapper';
import { RecordTelegramStateCommand } from './record-telegram-state.command';

/** What a host may hold a bot's token in: the control plane unlinks one it no longer knows. */
const HOLDS_A_TOKEN = new Set(['connecting', 'connected']);

/**
 * Keeps how a host says its bot stands on the account connected there. The
 * account is the record: a host that reports a bot nobody connects any more
 * (disconnected while the host was offline) is told to unlink it, so a
 * removed bot does not go on polling with its token.
 */
@CommandHandler(RecordTelegramStateCommand)
export class RecordTelegramStateCommandHandler
  implements ICommandHandler<RecordTelegramStateCommand, void>
{
  private readonly logger = new Logger(RecordTelegramStateCommandHandler.name);

  constructor(
    @Inject(TELEGRAM_ACCOUNT_REPOSITORY)
    private readonly accounts: TelegramAccountRepositoryPort,
    @Inject(TELEGRAM_DEVICE)
    private readonly device: TelegramDevicePort,
    private readonly mapper: TelegramAccountMapper,
  ) {}

  async execute({ hostId, report }: RecordTelegramStateCommand): Promise<void> {
    const found = await this.accounts.findByHostForSystem(hostId);
    if (found.isNone()) {
      if (HOLDS_A_TOKEN.has(report.state)) {
        this.logger.warn({
          message: 'a host holds a Telegram bot nobody connects; unlinking it',
          hostId,
        });
        this.device.unlink(hostId);
      }
      return;
    }
    const account = found.unwrap();
    account.report(this.mapper.toReport(report));
    await this.accounts.save(account);
  }
}
