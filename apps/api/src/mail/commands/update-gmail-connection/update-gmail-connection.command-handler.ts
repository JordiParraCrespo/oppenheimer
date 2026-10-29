import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { AppError } from '@oppenheimer/backend-core';
import type { AggregateID } from '@oppenheimer/backend-ddd';
import type { GmailConnectionRepositoryPort } from '../../database/gmail-connection.repository.port';
import { MailErrors } from '../../domain/mail.errors';
import { GMAIL_CONNECTION_REPOSITORY } from '../../mail.di-tokens';
import { UpdateGmailConnectionCommand } from './update-gmail-connection.command';

/** Renames one of the caller's Gmail accounts; a blank name falls back to its address. */
@CommandHandler(UpdateGmailConnectionCommand)
export class UpdateGmailConnectionCommandHandler
  implements ICommandHandler<UpdateGmailConnectionCommand, AggregateID>
{
  constructor(
    @Inject(GMAIL_CONNECTION_REPOSITORY)
    private readonly connections: GmailConnectionRepositoryPort,
  ) {}

  async execute({ scope, connectionId, input }: UpdateGmailConnectionCommand): Promise<AggregateID> {
    const found = await this.connections.findOwnById(scope, connectionId);
    if (found.isNone()) throw new AppError(MailErrors.GMAIL_NOT_CONNECTED);
    const connection = found.unwrap();
    connection.rename(input.label);
    await this.connections.save(connection);
    return connection.id;
  }
}
