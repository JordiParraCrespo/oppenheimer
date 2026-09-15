import { Inject } from '@nestjs/common';
import { type IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import type { LeadRepositoryPort } from '../../database/lead.repository.port';
import type { LeadEntity } from '../../domain/lead.entity';
import { LEAD_REPOSITORY } from '../../leads.di-tokens';
import { FindLeadsQuery } from './find-leads.query';

@QueryHandler(FindLeadsQuery)
export class FindLeadsQueryHandler implements IQueryHandler<FindLeadsQuery, LeadEntity[]> {
  constructor(
    @Inject(LEAD_REPOSITORY)
    private readonly leads: LeadRepositoryPort,
  ) {}

  async execute(query: FindLeadsQuery): Promise<LeadEntity[]> {
    return this.leads.findAll(query.scope);
  }
}
