import { QueryBase } from '@oppenheimer/backend-ddd';
import type { FlagChangeSubject } from '../../domain/events/flag-configuration-changed.domain-event';

/** The audit trail, newest first, optionally narrowed to one flag or segment. */
export class FindFlagChangesQuery extends QueryBase {
  readonly subjectType?: FlagChangeSubject;
  readonly subjectKey?: string;
  readonly page: number;
  readonly limit: number;

  constructor(props: {
    subjectType?: FlagChangeSubject;
    subjectKey?: string;
    page: number;
    limit: number;
  }) {
    super();
    this.subjectType = props.subjectType;
    this.subjectKey = props.subjectKey;
    this.page = props.page;
    this.limit = props.limit;
  }
}
