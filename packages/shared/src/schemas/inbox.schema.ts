import { z } from 'zod';

/**
 * The Inbox (`product/versions/mvp/29-inbox.md`): one place for what needs
 * you. Its items are not stored, they are read from their sources; what is
 * stored is only what a person did to one occurrence of an item, a **mark**
 * (§3).
 *
 * - `done`: hidden, with a line in the log.
 * - `low`: deprioritized, sorted last and labelled *Low*.
 * - `snoozed`: hidden until `until`, then back.
 * - `deleted`: hidden for good, with no log line.
 */
export const INBOX_MARKS = ['done', 'low', 'snoozed', 'deleted'] as const;
export const inboxMarkSchema = z.enum(INBOX_MARKS);
export type InboxMark = z.infer<typeof inboxMarkSchema>;

/** The most marks one read returns, the newest changed first. */
export const INBOX_MARKS_MAX = 1_000;

/** The longest item key the table holds. */
export const INBOX_ITEM_KEY_MAX = 200;

/**
 * An occurrence's key: its kind, a colon, and what names the wait it answers
 * (`session:<id>:<observedSince>`, `approval:<id>`,
 * `pull:<repoId>#<number>@<sha>`, `run:<id>`). Letters, digits and
 * `:#@._-` only, so it travels in a path segment and a log line as it is.
 */
export const INBOX_ITEM_KEY_PATTERN = /^[a-z]+:[A-Za-z0-9:#@._-]{1,190}$/;

export const inboxItemKeySchema = z.string().max(INBOX_ITEM_KEY_MAX).regex(INBOX_ITEM_KEY_PATTERN);

/**
 * `PUT /inbox/marks/:itemKey`: what to mark the occurrence. `until` comes with
 * a snooze and only with one; that it lies in the future is the server's to
 * say, against its own clock.
 */
export const putInboxMarkSchema = z
  .object({
    mark: inboxMarkSchema,
    until: z.string().datetime({ offset: true }).optional(),
  })
  // A snooze needs `until`, and only a snooze takes one.
  .refine((value) => (value.mark === 'snoozed') === (value.until !== undefined), {
    path: ['until'],
  });
export type PutInboxMarkDto = z.infer<typeof putInboxMarkSchema>;
