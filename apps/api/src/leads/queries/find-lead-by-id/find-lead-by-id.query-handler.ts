import { Inject } from '@nestjs/common';
import { type IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { AppError } from '@oppenheimer/backend-core';
import type { LeadRepositoryPort } from '../../database/lead.repository.port';
import type { LeadEntity } from '../../domain/lead.entity';
import { LeadErrors } from '../../domain/lead.errors';
import { LEAD_REPOSITORY } from '../../leads.di-tokens';
import { FindLeadByIdQuery } from './find-lead-by-id.query';

@QueryHandler(FindLeadByIdQuery)
export class FindLeadByIdQueryHandler implements IQueryHandler<FindLeadByIdQuery, LeadEntity> {
  constructor(
    @Inject(LEAD_REPOSITORY)
    private readonly leads: LeadRepositoryPort,
  ) {}

  async execute(query: FindLeadByIdQuery): Promise<LeadEntity> {
    const found = await this.leads.findOneById(query.scope, query.leadId);

    // A lead outside the caller's scope is reported as missing, not forbidden:
    // the scoped read cannot see it, and distinguishing the two would confirm
    // the id exists.
    if (found.isNone()) {
      throw new AppError(LeadErrors.NOT_FOUND, { detail: `No lead with id ${query.leadId}` });
    }

    return found.unwrap();
  }
}
