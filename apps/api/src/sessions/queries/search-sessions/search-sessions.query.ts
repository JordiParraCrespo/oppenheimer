import type { AccessScope } from '@oppenheimer/backend-authz';
import { QueryBase } from '@oppenheimer/backend-ddd';
import type { SessionSearchCriteria } from '../../database/work-session.repository.port';

/**
 * The caller's sessions, searched for words in their names and logs, on any
 * host (`search_sessions`, `product/versions/mvp/25-bots.md` §4.2).
 */
export class SearchSessionsQuery extends QueryBase {
  readonly scope: AccessScope;
  readonly criteria: SessionSearchCriteria;

  constructor(props: { scope: AccessScope } & SessionSearchCriteria) {
    super();
    const { scope, ...criteria } = props;
    this.scope = scope;
    this.criteria = criteria;
  }
}
