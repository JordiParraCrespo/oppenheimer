import { QueryBase } from '@oppenheimer/backend-ddd';

/** An organization as the app last wrote it, for a command to answer with. */
export class FindOrganizationQuery extends QueryBase {
  readonly organizationId: string;

  constructor(props: { organizationId: string }) {
    super();
    this.organizationId = props.organizationId;
  }
}
