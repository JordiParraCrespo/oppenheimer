import type { InboxMark } from '@oppenheimer/shared/schemas/inbox';

export type { InboxMark };

/**
 * What a person did to one occurrence in the Inbox
 * (`product/versions/mvp/28-inbox.md` §3): the only thing it stores. The
 * items themselves are read from their sources every time.
 */
export class InboxMarkEntity {
  constructor(
    /** The occurrence: `session:<id>:<wait>`, `approval:<id>`, `pull:<repoId>#<number>@<sha>`, `run:<id>`. */
    public readonly itemKey: string,
    public readonly mark: InboxMark,
    /** When a snooze ends; null for every other mark. */
    public readonly until: Date | null,
    public readonly updatedAt: Date,
  ) {}

  /** Whether it still holds at `now`: a snooze whose end has passed does not. */
  inForce(now: number): boolean {
    return this.mark !== 'snoozed' || (this.until !== null && this.until.getTime() > now);
  }
}
