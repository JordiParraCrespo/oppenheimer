import { Injectable, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CacheService } from '@oppenheimer/backend-cache';
import { AppError, type RefusalReader, UpstreamLimiter } from '@oppenheimer/backend-core';
import { MailErrors } from '../domain/mail.errors';
import {
  accountOfIdToken,
  draftOf,
  inlineBytesOf,
  labelOf,
  messageOf,
  messageSummaryOf,
  partOf,
  sendAsOf,
  sentRefOf,
} from './gmail-message.util';
import {
  GMAIL_SCOPE,
  type GmailAttachmentContent,
  type GmailAttachmentInfo,
  type GmailBulkOutcome,
  type GmailCallGrant,
  type GmailDraftPage,
  type GmailDraftRead,
  type GmailDraftRef,
  type GmailGrant,
  GmailGrantRevokedError,
  type GmailLabel,
  type GmailLabelChange,
  type GmailMessage,
  GmailNotFoundError,
  GmailProviderError,
  type GmailProviderPort,
  type GmailRawMessage,
  type GmailSearchPage,
  type GmailSearchRequest,
  type GmailSendAs,
  type GmailSentRef,
  type GmailThread,
} from './gmail-provider.port';

const TIMEOUT_MS = 15_000;
/**
 * Gmail counts quota units per user (250 a second) and per project (1.2
 * million a minute). The costliest thing a bot does is a search: one token
 * refresh, one `messages.list` (5 units) and a `messages.get` per result (5
 * units each), so 25 results is 130 units, about half a second of one
 * person's budget. Eight calls in flight per process keeps one search from
 * spending that in a burst; a queue past forty answers `MAIL_008` rather
 * than hanging the turn.
 */
const LIMITS = { maxInFlight: 8, maxQueued: 40, maxWaitMs: 10_000 };
/** Google's per-project quota: every connected account draws on it. */
const PROJECT: Bucket = 'project';
/** Google's reasons for a per-person quota refusal, and for a per-project one. */
const PERSON_REASONS = new Set(['userRateLimitExceeded']);
const PROJECT_REASONS = new Set(['rateLimitExceeded', 'quotaExceeded', 'dailyLimitExceeded']);
/**
 * The envelope and the part tree of a message, without any part's bytes: what
 * a search line and a draft line show, at a fraction of a full read.
 */
const SUMMARY_FIELDS =
  'id,threadId,labelIds,snippet,internalDate,payload(partId,mimeType,filename,headers,body/size,body/attachmentId,parts(partId,mimeType,filename,body/size,body/attachmentId,parts(partId,mimeType,filename,body/size,body/attachmentId,parts(partId,mimeType,filename,body/size,body/attachmentId))))';

type Bucket = 'project' | `connection:${string}`;

/** One person's Gmail for one port call: reads, and the writes drafts and sends make. */
interface GmailSession {
  get(path: string, params: Record<string, string>): Promise<Record<string, unknown>>;
  write(
    method: 'POST' | 'PUT' | 'DELETE',
    path: string,
    body?: unknown,
  ): Promise<Record<string, unknown>>;
  /**
   * A send: a refusal counts against the person's sending limit, never the
   * project's, so it pauses only that account.
   */
  send(path: string, body: unknown): Promise<Record<string, unknown>>;
}

/**
 * Gmail, through the same OAuth client as Google sign-in, with a grant of its
 * own (`product/next-steps/mail.md` §1–2). The redirect lands on the console
 * (`/settings/mail/google`), which posts the code back, as the calendar does;
 * so the redirect URI is the console's.
 *
 * Every call goes through one {@link UpstreamLimiter}: a call counts against
 * its connection (one Google account, so a person with several has a bucket
 * per account, and one paused account does not stop the others) and the
 * project. A refusal pauses whichever Google named, and a paused bucket
 * answers `MAIL_008` without asking Google again, on every replica
 * (`.agents/rules/integrations.md`). Access tokens are minted per call and
 * never kept.
 */
@Injectable()
export class GmailGateway implements GmailProviderPort {
  private readonly limiter: UpstreamLimiter;

  constructor(
    private readonly configService: ConfigService,
    @Optional() cache?: CacheService,
  ) {
    this.limiter = new UpstreamLimiter('Gmail', MailErrors.GMAIL_RATE_LIMITED, cache, LIMITS);
  }

  isConfigured(): boolean {
    return Boolean(this.clientId && this.clientSecret);
  }

  authorizationUrl(state: string, loginHint?: string): string {
    const url = new URL(this.config('googleAuthUrl'));
    url.searchParams.set('client_id', this.clientId ?? '');
    url.searchParams.set('redirect_uri', this.redirectUri);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('scope', `openid email ${GMAIL_SCOPE}`);
    url.searchParams.set('access_type', 'offline');
    // `select_account`: a second account can be chosen, not the one signed in.
    url.searchParams.set('prompt', 'consent select_account');
    if (loginHint) url.searchParams.set('login_hint', loginHint);
    url.searchParams.set('include_granted_scopes', 'true');
    url.searchParams.set('state', state);
    return url.toString();
  }

  async exchange(code: string): Promise<GmailGrant> {
    const body = await this.token(
      { code, redirect_uri: this.redirectUri, grant_type: 'authorization_code' },
      [PROJECT],
    );
    return {
      refreshToken: typeof body.refresh_token === 'string' ? body.refresh_token : null,
      account: accountOfIdToken(body.id_token),
      scopes: typeof body.scope === 'string' ? body.scope.split(' ') : [],
    };
  }

  async search(grant: GmailCallGrant, request: GmailSearchRequest): Promise<GmailSearchPage> {
    const session = await this.session(grant);
    const params: Record<string, string> = { maxResults: String(request.maxResults) };
    if (request.query) params.q = request.query;
    if (request.pageToken) params.pageToken = request.pageToken;
    if (request.includeSpamTrash) params.includeSpamTrash = 'true';
    const page = await session.get('messages', params);
    const ids = list(page.messages)
      .map((entry) => record(entry).id)
      .filter((id): id is string => typeof id === 'string');
    const messages = await Promise.all(
      ids.map(async (id) =>
        messageSummaryOf(
          await session.get(`messages/${encodeURIComponent(id)}`, {
            format: 'full',
            fields: SUMMARY_FIELDS,
          }),
        ),
      ),
    );
    return {
      messages,
      nextPageToken: typeof page.nextPageToken === 'string' ? page.nextPageToken : null,
      resultSizeEstimate: Number(page.resultSizeEstimate) || messages.length,
    };
  }

  async readThread(grant: GmailCallGrant, threadId: string): Promise<GmailThread> {
    const session = await this.session(grant);
    const thread = await session.get(`threads/${encodeURIComponent(threadId)}`, {
      format: 'full',
    });
    return {
      id: typeof thread.id === 'string' ? thread.id : threadId,
      messages: list(thread.messages).map((message) => messageOf(message)),
    };
  }

  async listLabels(grant: GmailCallGrant): Promise<GmailLabel[]> {
    const session = await this.session(grant);
    const labels = list((await session.get('labels', {})).labels).map(labelOf);
    // `labels.list` names them; the counts are `labels.get`'s, one call each,
    // so only the person's own labels and the inbox are counted.
    return Promise.all(
      labels.map(async (label) =>
        label.type === 'user' || label.id === 'INBOX'
          ? labelOf(await session.get(`labels/${encodeURIComponent(label.id)}`, {}))
          : label,
      ),
    );
  }

  async listDrafts(
    grant: GmailCallGrant,
    page: { maxResults: number; pageToken: string | null },
  ): Promise<GmailDraftPage> {
    const session = await this.session(grant);
    const params: Record<string, string> = { maxResults: String(page.maxResults) };
    if (page.pageToken) params.pageToken = page.pageToken;
    const listed = await session.get('drafts', params);
    const ids = list(listed.drafts)
      .map((entry) => record(entry).id)
      .filter((id): id is string => typeof id === 'string');
    const drafts = await Promise.all(
      ids.map(async (id) =>
        draftOf(
          await session.get(`drafts/${encodeURIComponent(id)}`, {
            format: 'full',
            fields: `id,message(${SUMMARY_FIELDS})`,
          }),
        ),
      ),
    );
    return {
      drafts,
      nextPageToken: typeof listed.nextPageToken === 'string' ? listed.nextPageToken : null,
    };
  }

  async readAttachment(
    grant: GmailCallGrant,
    messageId: string,
    attachment: Pick<GmailAttachmentInfo, 'attachmentId' | 'partId'>,
  ): Promise<GmailAttachmentContent> {
    const session = await this.session(grant);
    const message = await session.get(`messages/${encodeURIComponent(messageId)}`, {
      format: 'full',
    });
    const part = partOf(message.payload, attachment.partId);
    if (!part) throw new GmailNotFoundError('No such part');
    const named = {
      filename: typeof part.filename === 'string' ? part.filename : '',
      mimeType: typeof part.mimeType === 'string' ? part.mimeType : 'application/octet-stream',
    };
    const inline = inlineBytesOf(part);
    if (inline) return { ...named, bytes: inline };
    const attachmentId = attachment.attachmentId ?? record(part.body).attachmentId;
    if (typeof attachmentId !== 'string') throw new GmailNotFoundError('No attachment bytes');
    const body = await session.get(
      `messages/${encodeURIComponent(messageId)}/attachments/${encodeURIComponent(attachmentId)}`,
      {},
    );
    if (typeof body.data !== 'string') throw new GmailProviderError('Gmail returned no data');
    return { ...named, bytes: Buffer.from(body.data, 'base64url') };
  }

  async listSendAs(grant: GmailCallGrant): Promise<GmailSendAs[]> {
    const session = await this.session(grant);
    const aliases = list((await session.get('settings/sendAs', {})).sendAs).map(sendAsOf);
    return aliases.sort((a, b) => Number(b.isDefault) - Number(a.isDefault));
  }

  async readMessage(grant: GmailCallGrant, messageId: string): Promise<GmailMessage> {
    const session = await this.session(grant);
    // Whole on purpose: a forward quotes all of it. Only the model's reads are cut.
    return messageOf(
      await session.get(`messages/${encodeURIComponent(messageId)}`, { format: 'full' }),
      Number.POSITIVE_INFINITY,
    );
  }

  async readDraft(grant: GmailCallGrant, draftId: string): Promise<GmailDraftRead> {
    const session = await this.session(grant);
    const draft = await session.get(`drafts/${encodeURIComponent(draftId)}`, { format: 'full' });
    // Whole on purpose, as `readMessage`: the plan cuts it for the card.
    return {
      id: typeof draft.id === 'string' ? draft.id : draftId,
      message: messageOf(draft.message, Number.POSITIVE_INFINITY),
    };
  }

  async createDraft(grant: GmailCallGrant, message: GmailRawMessage): Promise<GmailDraftRef> {
    const session = await this.session(grant);
    const draft = await session.write('POST', 'drafts', { message: rawBody(message) });
    return { draftId: String(draft.id ?? ''), ...sentRefOf(draft.message) };
  }

  async updateDraft(
    grant: GmailCallGrant,
    draftId: string,
    message: GmailRawMessage,
  ): Promise<GmailDraftRef> {
    const session = await this.session(grant);
    const draft = await session.write('PUT', `drafts/${encodeURIComponent(draftId)}`, {
      id: draftId,
      message: rawBody(message),
    });
    return { draftId: String(draft.id ?? draftId), ...sentRefOf(draft.message) };
  }

  async deleteDraft(grant: GmailCallGrant, draftId: string): Promise<void> {
    const session = await this.session(grant);
    await session.write('DELETE', `drafts/${encodeURIComponent(draftId)}`);
  }

  async sendDraft(grant: GmailCallGrant, draftId: string): Promise<GmailSentRef> {
    const session = await this.session(grant);
    return sentRefOf(await session.send('drafts/send', { id: draftId }));
  }

  async sendMessage(grant: GmailCallGrant, message: GmailRawMessage): Promise<GmailSentRef> {
    const session = await this.session(grant);
    return sentRefOf(await session.send('messages/send', rawBody(message)));
  }

  async modifyThreads(
    grant: GmailCallGrant,
    threadIds: readonly string[],
    change: GmailLabelChange,
  ): Promise<GmailBulkOutcome> {
    const session = await this.session(grant);
    return eachThread(threadIds, (id) =>
      session.write('POST', `threads/${encodeURIComponent(id)}/modify`, {
        addLabelIds: change.add,
        removeLabelIds: change.remove,
      }),
    );
  }

  async modifyMessages(
    grant: GmailCallGrant,
    messageIds: readonly string[],
    change: GmailLabelChange,
  ): Promise<void> {
    const session = await this.session(grant);
    await session.write('POST', 'messages/batchModify', {
      ids: messageIds,
      addLabelIds: change.add,
      removeLabelIds: change.remove,
    });
  }

  async trashThreads(
    grant: GmailCallGrant,
    threadIds: readonly string[],
    trash: boolean,
  ): Promise<GmailBulkOutcome> {
    const session = await this.session(grant);
    const verb = trash ? 'trash' : 'untrash';
    return eachThread(threadIds, (id) =>
      session.write('POST', `threads/${encodeURIComponent(id)}/${verb}`),
    );
  }

  async createLabel(grant: GmailCallGrant, name: string): Promise<GmailLabel> {
    const session = await this.session(grant);
    return labelOf(
      await session.write('POST', 'labels', {
        name,
        labelListVisibility: 'labelShow',
        messageListVisibility: 'show',
      }),
    );
  }

  async revoke(grant: GmailCallGrant): Promise<void> {
    const url = new URL(`${this.config('googleOauthBaseUrl')}/revoke`);
    url.searchParams.set('token', grant.refreshToken);
    await this.fetch(url, { method: 'POST' }, bucketsOf(grant.connectionId)).catch(() => undefined);
  }

  /**
   * An access token for the grant, and a reader of Gmail's `users/me` API
   * with it: one token refresh per port call, never kept beyond it.
   */
  private async session(grant: GmailCallGrant): Promise<GmailSession> {
    const buckets = bucketsOf(grant.connectionId);
    const token = await this.token(
      { refresh_token: grant.refreshToken, grant_type: 'refresh_token' },
      buckets,
    );
    if (typeof token.access_token !== 'string') {
      throw new GmailProviderError('Google returned no access token');
    }
    const accessToken = token.access_token;
    const call = async (
      method: 'GET' | 'POST' | 'PUT' | 'DELETE',
      path: string,
      params: Record<string, string>,
      body?: unknown,
      quota: 'person' | 'either' = 'either',
    ): Promise<Record<string, unknown>> => {
      const url = new URL(`${this.config('gmailApiBaseUrl')}/gmail/v1/users/me/${path}`);
      for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
      const { response, errorBody } = await this.fetch(
        url,
        {
          method,
          headers: {
            authorization: `Bearer ${accessToken}`,
            ...(body === undefined ? {} : { 'content-type': 'application/json' }),
          },
          ...(body === undefined ? {} : { body: JSON.stringify(body) }),
        },
        buckets,
        quota,
      );
      if (response.status === 401) throw new GmailGrantRevokedError('Gmail refused the token');
      if (response.status === 404) throw new GmailNotFoundError(`Gmail has no ${path}`);
      if (errorBody !== null) throw new GmailProviderError(`Gmail answered ${response.status}`);
      return response.status === 204 ? {} : jsonOf(await response.text());
    };
    return {
      get: (path, params) => call('GET', path, params),
      write: (method, path, body) => call(method, path, {}, body),
      send: (path, body) => call('POST', path, {}, body, 'person'),
    };
  }

  /** Google's token endpoint. `invalid_grant` is a grant that is gone, not a fault. */
  private async token(
    fields: Record<string, string>,
    buckets: Bucket[],
  ): Promise<Record<string, unknown>> {
    const { response, errorBody } = await this.fetch(
      new URL(`${this.config('googleOauthBaseUrl')}/token`),
      {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: this.clientId ?? '',
          client_secret: this.clientSecret ?? '',
          ...fields,
        }).toString(),
      },
      buckets,
    );
    if (errorBody !== null) {
      if (jsonOf(errorBody).error === 'invalid_grant') {
        throw new GmailGrantRevokedError('invalid_grant');
      }
      throw new GmailProviderError(`Google token endpoint answered ${response.status}`);
    }
    return jsonOf(await response.text());
  }

  /**
   * Every call to Google, through the limiter. Its rate-limit problem
   * (`MAIL_008`) passes through as is; anything else that kept Google from
   * answering is a `GmailProviderError`.
   */
  private async fetch(
    url: URL,
    init: RequestInit,
    buckets: Bucket[],
    quota: 'person' | 'either' = 'either',
  ): Promise<{ response: Response; errorBody: string | null }> {
    try {
      return await this.limiter.exchange(
        buckets,
        () => fetch(url, { ...init, signal: AbortSignal.timeout(TIMEOUT_MS) }),
        readQuotaRefusal(buckets[0], quota),
      );
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new GmailProviderError(error instanceof Error ? error.message : 'Gmail unreachable');
    }
  }

  private config(key: 'googleAuthUrl' | 'googleOauthBaseUrl' | 'gmailApiBaseUrl'): string {
    return this.configService.getOrThrow<string>(`mail.${key}`);
  }

  private get clientId(): string | undefined {
    return this.configService.get<string>('oauth.google.clientId') || undefined;
  }

  private get clientSecret(): string | undefined {
    return this.configService.get<string>('oauth.google.clientSecret') || undefined;
  }

  private get redirectUri(): string {
    return `${this.configService.getOrThrow<string>('app.frontendUrl')}/settings/mail/google`;
  }
}

/**
 * What a call counts against: the Google account, which is one connection,
 * and the project every account shares.
 */
function bucketsOf(connectionId: string): Bucket[] {
  return [`connection:${connectionId}`, PROJECT];
}

/**
 * Google names a quota refusal in `error.errors[].reason` or `error.status`
 * (`RESOURCE_EXHAUSTED`), and sends it as a 403 as often as a 429. A
 * per-person reason pauses the grant; a per-project one pauses every grant.
 */
function readQuotaRefusal(personBucket: Bucket, quota: 'person' | 'either'): RefusalReader {
  return (errorBody) => {
    const error = record(jsonOf(errorBody).error);
    const reasons = list(error.errors).map((entry) => String(record(entry).reason ?? ''));
    const limited =
      reasons.some((reason) => PERSON_REASONS.has(reason) || PROJECT_REASONS.has(reason)) ||
      error.status === 'RESOURCE_EXHAUSTED';
    if (quota === 'person' && limited) return { limited: true, bucket: personBucket };
    if (reasons.some((reason) => PERSON_REASONS.has(reason))) {
      return { limited: true, bucket: personBucket };
    }
    if (
      reasons.some((reason) => PROJECT_REASONS.has(reason)) ||
      error.status === 'RESOURCE_EXHAUSTED'
    ) {
      return { limited: true, bucket: PROJECT };
    }
    return { limited: false };
  };
}

/** A message as Gmail's API takes it: the whole of it, base64url, in its thread when it has one. */
function rawBody(message: GmailRawMessage): Record<string, string> {
  return {
    raw: message.raw.toString('base64url'),
    ...(message.threadId ? { threadId: message.threadId } : {}),
  };
}

function jsonOf(text: string): Record<string, unknown> {
  try {
    return record(JSON.parse(text));
  } catch {
    return {};
  }
}

function record(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function list(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

/**
 * One write per thread, in order, so a call over many stays inside Gmail's
 * per-second quota; a thread Gmail does not have is listed, the rest go on.
 */
async function eachThread(
  threadIds: readonly string[],
  write: (id: string) => Promise<unknown>,
): Promise<GmailBulkOutcome> {
  const outcome: GmailBulkOutcome = { changed: [], missing: [] };
  for (const id of threadIds) {
    try {
      await write(id);
      outcome.changed.push(id);
    } catch (error) {
      if (!(error instanceof GmailNotFoundError)) throw error;
      outcome.missing.push(id);
    }
  }
  return outcome;
}
