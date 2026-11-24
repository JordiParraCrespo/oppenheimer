import { CommandBase, type CommandProps } from '@oppenheimer/backend-ddd';
import type { CheckBack } from '../../infrastructure/bot-check-backs.port';

/**
 * Wake a bot for a look it asked for with `check_back`, now that its time
 * came; dispatched by the `bot-check-backs` worker with the look its job
 * carries.
 */
export class WakeOnCheckBackCommand extends CommandBase {
  readonly look: CheckBack;

  constructor(props: CommandProps<WakeOnCheckBackCommand>) {
    super(props);
    this.look = props.look;
  }
}
