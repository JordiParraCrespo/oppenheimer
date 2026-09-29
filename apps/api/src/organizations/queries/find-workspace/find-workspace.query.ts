import { QueryBase } from '@oppenheimer/backend-ddd';

/** A workspace as the app last wrote it, for a command to answer with. */
export class FindWorkspaceQuery extends QueryBase {
  readonly workspaceId: string;

  constructor(props: { workspaceId: string }) {
    super();
    this.workspaceId = props.workspaceId;
  }
}
