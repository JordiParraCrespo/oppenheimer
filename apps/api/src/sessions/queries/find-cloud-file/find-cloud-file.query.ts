import { QueryBase } from '@oppenheimer/backend-ddd';

/** The file a cloud session's link names, by the link's token. */
export class FindCloudFileQuery extends QueryBase {
  readonly token: string;

  constructor(props: { token: string }) {
    super();
    this.token = props.token;
  }
}
