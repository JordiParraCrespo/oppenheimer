import { QueryBase } from '@oppenheimer/backend-ddd';
import type { AccessScope } from '../../../authz/domain/access-scope.types';

/** A page of the drafts in one of the caller's Gmail accounts. */
export class FindMailDraftsQuery extends QueryBase {
  readonly scope: AccessScope;
  readonly connectionId: string;
  readonly maxResults: number;
  readonly pageToken: string | null;

  constructor(props: {
    scope: AccessScope;
    connectionId: string;
    maxResults: number;
    pageToken: string | null;
  }) {
    super();
    this.scope = props.scope;
    this.connectionId = props.connectionId;
    this.maxResults = props.maxResults;
    this.pageToken = props.pageToken;
  }
}
