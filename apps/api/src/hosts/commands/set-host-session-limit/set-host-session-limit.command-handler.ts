import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { AppError } from '@oppenheimer/backend-core';
import type { AggregateID } from '@oppenheimer/backend-ddd';
import type { HostRepositoryPort } from '../../database/host.repository.port';
import { HostErrors } from '../../domain/hosts.errors';
import { HOST_REPOSITORY } from '../../hosts.di-tokens';
import { SetHostSessionLimitCommand } from './set-host-session-limit.command';

/**
 * A gate on what starts next, never on what runs: lowering the limit below
 * what is running stops nothing, it only refuses the next start until enough
 * have stopped. The runner is not told; the control plane is what refuses.
 */
@CommandHandler(SetHostSessionLimitCommand)
export class SetHostSessionLimitCommandHandler
  implements ICommandHandler<SetHostSessionLimitCommand, AggregateID>
{
  constructor(
    @Inject(HOST_REPOSITORY)
    private readonly hosts: HostRepositoryPort,
  ) {}

  async execute(command: SetHostSessionLimitCommand): Promise<AggregateID> {
    const found = await this.hosts.findOneById(command.scope, command.hostId);
    if (found.isNone() || found.unwrap().isUnpaired) {
      throw new AppError(HostErrors.NOT_FOUND, { detail: `No host with id ${command.hostId}` });
    }

    const host = found.unwrap();
    host.limitSessions(command.maxSessions);
    await this.hosts.save(host);

    return host.id;
  }
}
