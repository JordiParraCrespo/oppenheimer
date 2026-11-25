import { QueryBase } from '@oppenheimer/backend-ddd';

/** Whether a workspace's bot can speak a voice note: some synthesis provider is available to it. */
export class FindSpeechSynthesisQuery extends QueryBase {
  constructor(readonly organizationId: string) {
    super();
  }
}
