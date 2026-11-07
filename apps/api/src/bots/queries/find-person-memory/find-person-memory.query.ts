import type { AccessScope } from '@oppenheimer/backend-authz';
import { QueryBase } from '@oppenheimer/backend-ddd';
import type { PersonAbout } from '../../domain/bot.types';
import type { BotMemoryFactEntity } from '../../domain/bot-memory-fact.entity';

/** What the query answers: the person's own text, and the facts their bots keep about them. */
export interface PersonMemory {
  about: PersonAbout;
  facts: BotMemoryFactEntity[];
}

export class FindPersonMemoryQuery extends QueryBase {
  readonly scope: AccessScope;

  constructor(props: { scope: AccessScope }) {
    super();
    this.scope = props.scope;
  }
}
