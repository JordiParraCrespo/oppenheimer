import { type TriggerInputDto, triggerInputSchema } from '@oppenheimer/shared';
import type { GithubEventType, ScheduleFrequency } from '@oppenheimer/shared/automations';

/** A schedule as the bot writes it: the frequency and the fields that frequency reads. */
export interface RoutineScheduleInput {
  source: 'schedule';
  frequency: ScheduleFrequency;
  hour: number;
  minute: number;
  days?: number[];
  day_of_month?: number;
  date?: string;
  timezone?: string;
}

/** A GitHub event as the bot writes it: which, on which repositories, and an optional branch. */
export interface RoutineGithubInput {
  source: 'github';
  event: GithubEventType;
  repositories: number[];
  branch?: string;
}

export type RoutineTriggerInput = RoutineScheduleInput | RoutineGithubInput;

/**
 * How `update_routine`'s triggers become the automations' own trigger input
 * (`26-bot-routines.md` §4): a schedule in the sender's zone unless it names
 * one, a GitHub event filtered by branch or not. Checked against the shared
 * schema, so a trigger the editor would refuse is refused here too, in a
 * sentence the model can act on. Pure.
 */
export function routineTriggers(
  inputs: readonly RoutineTriggerInput[],
  timeZone: string,
): { triggers: TriggerInputDto[] } | { refusal: string } {
  const triggers: TriggerInputDto[] = [];
  for (const [index, input] of inputs.entries()) {
    const candidate =
      input.source === 'schedule'
        ? {
            source: 'schedule',
            frequency: input.frequency,
            hour: input.hour,
            minute: input.minute,
            ...(input.frequency === 'weekly' ? { days: input.days } : {}),
            ...(input.frequency === 'monthly' ? { dayOfMonth: input.day_of_month } : {}),
            ...(input.frequency === 'once' ? { date: input.date } : {}),
            timezone: input.timezone ?? timeZone,
          }
        : {
            source: 'github',
            event: input.event,
            repositories: input.repositories,
            filter: input.branch ? { op: 'equals', value: input.branch } : { op: 'any' },
          };
    const parsed = triggerInputSchema.safeParse(candidate);
    if (!parsed.success) {
      const fields = parsed.error.issues.map((issue) => issue.path.join('.') || 'trigger');
      return {
        refusal: `Trigger ${index + 1} is not valid (${[...new Set(fields)].join(', ')}). A weekly schedule needs days, a monthly one day_of_month, a once one date (YYYY-MM-DD); a GitHub trigger needs repository ids.`,
      };
    }
    triggers.push(parsed.data);
  }
  return { triggers };
}
