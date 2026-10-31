import { QueryBase } from '@oppenheimer/backend-ddd';
import type { TriggerPreviewDto } from '@oppenheimer/shared';
import type { AccessScope } from '../../../authz/domain/access-scope.types';

export class PreviewTriggerQuery extends QueryBase {
  readonly scope: AccessScope;
  readonly input: TriggerPreviewDto;

  constructor(props: { scope: AccessScope; input: TriggerPreviewDto }) {
    super();
    this.scope = props.scope;
    this.input = props.input;
  }
}
