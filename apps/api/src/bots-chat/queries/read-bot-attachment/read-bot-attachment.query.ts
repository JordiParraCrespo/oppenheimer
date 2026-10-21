import type { AccessScope } from '@oppenheimer/backend-authz';
import { QueryBase } from '@oppenheimer/backend-ddd';

export class ReadBotAttachmentQuery extends QueryBase {
  constructor(
    readonly scope: AccessScope,
    readonly botId: string,
    readonly attachmentId: string,
  ) {
    super();
  }
}
