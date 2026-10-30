import { Inject } from '@nestjs/common';
import { type IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { AUTOMATION_REPOSITORY } from '../../automations.di-tokens';
import type { AutomationRepositoryPort } from '../../database/automation.repository.port';
import type { WatchedSubject } from '../../domain/automation-read.types';
import { FindWatchedSubjectsQuery } from './find-watched-subjects.query';

/** The subjects live, unpaused triggers of a source listen on, each with their filter values. */
@QueryHandler(FindWatchedSubjectsQuery)
export class FindWatchedSubjectsQueryHandler
  implements IQueryHandler<FindWatchedSubjectsQuery, WatchedSubject[]>
{
  constructor(
    @Inject(AUTOMATION_REPOSITORY)
    private readonly automations: AutomationRepositoryPort,
  ) {}

  execute({ source }: FindWatchedSubjectsQuery): Promise<WatchedSubject[]> {
    return this.automations.findWatchedSubjects(source);
  }
}
