import type { IncomingHttpHeaders } from 'node:http';
import { QueryBase } from '@oppenheimer/backend-ddd';
import type { ResourceScope } from '@oppenheimer/shared';

export class ListMyWorkspacesQuery extends QueryBase {
  readonly headers: IncomingHttpHeaders;
  readonly resourceScope: ResourceScope | null | undefined;

  constructor(props: {
    headers: IncomingHttpHeaders;
    resourceScope: ResourceScope | null | undefined;
  }) {
    super();
    this.headers = props.headers;
    this.resourceScope = props.resourceScope;
  }
}
