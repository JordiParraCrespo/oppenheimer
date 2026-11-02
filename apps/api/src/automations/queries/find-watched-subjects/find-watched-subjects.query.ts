import { QueryBase } from '@oppenheimer/backend-ddd';
import type { ExternalTriggerSource } from '@oppenheimer/shared/automations';

/**
 * What a polled source must watch (`next-steps/mail.md` §5): every subject a
 * live trigger of that source listens on, with the filters those triggers
 * narrow by. A system read, for the poll, which has no caller.
 */
export class FindWatchedSubjectsQuery extends QueryBase {
  readonly source: ExternalTriggerSource;

  constructor(props: { source: ExternalTriggerSource }) {
    super();
    this.source = props.source;
  }
}
