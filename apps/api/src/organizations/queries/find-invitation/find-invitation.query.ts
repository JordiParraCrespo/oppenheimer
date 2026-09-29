import { QueryBase } from '@oppenheimer/backend-ddd';

/** An invitation as it stands, for a command to answer with. Read from the table, */
export class FindInvitationQuery extends QueryBase {
  readonly invitationId: string;

  constructor(props: { invitationId: string }) {
    super();
    this.invitationId = props.invitationId;
  }
}
