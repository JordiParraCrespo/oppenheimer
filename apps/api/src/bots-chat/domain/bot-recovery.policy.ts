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

/** The routes worth trying when a step fails, each with when it applies. */
const ROUTES: readonly string[] = [
  'another online host when one host cannot do it',
  'another query or source when a lookup comes back weak or empty',
  'another approach when the first one cannot work',
];

/** What no route lifts. */
const LIMITS: readonly string[] = [
  'Do not try the same thing the same way twice.',
  'Work still under way (a queued or stalled session) has not failed: follow it rather than start a second one elsewhere.',
  'A person\'s "no" is not a failure: a denial, a dismissed question or "stop" ends that route, and you do not try it another way.',
];

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
