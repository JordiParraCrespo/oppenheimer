import type { AccessScope } from '@oppenheimer/backend-authz';
import { QueryBase } from '@oppenheimer/backend-ddd';
import type { TriggerPreviewDto } from '@oppenheimer/shared';

export class PreviewTriggerQuery extends QueryBase {
  readonly scope: AccessScope;
  readonly input: TriggerPreviewDto;

  constructor(props: { scope: AccessScope; input: TriggerPreviewDto }) {
    super();
    this.scope = props.scope;
    this.input = props.input;
  }
}
