import { QueryBase } from '@oppenheimer/backend-ddd';

/**
 * Which bot an automation wakes, and its name: what a bot's chat needs to say
 * a run of one of its routines failed. A system read, for a listener that has
 * an automation's id from its event and no caller.
 */
export class FindBotRoutineRefQuery extends QueryBase {
  readonly automationId: string;

  constructor(props: { automationId: string }) {
    super();
    this.automationId = props.automationId;
  }
}
