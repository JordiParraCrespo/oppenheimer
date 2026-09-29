import type { IncomingHttpHeaders } from 'node:http';
import { QueryBase } from '@oppenheimer/backend-ddd';

export class CheckSlugQuery extends QueryBase {
  readonly headers: IncomingHttpHeaders;
  readonly slug: string;

  constructor(props: { headers: IncomingHttpHeaders; slug: string }) {
    super();
    this.headers = props.headers;
    this.slug = props.slug;
  }
}
