import type { AccessScope } from '@oppenheimer/backend-authz';
import { QueryBase } from '@oppenheimer/backend-ddd';
import type { WhatsappChatTarget } from '../../application/whatsapp-chat.resolver';
import type { WhatsappMessage } from '../../domain/whatsapp-message.types';

export interface WhatsappChatRead {
  accountLabel: string;
  chat: WhatsappChatTarget;
  /** Oldest first, the last `limit` before `before`. */
  messages: WhatsappMessage[];
}

export class ReadWhatsappChatQuery extends QueryBase {
  readonly scope: AccessScope;
  readonly accountId: string;
  /** A chat's id or name, as the bot wrote it. */
  readonly chat: string;
  readonly limit: number;
  readonly before: Date | null;
  /** Resolve the chat only, reading no messages; a phone number names a new chat. */
  readonly targetOnly: boolean;

  constructor(props: {
    scope: AccessScope;
    accountId: string;
    chat: string;
    limit: number;
    before?: Date | null;
    targetOnly?: boolean;
  }) {
    super();
    this.scope = props.scope;
    this.accountId = props.accountId;
    this.chat = props.chat;
    this.limit = props.limit;
    this.before = props.before ?? null;
    this.targetOnly = props.targetOnly ?? false;
  }
}
