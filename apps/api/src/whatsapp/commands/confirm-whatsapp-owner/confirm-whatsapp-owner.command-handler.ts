import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { AppError } from '@oppenheimer/backend-core';
import type { AggregateID } from '@oppenheimer/backend-ddd';
import type { WhatsappAccountRepositoryPort } from '../../database/whatsapp-account.repository.port';
import { WhatsappErrors } from '../../domain/whatsapp.errors';
import { WHATSAPP_ACCOUNT_REPOSITORY } from '../../whatsapp.di-tokens';
import { ConfirmWhatsappOwnerCommand } from './confirm-whatsapp-owner.command';

/**
 * The code the owner's number received, entered in Settings
 * (`product/next-steps/answering-on-telegram-and-whatsapp.md` §1): the
 * waiting one, in time and within its tries, makes that number the owner,
 * the only one the linked number answers. Typed in the console, a code sent
 * to a mistyped number is useless to whoever got it. The write is
 * conditional on the code checked, so an entry that raced a new code, or
 * the tries running out, changes nothing and is refused as that.
 */
@CommandHandler(ConfirmWhatsappOwnerCommand)
export class ConfirmWhatsappOwnerCommandHandler
  implements ICommandHandler<ConfirmWhatsappOwnerCommand, AggregateID>
{
  constructor(
    @Inject(WHATSAPP_ACCOUNT_REPOSITORY)
    private readonly accounts: WhatsappAccountRepositoryPort,
  ) {}

  async execute({ scope, accountId, code }: ConfirmWhatsappOwnerCommand): Promise<AggregateID> {
    const found = await this.accounts.findOwnById(scope, accountId);
    if (found.isNone()) {
      throw new AppError(WhatsappErrors.ACCOUNT_NOT_FOUND, { extensions: { accountId } });
    }
    const account = found.unwrap();
    const usedCodeHash = account.ownerCodeHash;
    const outcome = account.confirmOwner(code, new Date());
    if (outcome === 'none' || !usedCodeHash) {
      throw new AppError(WhatsappErrors.OWNER_CODE_NONE, {
        detail: 'Name your own number first; a code is sent to it.',
      });
    }
    if (outcome === 'locked') throw lockedError();
    if (outcome === 'expired') {
      throw new AppError(WhatsappErrors.OWNER_CODE_INVALID, {
        detail: 'The code has expired: ask for a new one.',
      });
    }
    const landed = await this.accounts.saveOwner(account, usedCodeHash);
    if (outcome === 'wrong') {
      if (!landed) throw lockedError();
      throw new AppError(WhatsappErrors.OWNER_CODE_INVALID, {
        detail: 'That is not the code sent to your number.',
      });
    }
    if (!landed) {
      throw new AppError(WhatsappErrors.OWNER_CODE_INVALID, {
        detail: 'A newer code was asked for, or the tries ran out: use the latest code.',
      });
    }
    return account.id;
  }
}

function lockedError(): AppError {
  return new AppError(WhatsappErrors.OWNER_CODE_LOCKED, {
    detail: 'Ask for a new code to try again.',
  });
}
