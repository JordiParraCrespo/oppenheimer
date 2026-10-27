import { z } from 'zod';

/**
 * What a session's agent is waiting on the person to decide, as the runner
 * reads it on the host (`product/versions/mvp/28-inbox.md`, slice 4), and the
 * answer the Inbox sends back.
 *
 * Two kinds, both Claude Code's:
 *
 * - a **question** is an `AskUserQuestion` tool call the agent's transcript
 *   holds with no result yet; its id is the call's `tool_use_id`;
 * - a **permission** is the dialog Claude Code draws before a tool runs ("Do
 *   you want to proceed?"), read off the bottom of the screen. Its id is a
 *   hash of the prompt's text and options, so the same dialog keeps its id and
 *   the next one gets another. Its options are in screen order, and option `i`
 *   is answered by typing `String(i + 1)`.
 *
 * The decision rides `events.append` as an `agent.decision` entry whose payload
 * is `{ decision }`, null once nothing is pending. It is an event payload, not
 * a link message, so the wire carries it as a JSON string under the event cap;
 * the bounds below are what keep a question inside it, and the runner drops
 * descriptions before anything else when it would not fit. The Go twin is
 * generated from this file (`scripts/emit-session-decision.cjs`).
 *
 * Nullable text the runner leaves out arrives absent, and is read as null.
 */

/** The event kind a pending decision is logged as. */
export const AGENT_DECISION_EVENT_KIND = 'agent.decision';

/** The event kind the control plane logs when somebody answered one. Payload `{ id }`. */
export const DECISION_ANSWERED_EVENT_KIND = 'decision.answered';

/** The bounds of a decision, in characters and items. */
export const SESSION_DECISION_LIMITS = {
  /** A permission decision's id, or a tool call's id. */
  id: 128,
  /** `AskUserQuestion` asks one to four. */
  questions: 4,
  /** `AskUserQuestion` offers two to four; a little room for a later release. */
  questionOptions: 6,
  header: 32,
  question: 400,
  label: 100,
  description: 200,
  /** A permission dialog's options are typed as one digit. */
  permissionOptions: 9,
  title: 300,
  detail: 1000,
  /** An answer of the person's own words. */
  other: 1000,
} as const;

const L = SESSION_DECISION_LIMITS;

/** Absent is null: the runner leaves out what it did not see. */
const nullableText = (max: number) => z.string().max(max).nullable().default(null);

export const sessionDecisionQuestionOptionSchema = z.object({
  label: z.string().min(1).max(L.label),
  description: nullableText(L.description),
});

export const sessionDecisionQuestionSchema = z.object({
  /** The chip over it in the terminal ("Scope"). */
  header: nullableText(L.header),
  question: z.string().min(1).max(L.question),
  /** Several options may be picked. */
  multiSelect: z.boolean(),
  options: z.array(sessionDecisionQuestionOptionSchema).min(1).max(L.questionOptions),
});

export const sessionQuestionDecisionSchema = z.object({
  kind: z.literal('question'),
  /** The `AskUserQuestion` call's `tool_use_id`. */
  id: z.string().min(1).max(L.id),
  questions: z.array(sessionDecisionQuestionSchema).min(1).max(L.questions),
});

export const sessionPermissionDecisionSchema = z.object({
  kind: z.literal('permission'),
  /** A hash of the dialog's text and options: stable while it is on screen. */
  id: z.string().min(1).max(L.id),
  /** The dialog's question ("Do you want to proceed?"). */
  title: z.string().min(1).max(L.title),
  /** What it asks about, above the question: a command, a file. */
  detail: nullableText(L.detail),
  /** In screen order; option `i` is answered by typing `String(i + 1)`. */
  options: z
    .array(z.object({ label: z.string().min(1).max(L.label) }))
    .min(2)
    .max(L.permissionOptions),
});

export const sessionDecisionSchema = z.discriminatedUnion('kind', [
  sessionQuestionDecisionSchema,
  sessionPermissionDecisionSchema,
]);

export type SessionDecisionQuestion = z.infer<typeof sessionDecisionQuestionSchema>;
export type SessionQuestionDecision = z.infer<typeof sessionQuestionDecisionSchema>;
export type SessionPermissionDecision = z.infer<typeof sessionPermissionDecisionSchema>;
export type SessionDecision = z.infer<typeof sessionDecisionSchema>;

/** The payload of an `agent.decision` entry: what is pending now, or null for nothing. */
export const agentDecisionPayloadSchema = z.object({
  decision: sessionDecisionSchema.nullable(),
});

export type AgentDecisionPayload = z.infer<typeof agentDecisionPayloadSchema>;

/** What the person chose for one question: options by index, and words of their own. */
export const sessionDecisionAnswerItemSchema = z.object({
  picks: z
    .array(
      z
        .number()
        .int()
        .min(0)
        .max(L.questionOptions - 1),
    )
    .max(L.questionOptions),
  other: z.string().max(L.other).nullable(),
});

/**
 * `POST /sessions/{id}/decision`: the answer to the pending decision named by
 * `id`. A question takes `answers`, one per question in order; a permission
 * `option`, by its index; exactly one of the two. Whether the answer fits the
 * decision (an index in range, one pick for a single choice) is the control
 * plane's to judge against what is pending, which this schema cannot see.
 */
export const answerSessionDecisionSchema = z
  .object({
    id: z.string().min(1).max(L.id),
    answers: z.array(sessionDecisionAnswerItemSchema).min(1).max(L.questions).optional(),
    option: z
      .number()
      .int()
      .min(0)
      .max(L.permissionOptions - 1)
      .optional(),
  })
  .refine((body) => (body.answers === undefined) !== (body.option === undefined), {
    params: { i18nKey: 'validation.invalid' },
  });

export type AnswerSessionDecisionDto = z.infer<typeof answerSessionDecisionSchema>;
