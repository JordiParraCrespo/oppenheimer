import { z } from 'zod';

/**
 * Mail: a person's own Gmail accounts, worked by their bots
 * (`product/next-steps/mail.md`). A connection is the person's, like a Google
 * Calendar one, and at most this many per person.
 */
export const GMAIL_ACCOUNTS_MAX = 5;

/** What a person calls one of their Gmail accounts: "Personal", "Work". */
export const GMAIL_LABEL_MAX = 64;

/**
 * `POST /mail/gmail/connections`: start connecting a Gmail account, or, with a
 * `connectionId`, reconnect that one (Google's account chooser opens on it).
 */
export const startGmailConnectionSchema = z.object({
  connectionId: z.string().uuid().optional(),
});

export type StartGmailConnectionDto = z.infer<typeof startGmailConnectionSchema>;

/** `POST /mail/gmail/connection`: what Google put on the redirect. */
export const connectGmailSchema = z.object({
  code: z.string().min(1).max(2048),
  state: z.string().min(1).max(256),
});

export type ConnectGmailDto = z.infer<typeof connectGmailSchema>;

/** `PATCH /mail/gmail/connections/:id`: the name the person and their bots know it by. */
export const updateGmailConnectionSchema = z.object({
  label: z.string().trim().max(GMAIL_LABEL_MAX),
});

export type UpdateGmailConnectionDto = z.infer<typeof updateGmailConnectionSchema>;

/** One of the caller's Gmail accounts, as Settings lists it. Never the token. */
export const gmailConnectionSchema = z.object({
  id: z.string().uuid(),
  accountEmail: z.string(),
  label: z.string(),
  status: z.enum(['active', 'revoked']),
  connectedAt: z.string(),
});

export type GmailConnection = z.infer<typeof gmailConnectionSchema>;

/**
 * Sending and drafts (`product/next-steps/mail.md` §3.3–3.4). A bot never
 * sends to more than this many people at once, and never more than
 * {@link MAIL_SENDS_PER_DAY} messages a day from one account.
 */
export const MAIL_RECIPIENTS_MAX = 10;
export const MAIL_SENDS_PER_DAY = 50;
/** Gmail's own limit on a message, attachments included. */
export const MAIL_MESSAGE_MAX_BYTES = 25 * 1024 * 1024;

/** What a message is: a new one, an answer in a thread, a forward, or a saved draft sent as it stands. */
export const MAIL_PLAN_KINDS = ['new', 'reply', 'reply_all', 'forward', 'draft'] as const;
export type MailPlanKind = (typeof MAIL_PLAN_KINDS)[number];

/** A file the message carries, by where its bytes are: always an attachment of a message in the account. */
export const mailPlanAttachmentSchema = z.object({
  messageId: z.string().min(1).max(100),
  partId: z.string().min(1).max(50),
  filename: z.string().max(255),
  mimeType: z.string().max(255),
  sizeBytes: z.number().int().min(0),
});

export type MailPlanAttachment = z.infer<typeof mailPlanAttachmentSchema>;

/**
 * A message as it will go, every default resolved: the alias it goes from,
 * the recipients (with whether they were read out of a message rather than
 * given), the subject, the body as written, the threading, the files. A send
 * card shows exactly this, and a yes sends exactly this.
 */
export const mailPlanSchema = z.object({
  kind: z.enum(MAIL_PLAN_KINDS),
  connectionId: z.string().uuid(),
  accountEmail: z.string(),
  from: z.object({ email: z.string(), name: z.string().nullable() }),
  to: z.array(z.string()).max(MAIL_RECIPIENTS_MAX),
  cc: z.array(z.string()).max(MAIL_RECIPIENTS_MAX),
  bcc: z.array(z.string()).max(MAIL_RECIPIENTS_MAX),
  /** The recipients came from the message answered, not from the call. */
  recipientsFromMail: z.boolean(),
  subject: z.string().max(998),
  /** What the bot wrote, in light markdown; the quoted original and the signature are added when sent. */
  body: z.string().max(100_000),
  /** The alias's Gmail signature goes below the body. */
  signature: z.boolean(),
  /** The message answered or forwarded, as the card names it. */
  original: z
    .object({
      messageId: z.string(),
      from: z.string(),
      subject: z.string(),
      date: z.string().nullable(),
    })
    .nullable(),
  threadId: z.string().nullable(),
  attachments: z.array(mailPlanAttachmentSchema).max(25),
  /** For a draft sent as it stands: the draft, and the version of it the card showed. */
  draftId: z.string().nullable(),
  draftMessageId: z.string().nullable(),
});

export type MailPlan = z.infer<typeof mailPlanSchema>;
