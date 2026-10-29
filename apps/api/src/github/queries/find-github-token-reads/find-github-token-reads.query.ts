import { QueryBase } from '@oppenheimer/backend-ddd';

/** Every repository the caller's tokens open, and which token reads each now. */
export class FindGithubTokenReadsQuery extends QueryBase {
  readonly userId: string;

  constructor(props: { userId: string }) {
    super();
    this.userId = props.userId;
  }
}
