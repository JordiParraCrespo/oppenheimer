import type { IncomingHttpHeaders } from 'node:http';
import { QueryBase } from '@oppenheimer/backend-ddd';
import type { ResourceScope } from '@oppenheimer/shared';

export class ListOrganizationsQuery extends QueryBase {
  readonly headers: IncomingHttpHeaders;
  readonly activeOrganizationId: string | null | undefined;
  readonly resourceScope: ResourceScope | null | undefined;

  constructor(props: {
    headers: IncomingHttpHeaders;
    activeOrganizationId: string | null | undefined;
    resourceScope: ResourceScope | null | undefined;
  }) {
    super();
    this.headers = props.headers;
    this.activeOrganizationId = props.activeOrganizationId;
    this.resourceScope = props.resourceScope;
  }
}
