import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { type AggregateID } from '@oppenheimer/backend-ddd';
import type { LeadRepositoryPort } from '../../database/lead.repository.port';
import { LeadEntity } from '../../domain/lead.entity';
import { LEAD_REPOSITORY } from '../../leads.di-tokens';
import { CreateLeadCommand } from './create-lead.command';

/** Creates a lead inside the caller's active organization. */
@CommandHandler(CreateLeadCommand)
export class CreateLeadCommandHandler implements ICommandHandler<CreateLeadCommand, AggregateID> {
  constructor(
    @Inject(LEAD_REPOSITORY)
    private readonly leads: LeadRepositoryPort,
  ) {}

  async execute(command: CreateLeadCommand): Promise<AggregateID> {
    const lead = LeadEntity.createNew({
      organizationId: command.organizationId,
      teamId: command.teamId,
      ownerId: command.ownerId,
      name: command.name,
      email: command.email,
      value: command.value,
      notes: command.notes,
    });

    await this.leads.insert(lead);
    return lead.id;
  }
}
