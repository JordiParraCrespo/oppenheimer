import { Inject, Logger } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import type { WhatsappDevicePort } from '../../application/whatsapp-device.port';
import type { WhatsappAccountRepositoryPort } from '../../database/whatsapp-account.repository.port';
import { WHATSAPP_ACCOUNT_REPOSITORY, WHATSAPP_DEVICE } from '../../whatsapp.di-tokens';
import { WhatsappAccountMapper } from '../../whatsapp-account.mapper';
import { RecordWhatsappStateCommand } from './record-whatsapp-state.command';

/** What a host may hold a device in: the control plane unlinks one it no longer knows. */
const HOLDS_A_DEVICE = new Set(['pairing', 'connecting', 'connected']);

/**
 * Keeps how a host says its device stands on the number linked there. The
 * account is the record: a host that reports a device for a number nobody
 * links any more (unlinked while the host was offline) is told to unlink it,
 * so a removed number does not stay a live device on a phone.
 */
@CommandHandler(RecordWhatsappStateCommand)
export class RecordWhatsappStateCommandHandler
  implements ICommandHandler<RecordWhatsappStateCommand, void>
{
  private readonly logger = new Logger(RecordWhatsappStateCommandHandler.name);

  constructor(
    @Inject(WHATSAPP_ACCOUNT_REPOSITORY)
    private readonly accounts: WhatsappAccountRepositoryPort,
    @Inject(WHATSAPP_DEVICE)
    private readonly device: WhatsappDevicePort,
    private readonly mapper: WhatsappAccountMapper,
  ) {}

  async execute({ hostId, report }: RecordWhatsappStateCommand): Promise<void> {
    const found = await this.accounts.findByHostForSystem(hostId);
    if (found.isNone()) {
      if (HOLDS_A_DEVICE.has(report.state)) {
        this.logger.warn({
          message: 'a host holds a WhatsApp device nobody links; unlinking it',
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
