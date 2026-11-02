import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import type { AccessScope } from '@oppenheimer/backend-authz';
import { AppError } from '@oppenheimer/backend-core';
import type { AggregateID } from '@oppenheimer/backend-ddd';
import { WHATSAPP_ACCOUNTS_MAX } from '@oppenheimer/shared';
import type { HostAccessPort } from '../../../hosts/application/host-access.port';
import { HOST_ACCESS } from '../../../hosts/hosts.di-tokens';
import type { WhatsappDevicePort } from '../../application/whatsapp-device.port';
import type { WhatsappAccountRepositoryPort } from '../../database/whatsapp-account.repository.port';
import { WhatsappErrors } from '../../domain/whatsapp.errors';
import { WhatsappAccountEntity } from '../../domain/whatsapp-account.entity';
import { WHATSAPP_ACCOUNT_REPOSITORY, WHATSAPP_DEVICE } from '../../whatsapp.di-tokens';
import { LinkWhatsappCommand } from './link-whatsapp.command';

/** The states in which the host holds no device to keep, so a pairing can start. */
const PAIRABLE = new Set(['pairing', 'logged_out', 'unlinked']);

/**
 * Links a number on one of the caller's hosts (`whatsapp.md` §1): asks the
 * host's runner to pair a new device, whose QR codes come back as the host's
 * `whatsapp.state` reports. The caller's number already on that host is
 * paired again, keeping its row and its messages; one that is connected is
 * left as it is. A host holds one device, so another person's number there
 * refuses.
 */
@CommandHandler(LinkWhatsappCommand)
export class LinkWhatsappCommandHandler
  implements ICommandHandler<LinkWhatsappCommand, AggregateID>
{
  constructor(
    @Inject(HOST_ACCESS)
    private readonly hosts: HostAccessPort,
    @Inject(WHATSAPP_DEVICE)
    private readonly device: WhatsappDevicePort,
    @Inject(WHATSAPP_ACCOUNT_REPOSITORY)
    private readonly accounts: WhatsappAccountRepositoryPort,
  ) {}

  async execute({ scope, hostId, label }: LinkWhatsappCommand): Promise<AggregateID> {
    const organizationId = scope.organizationId;
    if (!organizationId) throw new AppError(WhatsappErrors.NO_ACTIVE_ORGANIZATION);
    await this.hosts.assertUsable(scope, hostId);
    const reach = this.device.reach(hostId);
    if (reach === 'offline') throw new AppError(WhatsappErrors.HOST_OFFLINE);
    if (reach === 'unsupported') throw new AppError(WhatsappErrors.HOST_UNSUPPORTED);

    const account = await this.accountFor(scope, organizationId, hostId, label);
    if (!PAIRABLE.has(account.status)) return account.id;
    if (!this.device.link(hostId)) throw new AppError(WhatsappErrors.HOST_OFFLINE);
    return account.id;
  }

  private async accountFor(
    scope: AccessScope,
    organizationId: string,
    hostId: string,
    label: string | undefined,
  ): Promise<WhatsappAccountEntity> {
    const found = await this.accounts.findByHostForSystem(hostId);
    if (found.isSome()) {
      const account = found.unwrap();
      if (account.userId !== scope.userId || account.organizationId !== organizationId) {
        throw new AppError(WhatsappErrors.HOST_TAKEN);
      }
      if (PAIRABLE.has(account.status)) {
        account.repair(label);
        await this.accounts.save(account);
      }
      return account;
    }
    const own = await this.accounts.findAllOwn(scope);
    if (own.length >= WHATSAPP_ACCOUNTS_MAX) {
      throw new AppError(WhatsappErrors.ACCOUNT_LIMIT_REACHED, {
        detail: `A person links at most ${WHATSAPP_ACCOUNTS_MAX} numbers.`,
      });
    }
    const account = WhatsappAccountEntity.link({
      organizationId,
      userId: scope.userId,
      hostId,
      label: label ?? '',
    });
    await this.accounts.insert(account);
    return account;
  }
}
