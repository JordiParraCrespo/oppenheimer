import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import type { WhatsappDevicePort } from '../../application/whatsapp-device.port';
import type { WhatsappAccountRepositoryPort } from '../../database/whatsapp-account.repository.port';
import { WHATSAPP_ACCOUNT_REPOSITORY, WHATSAPP_DEVICE } from '../../whatsapp.di-tokens';
import { RemoveWhatsappAccountCommand } from './remove-whatsapp-account.command';

/**
 * Unlinks one of the caller's numbers: asks its host to log the device out
 * of WhatsApp and delete its keys, and forgets the number and its messages.
 * A host that is offline is told when it next reports a device the control
 * plane no longer knows (`RecordWhatsappStateCommandHandler`). An id that is
 * not one of the caller's does nothing.
 */
@CommandHandler(RemoveWhatsappAccountCommand)
export class RemoveWhatsappAccountCommandHandler
  implements ICommandHandler<RemoveWhatsappAccountCommand, void>
{
  constructor(
    @Inject(WHATSAPP_DEVICE)
    private readonly device: WhatsappDevicePort,
    @Inject(WHATSAPP_ACCOUNT_REPOSITORY)
    private readonly accounts: WhatsappAccountRepositoryPort,
  ) {}

  async execute({ scope, accountId }: RemoveWhatsappAccountCommand): Promise<void> {
    const found = await this.accounts.findOwnById(scope, accountId);
    if (found.isNone()) return;
    const account = found.unwrap();
    this.device.unlink(account.hostId);
    await this.accounts.delete(account);
  }
}
