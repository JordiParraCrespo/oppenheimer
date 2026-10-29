import type { MailLabelChange } from '../domain/mail-organize.policy';
/** The account a grant is for, from the ID token on Google's token response. */
export interface GmailAccount {
  /** Google's `sub`: stable for the account, whatever its address becomes. */
  subject: string;
  email: string;
}

/** What a code exchange gives back: the grant, and whose it is. */
export interface GmailGrant {
  refreshToken: string | null;
  /** Null when Google sent no usable ID token: the grant is refused, never stored unkeyed. */
  account: GmailAccount | null;
  scopes: string[];
}

/** The grant a call uses, and the connection it belongs to (its rate-limit bucket). */
export interface GmailCallGrant {
  connectionId: string;
  refreshToken: string;
}

/** An attachment as a message names it; its bytes are fetched only when asked for. */
export interface GmailAttachmentInfo {
  /** Gmail's id for the attachment's bytes; null for one sent inline in the message. */
  attachmentId: string | null;
  /** The MIME part it sits in, which finds it again when it has no attachment id. */
  partId: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
}

/** One message as a search or a draft list shows it: its envelope, never its body. */
export interface GmailMessageSummary {
  id: string;
  threadId: string;
  from: string;
  to: string;
  cc: string;
  subject: string;
  /** When Gmail received it (`internalDate`); null when Gmail gave none. */
  date: Date | null;
  snippet: string;
  labelIds: string[];
  attachments: GmailAttachmentInfo[];
}

/** One message read in full, its body as plain text. */
export interface GmailMessage extends GmailMessageSummary {
  replyTo: string;
  /** The `Message-ID` header, which a reply's `In-Reply-To` names. */
  messageIdHeader: string;
  /** The `References` header, which an answer carries on. */
  referencesHeader: string;
  /** The `Date` header as the sender wrote it. */
  dateHeader: string;
  /** The text the sender wrote: the plain part, or the HTML part read as text. */
  body: string;
}

/** An address the account sends from: itself, or a send-as alias set up in Gmail. */
export interface GmailSendAs {
  email: string;
  displayName: string | null;
  /** The alias's Gmail signature, as Gmail keeps it (HTML); empty when none. */
  signatureHtml: string;
  isDefault: boolean;
}

/** A whole RFC 2822 message, and the thread it belongs in. */
export interface GmailRawMessage {
  raw: Buffer;
  threadId: string | null;
}

export interface GmailSentRef {
  messageId: string;
  threadId: string;
}

export interface GmailDraftRef extends GmailSentRef {
  draftId: string;
}

export interface GmailDraftRead {
  id: string;
  message: GmailMessage;
}

/** Mail that arrived since a history id, and the id to read from next. */
export interface GmailNewMail {
  messageIds: string[];
  historyId: string;
}

/** Labels to add and to take off, by Gmail's label ids. */
export type GmailLabelChange = MailLabelChange;

/** What a change over several threads did: the ones changed, and the ones Gmail has not. */
export interface GmailBulkOutcome {
  changed: string[];
  missing: string[];
}

export interface GmailThread {
  id: string;
  messages: GmailMessage[];
}

/** A page of search results, with Gmail's estimate of how many match in all. */
export interface GmailSearchPage {
  messages: GmailMessageSummary[];
  nextPageToken: string | null;
  resultSizeEstimate: number;
}

export interface GmailLabel {
  id: string;
  name: string;
  /** `system` for Gmail's own (INBOX, SENT, UNREAD…), `user` for the person's. */
  type: 'system' | 'user';
  messagesTotal: number | null;
  messagesUnread: number | null;
  threadsUnread: number | null;
}

export interface GmailDraft {
  id: string;
  message: GmailMessageSummary;
}

export interface GmailDraftPage {
  drafts: GmailDraft[];
  nextPageToken: string | null;
}

/** An attachment's bytes, with what the message says it is. */
export interface GmailAttachmentContent {
  filename: string;
  mimeType: string;
  bytes: Buffer;
}

/** What a search asks for: Gmail's own query language, and a page of it. */
export interface GmailSearchRequest {
  query: string;
  maxResults: number;
  pageToken: string | null;
  /** Include Spam and Trash, which Gmail leaves out unless asked. */
  includeSpamTrash: boolean;
}

/** Why a call failed, in the words the handlers act on. */
export class GmailGrantRevokedError extends Error {}
export class GmailProviderError extends Error {}
export class GmailNotFoundError extends Error {}

/**
 * Gmail, through the person's own grant (`product/next-steps/mail.md` §2).
 * Nothing it returns is stored by the port.
 *
 * Every call may throw Gmail's rate-limit problem (`MAIL_008`, an `AppError`)
 * when its quota stopped it; callers let it through as is. Every call that
 * uses a grant throws `GmailGrantRevokedError` when the grant is gone, and
 * `GmailNotFoundError` when Gmail has no such item.
 */
export interface GmailProviderPort {
  isConfigured(): boolean;
  /**
   * The page a person grants access on, carrying `state`. It always offers the
   * account chooser; `loginHint` opens it on one account (Reconnect).
   */
  authorizationUrl(state: string, loginHint?: string): string;
  /** Throws `GmailProviderError` when the code is refused. */
  exchange(code: string): Promise<GmailGrant>;
  search(grant: GmailCallGrant, request: GmailSearchRequest): Promise<GmailSearchPage>;
  readThread(grant: GmailCallGrant, threadId: string): Promise<GmailThread>;
  listLabels(grant: GmailCallGrant): Promise<GmailLabel[]>;
  listDrafts(
    grant: GmailCallGrant,
    page: { maxResults: number; pageToken: string | null },
  ): Promise<GmailDraftPage>;
  /** The bytes of one attachment of one message. */
  readAttachment(
    grant: GmailCallGrant,
    messageId: string,
    attachment: Pick<GmailAttachmentInfo, 'attachmentId' | 'partId'>,
  ): Promise<GmailAttachmentContent>;
  /** The addresses the account sends from, the default first. */
  listSendAs(grant: GmailCallGrant): Promise<GmailSendAs[]>;
  /** One message in full, for an answer or a forward to be built from. */
  readMessage(grant: GmailCallGrant, messageId: string): Promise<GmailMessage>;
  readDraft(grant: GmailCallGrant, draftId: string): Promise<GmailDraftRead>;
  createDraft(grant: GmailCallGrant, message: GmailRawMessage): Promise<GmailDraftRef>;
  /** Replaces a draft's message; Gmail gives the draft a new message id. */
  updateDraft(
    grant: GmailCallGrant,
    draftId: string,
    message: GmailRawMessage,
  ): Promise<GmailDraftRef>;
  deleteDraft(grant: GmailCallGrant, draftId: string): Promise<void>;
  /** Sends a draft as it stands in Gmail. */
  sendDraft(grant: GmailCallGrant, draftId: string): Promise<GmailSentRef>;
  sendMessage(grant: GmailCallGrant, message: GmailRawMessage): Promise<GmailSentRef>;
  /**
   * Adds and removes labels on whole threads (read state, stars, importance
   * and the inbox are labels too), one thread at a time: what Gmail has no
   * thread of is answered as missing, never as a failure of the rest.
   */
  modifyThreads(
    grant: GmailCallGrant,
    threadIds: readonly string[],
    change: GmailLabelChange,
  ): Promise<GmailBulkOutcome>;
  /** The same on single messages, in one call (`messages.batchModify`). */
  modifyMessages(
    grant: GmailCallGrant,
    messageIds: readonly string[],
    change: GmailLabelChange,
  ): Promise<void>;
  /** Moves threads to Trash, or back out of it; Gmail empties Trash after 30 days. */
  trashThreads(
    grant: GmailCallGrant,
    threadIds: readonly string[],
    trash: boolean,
  ): Promise<GmailBulkOutcome>;
  createLabel(grant: GmailCallGrant, name: string): Promise<GmailLabel>;
  /** Where the mailbox's history stands now: new mail is read from here on. */
  currentHistoryId(grant: GmailCallGrant): Promise<string>;
  /**
   * The messages that arrived since `startHistoryId` (`users.history.list`),
   * oldest first, at most `max`, leaving out drafts and the account's own
   * sent mail; and the history id to read from next. Null when Gmail no
   * longer keeps history that old: start again from `currentHistoryId`.
   */
  newMessages(
    grant: GmailCallGrant,
    startHistoryId: string,
    max: number,
  ): Promise<GmailNewMail | null>;
  /** The ids of messages a Gmail query matches, newest first, at most `max`; nothing else is read. */
  searchIds(grant: GmailCallGrant, query: string, max: number): Promise<string[]>;
  /** Best effort: a grant Google already dropped is not an error. */
  revoke(grant: GmailCallGrant): Promise<void>;
}

/**
 * The scope mail asks for: everything §3 needs except deleting mail for good
 * (`product/next-steps/mail.md` §1). Read, drafts, send, labels and trash.
 */
export const GMAIL_SCOPE = 'https://www.googleapis.com/auth/gmail.modify';
