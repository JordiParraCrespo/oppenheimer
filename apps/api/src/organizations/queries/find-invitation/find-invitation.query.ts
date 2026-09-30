import { QueryBase } from '@oppenheimer/backend-ddd';

export class FindInvitationQuery extends QueryBase {
  readonly invitationId: string;

  constructor(props: { invitationId: string }) {
    super();
    this.invitationId = props.invitationId;
  }
}
