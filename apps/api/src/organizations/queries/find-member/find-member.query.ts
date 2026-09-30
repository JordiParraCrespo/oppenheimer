import { QueryBase } from '@oppenheimer/backend-ddd';

export class FindMemberQuery extends QueryBase {
  readonly organizationId: string;
  readonly memberId: string;

  constructor(props: { organizationId: string; memberId: string }) {
    super();
    this.organizationId = props.organizationId;
    this.memberId = props.memberId;
  }
}
