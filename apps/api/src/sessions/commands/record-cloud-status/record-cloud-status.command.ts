import { CommandBase, type CommandProps } from '@oppenheimer/backend-ddd';
import type { ReportCloudStatusDto } from '@oppenheimer/shared';
import type { AccessScope } from '../../../authz/domain/access-scope.types';

export class RecordCloudStatusCommand extends CommandBase {
  readonly scope: AccessScope;
  readonly report: ReportCloudStatusDto;

  constructor(props: CommandProps<RecordCloudStatusCommand>) {
    super(props);
    this.scope = props.scope;
    this.report = props.report;
  }
}
