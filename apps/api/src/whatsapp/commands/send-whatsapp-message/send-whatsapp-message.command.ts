import type { AccessScope } from '@oppenheimer/backend-authz';
import { CommandBase, type CommandProps } from '@oppenheimer/backend-ddd';

/**
 * A bot's message to one chat of one of its owner's numbers, as its tool
 * resolved it. With `voice` it goes as a voice note saying `text` (the
 * audio spoken from it), through the same checks and the same day's share as
 * a text.
 */
export class SendWhatsappMessageCommand extends CommandBase {
  readonly scope: AccessScope;
  readonly accountId: string;
  readonly chat: { chatId: string; chatKind: 'direct' | 'group'; chatName: string | null };
  readonly text: string;
  readonly botId: string;
  /** The spoken `text`: Ogg/Opus audio and how long it runs. */
  readonly voice?: { audio: Buffer; seconds: number };

  constructor(props: CommandProps<SendWhatsappMessageCommand>) {
    super(props);
    this.scope = props.scope;
    this.accountId = props.accountId;
    this.chat = props.chat;
    this.text = props.text;
    this.botId = props.botId;
    this.voice = props.voice;
  }
}
