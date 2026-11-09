import type { AccessScope } from '@oppenheimer/backend-authz';
import { CommandBase, type CommandProps } from '@oppenheimer/backend-ddd';

/** A bot's message to one chat of one of its owner's Telegram bots, as its tool resolved it. */
export class SendTelegramMessageCommand extends CommandBase {
  readonly scope: AccessScope;
  readonly accountId: string;
  readonly chat: { chatId: string; chatKind: 'direct' | 'group'; chatName: string | null };
  readonly text: string;
  /** A message of that chat to reply to. */
  readonly replyToId: string | null;
  readonly botId: string;

  constructor(props: CommandProps<SendTelegramMessageCommand>) {
    super(props);
    this.scope = props.scope;
    this.accountId = props.accountId;
    this.chat = props.chat;
    this.text = props.text;
    this.replyToId = props.replyToId;
    this.botId = props.botId;
  }
}
