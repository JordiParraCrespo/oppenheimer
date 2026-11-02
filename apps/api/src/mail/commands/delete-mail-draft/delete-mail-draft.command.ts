import { CommandBase, type CommandProps } from '@oppenheimer/backend-ddd';
import type { AccessScope } from '../../../authz/domain/access-scope.types';

/** Deletes a draft from the caller's Gmail; a sent message is never touched. */
export class DeleteMailDraftCommand extends CommandBase {
  readonly scope: AccessScope;
  readonly connectionId: string;
  readonly draftId: string;

  constructor(props: CommandProps<DeleteMailDraftCommand>) {
    super(props);
    this.scope = props.scope;
    this.connectionId = props.connectionId;
    this.draftId = props.draftId;
  }
}
