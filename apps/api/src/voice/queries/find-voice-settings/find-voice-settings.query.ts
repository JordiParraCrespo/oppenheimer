import { QueryBase } from '@oppenheimer/backend-ddd';

export class FindVoiceSettingsQuery extends QueryBase {
  constructor(readonly organizationId: string) {
    super();
  }
}
