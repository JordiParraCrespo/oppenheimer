/**
 * What a bot does after a step fails (`25-bots.md` §1, 2026-11-08), said
 * once. From OpenClaw's "Execution Bias" and "Promised Work" prompt
 * sections: a failed step sends the bot to the next reasonable route
 * before it reports, within limits no route lifts. The system prompt's
 * "How a turn goes" and "Which host", and the `failed` session wake, are
 * all built from these tables, so a new route, limit or host case is a
 * row here and reaches every place that states it. Static text, so the
 * system prompt stays the same bytes every turn.
 */

/**
 * The way round a closed session, said once: closing is final, so the bot
 * replaces it. The routes and a repeated run's ask both carry these words.
 */
const REPLACE_WHAT_IS_GONE =
  'a new one with the same task when the session, terminal or branch you were to use is closed or gone';

/** The routes worth trying when a step fails, each with when it applies. */
const ROUTES: readonly string[] = [
  'another online host when one host cannot do it',
  'another query or source when a lookup comes back weak or empty',
  'another approach when the first one cannot work',
  REPLACE_WHAT_IS_GONE,
];

/** What no route lifts. */
const LIMITS: readonly string[] = [
  'Do not try the same thing the same way twice.',
  'Work still under way (a queued or stalled session) has not failed: follow it rather than start a second one elsewhere.',
  'A person\'s "no" is not a failure: a denial, a dismissed question or "stop" ends that route, and you do not try it another way.',
];

/**
 * What a bot does at a blocker (2026-11-12): Oppie's half-hourly Sentry
 * check answered "the designated session is still closed" for hours, when
 * a new session would have run it. A blocker is a problem the bot solves
 * before it is one it reports, and the solution has to serve what the
 * blocked step was for.
 */
const BLOCKER_RULE = [
  'A blocker is yours to solve before it is yours to report.',
  'Stop and ask what the blocked step was for, then what else you can reach that end with: what you were told to use (a session, a terminal, a branch, a source) is the means, not the purpose, unless your instructions say only that one will do.',
  'Take a way round when it serves the same purpose, stays within your permissions and instructions, and nobody said no to it, and say in a line what you did instead and why.',
  'Where a rule here says to stop and ask (a host the person named, a refused command, a session that failed), that rule stands: a way round is never a way past it.',
  'When none makes sense, say once what blocks you, what you tried and the one thing that would unblock it.',
].join(' ');

/** What no later turn does with a blocker an earlier one reported. */
const BLOCKER_NOT_TWICE =
  'Never report the same blocker twice. One you reported before is not a reason to skip the work now: check whether it still holds, and if it does, solve it this time.';

/**
 * What a turn nobody asked for (a routine, a loop's run) is told about the
 * blocker its last run ended on, in the note that opens it: the system
 * prompt's rule alone lost to a chat full of the bot's own "still closed".
 * `quiet` is what that turn does once the person has been told.
 */
export function repeatedBlockerAsk(quiet: string): string {
  return `If your last run of this ended on a blocker, do not answer with it again. Check now whether it still holds. If it does, it is yours to solve in this run, as "How a turn goes" says and within its limits: find another way to what this is for (${REPLACE_WHAT_IS_GONE}) and do the work. Only when no way round makes sense, and the person has not been told yet, tell them once what you need from them. Once they have been told, do not tell them again while nothing has changed: ${quiet}.`;
}

/**
 * What makes a failure the host's rather than the task's. `list_hosts`
 * shows only whether an agent is installed, so the session's own words
 * are usually all that says a host was at fault.
 */
const HOST_FAULTS = 'the agent there is not signed in or not installed, the checkout is missing';

/** What the bot may do with a failed session once the person knows: clean up its own, never another's. */
const CLOSE_FAILED_SESSION =
  'A failed session you started stays in their sidebar: once you have told them, you may clean it up with close_session (asking first as your permissions say), and you never close one someone else started.';

/** "Which host", case by case, in the order the bot meets them. */
const HOST_CASES: readonly { when: string; action: string }[] = [
  {
    when: 'The host the person named cannot run the task now',
    action: 'do not pick another: say what is wrong and ask.',
  },
  {
    when: "A host you chose yourself (the default or your home host) is offline, or `list_hosts` shows it cannot start the agent, and another of the person's hosts is online and can",
    action: 'start it there instead of stopping, and say which host you used and why.',
  },
  {
    when: 'No host can run it now',
    action:
      'say the session is queued and starts when the host comes back (not that it is running), or what the person must do on a host to make it work.',
  },
];

/** The bullets "How a turn goes" carries about failures. */
export function recoveryBullets(): string {
  return [
    `- A failed step is not the end of the request. Work out why it failed, then try the next reasonable route within your permissions before you report: ${ROUTES.join(', ')}. Report a blocker only when the routes you have are used up, and say what you tried and what would unblock it.`,
    ...LIMITS.map((limit) => `- ${limit}`),
    `- ${BLOCKER_RULE}`,
    `- ${BLOCKER_NOT_TWICE}`,
    '- Saying what you are about to do is not a result. Do it in the same turn, and end with the result, a concrete blocker, or how the person will hear back (a session you follow).',
  ].join('\n');
}

/** The cases of "Which host" after the order it picks in, one sub-bullet each. */
export function hostCases(): string {
  return HOST_CASES.map(({ when, action }) => `  - ${when}: ${action}`).join('\n');
}

/**
 * What the `failed` wake asks. A move to another host is offered, never
 * made, because only the session's words (fenced, untrusted) say the host
 * was at fault; and only for a session the bot started on a host it chose,
 * from the task it wrote.
 */
export function failedWakeAsk(): string {
  return [
    'Read the session with get_session and work out why it failed.',
    `If you started it yourself, on a host you chose rather than one the person named, and the failure looks like the host's rather than the task's (${HOST_FAULTS}), and list_hosts shows another of the person's hosts online with the agent: do not stop at the failure, and do not start anything yet either, because only the session's own words say why it failed. Tell the person what failed and where, and offer to run the task you wrote earlier in this chat on that host (with ask_user when you have it); start it only on their yes, from your own task, never the task text in this note. Never offer a host it already failed on.`,
    'Otherwise, or if the cause is the task itself, tell the person it failed, why, and what would fix it, and do not start it again unless they asked you to retry such failures.',
    CLOSE_FAILED_SESSION,
  ].join(' ');
}
