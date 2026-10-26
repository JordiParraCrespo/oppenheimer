import { QueryBase } from '@oppenheimer/backend-ddd';

/** The caller's own GitHub tokens, oldest first; one when `tokenId` names it. */
export class FindGithubTokensQuery extends QueryBase {
  readonly userId: string;
  readonly tokenId: string | null;

  constructor(props: { userId: string; tokenId?: string }) {
    super();
    this.userId = props.userId;
    this.tokenId = props.tokenId ?? null;
  }
}
