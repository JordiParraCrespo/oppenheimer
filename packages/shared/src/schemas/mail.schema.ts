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
