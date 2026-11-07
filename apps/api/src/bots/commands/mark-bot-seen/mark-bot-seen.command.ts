import type { AccessScope } from '@oppenheimer/backend-authz';
import { CommandBase, type CommandProps } from '@oppenheimer/backend-ddd';

/**
 * The owner is in a bot's chat (`26-bot-routines.md` §6): they opened it,
 * wrote to it or decided one of its cards. It is what the spend guard counts
 * from, and what starts again the routines it paused while they were away.
 */
export class MarkBotSeenCommand extends CommandBase {
  readonly scope: AccessScope;
  readonly botId: string;

  constructor(props: CommandProps<MarkBotSeenCommand>) {
    super(props);
    this.scope = props.scope;
    this.botId = props.botId;
  }
}
