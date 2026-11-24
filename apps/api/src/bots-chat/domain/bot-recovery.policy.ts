import { promptText } from './bot-prompt-text.policy';

/**
 * What a bot does after a step fails, said once: a failed step sends the
 * bot to the next reasonable route before it reports, within limits no
 * route lifts. The words are `prompts/core/system-recovery.md` and the two
 * wake files below (`core/wake-repeated-blocker.md`, `sessions/wake-failed.md`); the system prompt's "How a turn goes" and
 * "Which host", a repeated run's opening and the `failed` session wake all
 * read them from here, so a change to a route or a limit reaches every place
 * that states it.
 */

/** The way round a closed session: the routes and a repeated run's ask both carry these words. */
const replaceWhatIsGone = (): string => promptText('core/system-recovery.replace-what-is-gone');

/**
 * What a turn nobody asked for (a routine, a loop's run) is told about the
 * blocker its last run ended on, in the note that opens it. `quiet` is what
 * that turn does once the person has been told.
 */
export function repeatedBlockerAsk(quiet: string): string {
  return promptText('core/wake-repeated-blocker', {
    replaceWhatIsGone: replaceWhatIsGone(),
    quiet,
  });
}

/** The bullets "How a turn goes" carries about failures. */
export function recoveryBullets(): string {
  return promptText('core/system-recovery.bullets', { replaceWhatIsGone: replaceWhatIsGone() });
}

/** The cases of "Which host" after the order it picks in, one sub-bullet each. */
export function hostCases(): string {
  return promptText('core/system-recovery.host-cases');
}

/** What the `failed` wake asks, step by step, as one paragraph. */
export function failedWakeAsk(): string {
  return [
    promptText('sessions/wake-failed.read-it'),
    promptText('sessions/wake-failed.the-host-was-at-fault'),
    promptText('sessions/wake-failed.the-person-named-the-host'),
    promptText('sessions/wake-failed.the-task-was-at-fault'),
    promptText('sessions/wake-failed.closing-it'),
  ].join(' ');
}
