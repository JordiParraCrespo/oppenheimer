import { CommandBase, type CommandProps } from '@oppenheimer/backend-ddd';
import type { FlagCondition } from '@oppenheimer/shared/feature-flags';

export class UpdateFlagSegmentCommand extends CommandBase {
  readonly key: string;
  readonly name?: string;
  readonly description?: string | null;
  readonly conditions?: FlagCondition[];
  readonly actorId: string | null;
  readonly comment?: string;

  constructor(props: CommandProps<UpdateFlagSegmentCommand>) {
    super(props);
    this.key = props.key;
    this.name = props.name;
    this.description = props.description;
    this.conditions = props.conditions;
    this.actorId = props.actorId;
    this.comment = props.comment;
  }
}
