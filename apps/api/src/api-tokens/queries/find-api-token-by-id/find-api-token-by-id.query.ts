import { QueryBase } from '@oppenheimer/backend-ddd';

/** Scoped to an owner so one user cannot read another's token. */
export class FindApiTokenByIdQuery extends QueryBase {
  readonly tokenId: string;
  readonly userId: string;

  constructor(props: { tokenId: string; userId: string }) {
    super();
    this.tokenId = props.tokenId;
    this.userId = props.userId;
  }
}
