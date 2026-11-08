import { CommandBase, type CommandProps } from '@oppenheimer/backend-ddd';

/**
 * The bot's owner is back in its chat: resume the routines the spend guard
 * paused while they were away (`26-bot-routines.md` §6).
 */
export class ResumeUnattendedRoutinesCommand extends CommandBase {
  readonly organizationId: string;
  readonly botId: string;

  constructor(props: CommandProps<ResumeUnattendedRoutinesCommand>) {
    super(props);
    this.organizationId = props.organizationId;
    this.botId = props.botId;
  }
}
