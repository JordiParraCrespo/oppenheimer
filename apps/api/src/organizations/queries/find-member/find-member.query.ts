import { QueryBase } from '@oppenheimer/backend-ddd';

/** One membership with the account behind it, for a command to answer with. */
export class FindMemberQuery extends QueryBase {
  readonly organizationId: string;
  readonly memberId: string;

  constructor(props: { organizationId: string; memberId: string }) {
    super();
    this.organizationId = props.organizationId;
    this.memberId = props.memberId;
  }
}
