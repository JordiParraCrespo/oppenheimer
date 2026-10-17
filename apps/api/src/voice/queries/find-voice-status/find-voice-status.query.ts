import { QueryBase } from '@oppenheimer/backend-ddd';

export class FindVoiceStatusQuery extends QueryBase {
  constructor(readonly organizationId: string | null) {
    super();
  }
}
