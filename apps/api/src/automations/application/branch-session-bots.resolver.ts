import { Injectable } from '@nestjs/common';
import { QueryBus } from '@nestjs/cqrs';
import { FindBranchSessionBotsQuery } from '../../sessions/queries/find-branch-session-bots/find-branch-session-bots.query';

/** What an event names, for the question: its workspace, its repository and its attributes. */
export interface BranchEvent {
  organizationId: string;
  /** GitHub's repository id: a GitHub event's subject. */
  subjectRef: string;
  attributes: Record<string, unknown>;
}

/**
 * The bots whose sessions are on an event's branch, for `ownSessionGuard`:
 * a session opens its pull request and pushes as the owner, so the branch is
 * what says it was a bot's. Asked of the sessions on the bus, once per event,
 * and only when a routine is among the matches. An event with no branch (a
 * comment, a label, a mention) has none.
 */
@Injectable()
export class BranchSessionBotsResolver {
  constructor(private readonly queries: QueryBus) {}

  async of(event: BranchEvent, anyRoutine: boolean): Promise<ReadonlySet<string>> {
    const branch = event.attributes.branch;
    if (!anyRoutine || typeof branch !== 'string' || branch === '') return new Set();
    const bots = await this.queries.execute<FindBranchSessionBotsQuery, string[]>(
      new FindBranchSessionBotsQuery({
        organizationId: event.organizationId,
        githubRepoId: event.subjectRef,
        branch,
      }),
    );
    return new Set(bots);
  }
}
