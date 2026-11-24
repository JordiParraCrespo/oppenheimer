import { Injectable } from '@nestjs/common';
import { QueryBus } from '@nestjs/cqrs';
import { FindBranchSessionBotsQuery } from '../../sessions/queries/find-branch-session-bots/find-branch-session-bots.query';

/** What an event names, for the question: its workspace, its repository and its attributes. */
export interface BranchEvent {
  organizationId: string;
  /** GitHub's repository id: a GitHub event's subject. */
  subjectRef: string;
  /** The repository's `owner/name`, which a cloud session's run is matched by. */
  subjectName: string;
  attributes: Record<string, unknown>;
}

/**
 * The bots whose sessions are on an event's branch, for `ownSessionGuard`:
 * a session opens its pull request and pushes as the owner, so the branch is
 * what says it was a bot's. Asked of the sessions on the bus, once per event,
 * and only when a routine is among the matches. An event with no branch (a
 * comment, a label, a mention) has none, and so does a pull request whose
 * head lives in another repository: its branch is that repository's, while
 * the event names the base, and a bot's session pushes to the base. A head
 * whose repository is gone has no id, and counts as another. `fork` is not
 * the test: it is also true for a pull request inside a repository that is
 * itself a fork, which is where the owner's sessions push.
 */
@Injectable()
export class BranchSessionBotsResolver {
  constructor(private readonly queries: QueryBus) {}

  async of(event: BranchEvent, anyRoutine: boolean): Promise<ReadonlySet<string>> {
    const { branch } = event.attributes;
    if (!anyRoutine || fromAnotherRepository(event) || typeof branch !== 'string' || !branch) {
      return new Set();
    }
    const bots = await this.queries.execute<FindBranchSessionBotsQuery, string[]>(
      new FindBranchSessionBotsQuery({
        organizationId: event.organizationId,
        githubRepoId: event.subjectRef,
        repositoryFullName: event.subjectName,
        branch,
      }),
    );
    return new Set(bots);
  }
}

/** A pull request's head in another repository than the event's; other events name none. */
function fromAnotherRepository(event: BranchEvent): boolean {
  if (!('headRepoId' in event.attributes)) return false;
  const { headRepoId } = event.attributes;
  return headRepoId === null || String(headRepoId) !== event.subjectRef;
}
