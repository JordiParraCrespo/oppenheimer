import { QueryBase } from '@oppenheimer/backend-ddd';
import type { SessionShareViewer } from '../../domain/session-share.entity';

export class FindSharedSessionQuery extends QueryBase {
  readonly slug: string;
  readonly viewer: SessionShareViewer | null;

  constructor(props: { slug: string; viewer: SessionShareViewer | null }) {
    super();
    this.slug = props.slug;
    this.viewer = props.viewer;
  }
}
