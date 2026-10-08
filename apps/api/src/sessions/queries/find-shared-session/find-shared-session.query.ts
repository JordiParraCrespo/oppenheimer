import { QueryBase } from '@oppenheimer/backend-ddd';
import type { ShareLinkViewer } from '../../domain/session-share-link.entity';

export class FindSharedSessionQuery extends QueryBase {
  readonly token: string;
  readonly viewer: ShareLinkViewer | null;

  constructor(props: { token: string; viewer: ShareLinkViewer | null }) {
    super();
    this.token = props.token;
    this.viewer = props.viewer;
  }
}
