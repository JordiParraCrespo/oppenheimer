import { CommandBase, type CommandProps } from '@oppenheimer/backend-ddd';
import type { FlagRule, FlagServe } from '@oppenheimer/shared/feature-flags';

/** Replace a flag's whole targeting on this deployment. */
export class UpdateFeatureFlagCommand extends CommandBase {
  readonly key: string;
  readonly enabled: boolean;
  readonly rules: FlagRule[];
  readonly fallthrough: FlagServe;
  readonly comment?: string;
  readonly actorId: string | null;

  constructor(props: CommandProps<UpdateFeatureFlagCommand>) {
    super(props);
    this.key = props.key;
    this.enabled = props.enabled;
    this.rules = props.rules;
    this.fallthrough = props.fallthrough;
    this.comment = props.comment;
    this.actorId = props.actorId;
  }
}
