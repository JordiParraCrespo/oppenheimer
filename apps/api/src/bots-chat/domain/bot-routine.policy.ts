import { BotMessageEntity } from './bot-message.entity';
import { BotTurnEntity } from './bot-turn.entity';

/** What fired, as a routine's turn opens with it (`26-bot-routines.md` §4). */
export interface RoutineFiring {
  automationId: string;
  runId: string;
  name: string;
  /**
   * The routine's prompt, with the event that fired it appended as untrusted
   * data when an event did (automations' `composeRunPrompt`).
   */
  instructions: string;
}

/**
 * The key that makes a routine's run one turn: a run dispatched twice finds
 * the turn the first dispatch queued. It names the routine first, so the
 * routine's live turns are found by prefix.
 */
export function routineSourceKey(automationId: string, runId: string): string {
  return `${routinePrefix(automationId)}${runId}`;
}

/** Every turn of one routine's runs begins with this. */
export function routinePrefix(automationId: string): string {
  return `automation-run:${automationId}:`;
}

/** The words the bot reads when a routine fires: which one, then what it says to do. */
export function routineOpening(firing: RoutineFiring): string {
  return [
    `Your routine "${firing.name}" is running now, on its own: nobody wrote to you.`,
    'Do what it says, then report briefly what you did or found. If there is nothing worth saying, say so in one line.',
    '',
    firing.instructions,
  ].join('\n');
}

/**
 * A routine's turn: queued like a message of yours, on the bot's provider,
 * model and effort as they are now, opened by an event line that names the
 * routine, keyed so the run queues it once.
 */
export function routineTurn(
  props: Omit<Parameters<typeof BotTurnEntity.queue>[0], 'origin' | 'sourceKey'>,
  firing: RoutineFiring,
): { turn: BotTurnEntity; opening: BotMessageEntity } {
  const turn = BotTurnEntity.queue({
    ...props,
    origin: 'routine',
    sourceKey: routineSourceKey(firing.automationId, firing.runId),
  });
  const opening = BotMessageEntity.createNew({
    organizationId: props.organizationId,
    botId: props.botId,
    turnId: turn.id,
    role: 'event',
    content: routineOpening(firing),
    event: {
      kind: 'routine',
      automationId: firing.automationId,
      runId: firing.runId,
      name: firing.name,
    },
    steps: [],
    position: 0,
  });
  return { turn, opening };
}
