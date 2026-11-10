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

/**
 * A **report**: the one Inbox item that is stored, because nothing else knows
 * it. An agent that found a problem posts it with its pictures
 * (`POST /inbox/reports`), the person reads it in the Inbox and answers
 * there, and the agent reads the answer back (`GET /inbox/reports/:id`).
 *
 * - `open`: waiting on the person.
 * - `answered`: the person answered; it has left the Inbox.
 */
export const INBOX_REPORT_STATUSES = ['open', 'answered'] as const;
export const inboxReportStatusSchema = z.enum(INBOX_REPORT_STATUSES);
export type InboxReportStatus = z.infer<typeof inboxReportStatusSchema>;

export const INBOX_REPORT_TITLE_MAX = 200;
export const INBOX_REPORT_BODY_MAX = 4_000;
/** Who sent it, in the sender's own words: a routine's name, `qa-explorer`. */
export const INBOX_REPORT_SOURCE_MAX = 80;
export const INBOX_REPORT_LINK_MAX = 2_000;
export const INBOX_REPORT_ANSWER_MAX = 2_000;
export const INBOX_REPORT_IMAGES_MAX = 4;
export const INBOX_REPORT_IMAGE_MAX_BYTES = 5 * 1024 * 1024;
export const INBOX_REPORT_IMAGE_MIME_TYPES = [
  'image/png',
  'image/jpeg',
  'image/gif',
  'image/webp',
] as const;
export type InboxReportImageMimeType = (typeof INBOX_REPORT_IMAGE_MIME_TYPES)[number];
export const INBOX_REPORT_IMAGE_NAME_MAX = 255;

/** The most reports one read returns, the newest first. */
export const INBOX_REPORTS_MAX = 100;

/**
 * The text fields of `POST /inbox/reports`, which is `multipart/form-data` so
 * the pictures travel with them under `images`. A link is where the problem
 * can be seen: a pull request, a page, a run.
 */
export const createInboxReportSchema = z.object({
  title: z.string().trim().min(1).max(INBOX_REPORT_TITLE_MAX),
  body: z.string().trim().max(INBOX_REPORT_BODY_MAX).optional(),
  source: z.string().trim().max(INBOX_REPORT_SOURCE_MAX).optional(),
  link: z
    .string()
    .trim()
    .max(INBOX_REPORT_LINK_MAX)
    .url()
    .refine((value) => /^https?:\/\//i.test(value))
    .optional(),
});
export type CreateInboxReportDto = z.infer<typeof createInboxReportSchema>;

/** `POST /inbox/reports/:id/answer`: what the person tells the agent. */
export const answerInboxReportSchema = z.object({
  text: z.string().trim().min(1).max(INBOX_REPORT_ANSWER_MAX),
});
export type AnswerInboxReportDto = z.infer<typeof answerInboxReportSchema>;

/** `GET /inbox/reports?status=`: the open ones when it is left out. */
export const findInboxReportsSchema = z.object({
  status: inboxReportStatusSchema.optional(),
});
export type FindInboxReportsDto = z.infer<typeof findInboxReportsSchema>;

/** A picture a report carries; its bytes are read by its id. */
export interface InboxReportImage {
  id: string;
  mimeType: InboxReportImageMimeType;
  sizeBytes: number;
  name: string;
}

/** The Inbox key of a report's one occurrence. */
export function inboxReportItemKey(reportId: string): string {
  return `report:${reportId}`;
}
