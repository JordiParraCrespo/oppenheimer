import { DomainEvent, type DomainEventProps } from '@oppenheimer/backend-ddd';
import type { BotRoutineActivity } from '@oppenheimer/shared';

/**
 * Raised when one of a bot's routines is saved, changed, paused, resumed or
 * deleted, whatever path made the change (its bot's tool, its Routines tab, a
 * system pause), so its bot's chat can say so once (`26-bot-routines.md` §4,
 * "In the chat"). Session automations raise nothing here.
 */
export class BotRoutineChangedDomainEvent extends DomainEvent {
  readonly organizationId: string;
  readonly botId: string;
  /** The routine's name at the time. */
  readonly name: string;
  readonly activity: Extract<
    BotRoutineActivity,
    'saved' | 'changed' | 'paused' | 'resumed' | 'deleted'
  >;
  /** Why a system pause happened, as a paused reason; null otherwise. */
  readonly pausedReason: string | null;

  constructor(props: DomainEventProps<BotRoutineChangedDomainEvent>) {
    super(props);
    this.organizationId = props.organizationId;
    this.botId = props.botId;
    this.name = props.name;
    this.activity = props.activity;
    this.pausedReason = props.pausedReason;
  }
}
