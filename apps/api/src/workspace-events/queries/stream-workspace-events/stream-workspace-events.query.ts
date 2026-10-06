import { QueryBase } from '@oppenheimer/backend-ddd';

/** The changes one console tab may see: its workspace's, and its person's hosts'. */
export class StreamWorkspaceEventsQuery extends QueryBase {
  readonly userId: string;
  readonly organizationId: string | null;

  constructor(props: { userId: string; organizationId: string | null }) {
    super();
    this.userId = props.userId;
    this.organizationId = props.organizationId;
  }
}
