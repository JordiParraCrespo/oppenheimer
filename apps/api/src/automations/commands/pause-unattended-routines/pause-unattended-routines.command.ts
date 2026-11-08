import { CommandBase, type CommandProps } from '@oppenheimer/backend-ddd';

/**
 * Pause every running routine of a bot whose owner is away (the spend guard,
 * `26-bot-routines.md` §6). Raised by the system, never a person: the first
 * routine the guard stopped is already paused, and this stops the rest.
 */
export class PauseUnattendedRoutinesCommand extends CommandBase {
  readonly organizationId: string;
  readonly botId: string;

  constructor(props: CommandProps<PauseUnattendedRoutinesCommand>) {
    super(props);
    this.organizationId = props.organizationId;
    this.botId = props.botId;
  }
}
