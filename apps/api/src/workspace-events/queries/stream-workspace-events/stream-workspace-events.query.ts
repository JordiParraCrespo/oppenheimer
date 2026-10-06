import { QueryBase } from '@oppenheimer/backend-ddd';
import type { WorkspaceEventType } from '@oppenheimer/shared/workspace-events';

/**
 * The changes one console tab may see: its workspace's and its person's
 * hosts', narrowed to the kinds the caller may read.
 */
export class StreamWorkspaceEventsQuery extends QueryBase {
  readonly userId: string;
  readonly organizationId: string | null;
  readonly types: ReadonlySet<WorkspaceEventType>;

  constructor(props: {
    userId: string;
    organizationId: string | null;
    types: ReadonlySet<WorkspaceEventType>;
  }) {
    super();
    this.userId = props.userId;
    this.organizationId = props.organizationId;
    this.types = props.types;
  }
}
