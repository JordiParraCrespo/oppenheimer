import { CommandBase, type CommandProps } from '@oppenheimer/backend-ddd';
import type { AccessScope } from '../../../authz/domain/access-scope.types';
import type { PullRequestAddress } from '../../../github/application/pull-request-access.port';
import type { CiFindingProps } from '../../domain/ci-finding.entity';

/** One finding as it is recorded: everything but where it is filed and who filed it. */
export type CiFindingInput = Pick<
  CiFindingProps,
  'check' | 'rootCause' | 'relation' | 'flake' | 'action' | 'next' | 'confidence' | 'evidence'
>;

export class RecordCiFindingsCommand extends CommandBase {
  readonly scope: AccessScope;
  readonly address: PullRequestAddress;
  readonly findings: readonly CiFindingInput[];
  /** The bot that made the call, when a bot did. */
  readonly botId: string | null;

  constructor(props: CommandProps<RecordCiFindingsCommand>) {
    super(props);
    this.scope = props.scope;
    this.address = props.address;
    this.findings = props.findings;
    this.botId = props.botId;
  }
}
