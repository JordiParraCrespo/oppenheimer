import { QueryBase } from '@oppenheimer/backend-ddd';

export class FindApiTokensQuery extends QueryBase {
  readonly userId: string;

  constructor(props: { userId: string }) {
    super();
    this.userId = props.userId;
  }
}
