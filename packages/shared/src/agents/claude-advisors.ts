/**
 * The advisors each Claude model takes: Anthropic's advisor tool
 * (`advisor_20260301`) pairs the model a turn runs on with a stronger one it
 * may consult mid-turn, and refuses (400) a pair outside its table. These are
 * that table's rows as of 2026-11, cut to the models `CODING_AGENTS` lists
 * (the Mythos models are for verified organizations only), strongest first.
 * A bot's advisor is one of its model's (`BotModel.advisors`).
 */

const FABLE = ['claude-fable-5-2', 'claude-fable-5-1', 'claude-fable-5'] as const;
const OPUS_5 = ['claude-opus-5-5', 'claude-opus-5'] as const;

/** Opus 5.5, Opus 5 and Fable 5: a Fable or an Opus 5 line. */
const FOR_OPUS_5 = Object.freeze([...FABLE, ...OPUS_5]);

/** Opus 4.8 and 4.7: also those two, and Sonnet 5.5. */
const FOR_OPUS_4_7 = Object.freeze([
  ...FABLE,
  ...OPUS_5,
  'claude-opus-4-8',
  'claude-opus-4-7',
  'claude-sonnet-5-5',
]);

/** Sonnet 5 and Haiku 5.5. */
const FOR_SONNET_5 = Object.freeze([
  ...FABLE,
  ...OPUS_5,
  'claude-opus-4-8',
  'claude-opus-4-7',
  'claude-sonnet-5-5',
  'claude-sonnet-5',
  'claude-haiku-5-5',
]);

/** Opus 4.6: also itself. */
const FOR_OPUS_4_6 = Object.freeze([
  ...FABLE,
  ...OPUS_5,
  'claude-opus-4-8',
  'claude-opus-4-7',
  'claude-opus-4-6',
  'claude-sonnet-5-5',
  'claude-sonnet-5',
  'claude-haiku-5-5',
]);

/** Haiku 4.5 and Sonnet 4.6: every model above, and Sonnet 4.6. */
const FOR_HAIKU_4_5 = Object.freeze([...FOR_OPUS_4_6, 'claude-sonnet-4-6']);

/** By the model a turn runs on. A model absent here takes no advisor. */
export const CLAUDE_ADVISORS: Readonly<Record<string, readonly string[]>> = Object.freeze({
  'claude-opus-5-5': FOR_OPUS_5,
  'claude-opus-5': FOR_OPUS_5,
  'claude-fable-5': FOR_OPUS_5,
  // Fable 5.2 takes only itself; Fable 5.1 itself or 5.2.
  'claude-fable-5-2': Object.freeze(['claude-fable-5-2']),
  'claude-fable-5-1': Object.freeze(['claude-fable-5-2', 'claude-fable-5-1']),
  // Sonnet 5.5 refuses the Opus 4.x and Sonnet 5 advisors.
  'claude-sonnet-5-5': Object.freeze([...FOR_OPUS_5, 'claude-sonnet-5-5']),
  'claude-opus-4-8': FOR_OPUS_4_7,
  'claude-opus-4-7': FOR_OPUS_4_7,
  'claude-sonnet-5': FOR_SONNET_5,
  'claude-haiku-5-5': FOR_SONNET_5,
  'claude-opus-4-6': FOR_OPUS_4_6,
  'claude-haiku-4-5': FOR_HAIKU_4_5,
  'claude-sonnet-4-6': FOR_HAIKU_4_5,
});
