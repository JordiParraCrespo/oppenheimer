import { CommandBase, type CommandProps } from '@oppenheimer/backend-ddd';

/** Flip a flag's master switch — the kill-switch path. */
export class ToggleFeatureFlagCommand extends CommandBase {
  readonly key: string;
  readonly enabled: boolean;
  readonly comment?: string;
  readonly actorId: string | null;

  constructor(props: CommandProps<ToggleFeatureFlagCommand>) {
    super(props);
    this.key = props.key;
    this.enabled = props.enabled;
    this.comment = props.comment;
    this.actorId = props.actorId;
  }
}
