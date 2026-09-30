import { expect, type Page, type Request, type Response, type WebSocket } from '@playwright/test';
import { query } from './db';
import type { SessionRow } from './sessions';

/**
 * The hops of one session's start as the console lives them, in milliseconds
 * from the click on Send, beside the runner's own `session.step` durations.
 *
 * Only this page's requests for **the session the create returned** count:
 * paths are matched whole, and the id comes from the 201's body, not the URL.
 */
export type Hop =
  | 'post_201'
  | 'navigated'
  | 'server_started'
  | 'poll_open'
  | 'ticket_ok'
  | 'ws_open'
  | 'first_byte'
  | 'shim_drawn'
  | 'settled';

/** What a run must have measured to be a run at all. */
const REQUIRED_HOPS = [
  'post_201',
  'navigated',
  'server_started',
  'ticket_ok',
  'ws_open',
  'poll_open',
  'first_byte',
  'settled',
] as const satisfies readonly Hop[];
const REQUIRED_STEPS = ['clone', 'worktree', 'agent'] as const;

export interface BootRun {
  sessionId: string;
  hops: Partial<Record<Hop, number>> & Record<(typeof REQUIRED_HOPS)[number], number>;
  steps: Record<(typeof REQUIRED_STEPS)[number], number>;
  /** When each poll that carried the session answered, and what it said. */
  polls: { at: number; source: 'list' | 'detail'; lifecycle: SessionRow['lifecycle'] }[];
}

/** What the fleet's `claude` shim prints first (`e2e/fleet/claude`). */
const SHIM_MARKER = 'CLAUDE-SHIM argv=';
const QUIET_MS = 1_500;
const UUID = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';
/** The create (POST) and the list (GET) share a path. */
const CREATE = /^\/api\/v1\/sessions$/;
const DETAIL = new RegExp(`^/api/v1/sessions/(${UUID})$`);
const TICKET = new RegExp(`^/api/v1/sessions/(${UUID})/attach-ticket$`);

const pathOf = (url: string) => new URL(url).pathname;

export class BootRecorder {
  private t0 = 0;
  private sessionId: string | undefined;
  private readonly hops: Partial<Record<Hop, number>> = {};
  private readonly polls: BootRun['polls'] = [];
  /** Response bodies still being read: Playwright does not await listeners. */
  private readonly pending: Promise<void>[] = [];
  private lastFrame = 0;

  constructor(private readonly page: Page) {
    page.on('response', this.onResponse);
    page.on('websocket', this.onSocket);
  }

  /** The click on Send is time zero. */
  start(): void {
    this.t0 = Date.now();
  }

  private at = () => Date.now() - this.t0;

  private mark(hop: Hop, at = this.at()): void {
    if (this.t0 && this.hops[hop] === undefined) this.hops[hop] = at;
  }

  private onResponse = (response: Response): void => {
    if (!this.t0) return;
    const request: Request = response.request();
    const path = pathOf(response.url());
    const at = this.at();
    if (request.method() === 'POST' && CREATE.test(path) && response.status() === 201) {
      this.mark('post_201', at);
      this.pending.push(
        response.json().then((body: { id: string }) => {
          this.sessionId = body.id;
        }),
      );
      return;
    }
    const ticket = TICKET.exec(path);
    if (request.method() === 'POST' && ticket && response.ok()) {
      this.pending.push(
        this.idKnown().then(() => {
          if (ticket[1] === this.sessionId) this.mark('ticket_ok', at);
        }),
      );
      return;
    }
    // The console learns `open` from whichever of its polls answers first:
    // the session list, or the session's own detail.
    const detail = DETAIL.exec(path);
    const list = CREATE.test(path);
    if (request.method() === 'GET' && (detail || list) && response.ok()) {
      this.pending.push(
        Promise.all([response.json(), this.idKnown()]).then(([body]) => {
          const rows: SessionRow[] = list
            ? (body as { data: SessionRow[] }).data
            : [body as SessionRow];
          const row = rows.find((candidate) => candidate.id === this.sessionId);
          if (!row) return;
          this.polls.push({ at, source: list ? 'list' : 'detail', lifecycle: row.lifecycle });
          if (row.lifecycle === 'open') this.mark('poll_open', at);
        }),
      );
    }
  };

  private onSocket = (socket: WebSocket): void => {
    if (!this.t0 || pathOf(socket.url()) !== '/api/v1/relay/attach') return;
    this.mark('ws_open');
    let tail = '';
    socket.on('framereceived', (frame) => {
      if (typeof frame.payload === 'string') return;
      this.mark('first_byte');
      this.lastFrame = this.at();
      // The tail keeps a marker split across two frames findable.
      const text = tail + frame.payload.toString();
      if (text.includes(SHIM_MARKER)) this.mark('shim_drawn');
      tail = text.slice(-SHIM_MARKER.length);
    });
  };

  private async idKnown(): Promise<void> {
    await expect.poll(() => this.sessionId, { timeout: 30_000 }).toBeDefined();
  }

  /** The session's URL is the one the create returned. */
  async navigated(): Promise<string> {
    await this.idKnown();
    const id = this.sessionId as string;
    await expect(this.page).toHaveURL(new RegExp(`/sessions/${id}$`), { timeout: 60_000 });
    this.mark('navigated');
    return id;
  }

  /** Waits for the first bytes and a quiet screen after them. */
  async settled(timeout = 180_000): Promise<void> {
    await expect.poll(() => this.hops.first_byte, { timeout }).toBeDefined();
    await expect.poll(() => this.at() - this.lastFrame > QUIET_MS, { timeout: 60_000 }).toBe(true);
    this.mark('settled', this.lastFrame);
  }

  /** Stops listening and returns the run, failing on any hop it lacks. */
  async finish(): Promise<BootRun> {
    this.page.off('response', this.onResponse);
    this.page.off('websocket', this.onSocket);
    await Promise.all(this.pending);
    const sessionId = this.sessionId as string;

    const events = await query<{ kind: string; payload: Record<string, unknown>; at: Date }>(
      `select kind, payload, "recordedAt" as at from work_session_event
        where "sessionId" = $1 order by seq`,
      [sessionId],
    );
    const steps: Partial<Record<string, number>> = {};
    for (const event of events) {
      if (event.kind === 'session.step' && event.payload.status === 'done') {
        steps[String(event.payload.step)] = Number(event.payload.durationMs);
      }
      if (event.kind === 'session.started') {
        this.mark('server_started', new Date(event.at).getTime() - this.t0);
      }
    }

    const missingHops = REQUIRED_HOPS.filter((hop) => this.hops[hop] === undefined);
    const missingSteps = REQUIRED_STEPS.filter((step) => steps[step] === undefined);
    expect(missingHops, `hops never measured for ${sessionId}`).toEqual([]);
    expect(missingSteps, `session.step never reported for ${sessionId}`).toEqual([]);
    return {
      sessionId,
      hops: this.hops as BootRun['hops'],
      steps: steps as BootRun['steps'],
      polls: this.polls,
    };
  }
}
