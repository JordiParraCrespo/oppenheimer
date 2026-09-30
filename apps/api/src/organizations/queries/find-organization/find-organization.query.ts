import { QueryBase } from '@oppenheimer/backend-ddd';

export class FindOrganizationQuery extends QueryBase {
  readonly organizationId: string;

  constructor(props: { organizationId: string }) {
    super();
    this.organizationId = props.organizationId;
  }
}
