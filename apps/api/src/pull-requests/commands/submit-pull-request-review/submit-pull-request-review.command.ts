import type { AccessScope } from '@oppenheimer/backend-authz';
import { CommandBase, type CommandProps } from '@oppenheimer/backend-ddd';
import type { SubmitPullRequestReviewDto } from '@oppenheimer/shared';
import type { PullRequestAddress } from '../../../github/application/pull-request-access.port';

export class SubmitPullRequestReviewCommand extends CommandBase {
  readonly scope: AccessScope;
  readonly address: PullRequestAddress;
  readonly review: SubmitPullRequestReviewDto;

  constructor(props: CommandProps<SubmitPullRequestReviewCommand>) {
    super(props);
    this.scope = props.scope;
    this.address = props.address;
    this.review = props.review;
  }
}
