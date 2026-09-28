import { QueryBase } from '@oppenheimer/backend-ddd';

export class FindRolesQuery extends QueryBase {
  readonly page: number;
  readonly limit: number;
  readonly search?: string;
  readonly organizationId?: string | null;

  constructor(props: {
    page: number;
    limit: number;
    search?: string;
    organizationId?: string | null;
  }) {
    super();
    this.page = props.page;
    this.limit = props.limit;
    this.search = props.search;
    this.organizationId = props.organizationId;
  }
}
