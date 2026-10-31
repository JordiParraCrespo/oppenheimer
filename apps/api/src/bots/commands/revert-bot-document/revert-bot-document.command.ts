import { CommandBase, type CommandProps } from '@oppenheimer/backend-ddd';
import type { AccessScope } from '../../../authz/domain/access-scope.types';

export class RevertBotDocumentCommand extends CommandBase {
  readonly scope: AccessScope;
  readonly botId: string;
  readonly name: string;
  /** The revision whose content becomes current again. */
  readonly revision: number;

  constructor(props: CommandProps<RevertBotDocumentCommand>) {
    super(props);
    this.scope = props.scope;
    this.botId = props.botId;
    this.name = props.name;
    this.revision = props.revision;
  }
}
