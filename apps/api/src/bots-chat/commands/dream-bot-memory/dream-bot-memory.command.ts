import { CommandBase, type CommandProps } from '@oppenheimer/backend-ddd';

/** Dream a bot's memory; dispatched by the `bot-dreams` worker. `force`: its owner asked. */
export class DreamBotMemoryCommand extends CommandBase {
  readonly organizationId: string;
  readonly botId: string;
  readonly force: boolean;

  constructor(props: CommandProps<DreamBotMemoryCommand>) {
    super(props);
    this.organizationId = props.organizationId;
    this.botId = props.botId;
    this.force = props.force;
  }
}
