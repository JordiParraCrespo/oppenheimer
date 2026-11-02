import { CommandBase, type CommandProps } from '@oppenheimer/backend-ddd';
import type { AccessScope } from '../../../authz/domain/access-scope.types';

export class UploadBotAttachmentCommand extends CommandBase {
  readonly scope: AccessScope;
  readonly botId: string;
  readonly file: Buffer;
  /** The file's name as the browser gave it; only shown. */
  readonly name: string;

  constructor(props: CommandProps<UploadBotAttachmentCommand>) {
    super(props);
    this.scope = props.scope;
    this.botId = props.botId;
    this.file = props.file;
    this.name = props.name;
  }
}
