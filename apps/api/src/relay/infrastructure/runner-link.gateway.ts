import type { IncomingMessage } from 'node:http';
import type { Duplex } from 'node:stream';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  helloSchema,
  LINK_MAX_FRAME_BYTES,
  PROTOCOL_VERSION,
  type ProtocolMessage,
  protocolMessageSchema,
  RUNNER_LINK_CLOSE_CODES,
  RUNNER_LINK_REFUSALS,
  welcomeSchema,
} from '@oppenheimer/shared/protocol';
import { type WebSocket, WebSocketServer } from 'ws';
import type { HostAssertionPort } from '../../hosts/application/host-assertion.port';
import { HOST_ASSERTION } from '../../hosts/hosts.di-tokens';
import type { LinkRegistryPort } from '../../links/application/link-registry.port';
import { LINK_REGISTRY } from '../../links/links.di-tokens';
import { clientAddressOf } from './client-address.util';
import { CredentialsProcessor } from './credentials.processor';
import { decodeFrame } from './frame.util';
import { type AppendQueueLimits, type AppendRun, LinkAppendQueue } from './link-append-queue.util';
import { RelayEventsProcessor } from './relay-events.processor';
import { SocketRunnerLink } from './socket-runner-link.adapter';
import { refuseUpgrade } from './upgrade.util';

/** The path a runner dials, under the API's global prefix and version. */
export const RUNNER_LINK_PATH = '/api/v1/relay/runner';

/** How long the runner has to say hello after the upgrade. */
export const HELLO_TIMEOUT_MS = 10_000;

/**
 * How often the control plane pings a runner. A link that has not answered the
 * previous ping by the next one is terminated: a TCP connection that died
 * without a close — a NAT that forgot it, a host that lost power — otherwise
 * stays registered, and browsers attach to a host that cannot hear them.
 */
export const LINK_PING_INTERVAL_MS = 15_000;

/**
 * The largest frame a runner may send, enforced by `ws` while it reads: a
 * bigger one is refused with 1009 before it is buffered. A control frame larger
 * than this is not a control frame, and a binary PTY frame is at most 32 KiB
 * plus its header, so every legitimate frame fits. It is the protocol's
 * `LINK_MAX_FRAME_BYTES`, which the runner is generated from and holds itself
 * to when it sends.
 */
export const MAX_RUNNER_FRAME_BYTES = LINK_MAX_FRAME_BYTES;

/**
 * A link's `events.append` queue (`LinkAppendQueue`). The numbers are batches,
 * and a batch is up to 256 events of up to 8 KB each, so the ceiling bounds a
 * link's queued appends in memory as well as in latency.
 */
export const APPEND_QUEUE_LIMITS: AppendQueueLimits = {
  /**
   * Waiting batches at which the socket stops being read. Everything on the
   * link pauses with it — heartbeats, PTY bytes, refusals — and that is the
   * point: a link the database cannot keep up with is overloaded as a whole,
   * and the runner's own bounded queue is where the rest should wait.
   */
  pauseAt: 64,
  /** Waiting batches at which it is read again. */
  resumeAt: 16,
  /**
   * The hard ceiling. Only frames the socket had already read before the pause
   * can take the queue past `pauseAt`; reaching this closes the link with 1013.
   */
  closeAt: 256,
  /**
   * How long a pause may last before the link is closed with 1013. The runner
   * redials and resends every unacked batch after its hello, so a database that
   * is stuck costs a reconnect rather than a socket held open forever — and the
   * keepalive, which cannot read a pong while paused, is not what ends it.
   */
  maxPauseMs: 10_000,
  /** The protocol's own cap on one `events.append`, so a coalesced append is a batch the log already takes. */
  maxEventsPerAppend: 256,
};

/** "Try again later": the link is overloaded, not broken. */
const LINK_OVERLOADED = 1013;

/**
 * Oldest protocol this control plane still speaks. The window is N-2 minor
 * versions of the runner (03); with one protocol version in existence the
 * floor is that version, and this is the constant that moves when it is not.
 */
export const MIN_SUPPORTED_PROTOCOL = PROTOCOL_VERSION;

/**
 * The server half of the runner link.
 *
 * The handshake is the boot assertion as a bearer, verified by the hosts
 * module's port — the same credential `DELETE /hosts/self` takes, verified
 * exactly once per dial because verifying burns the `jti`. A socket that
 * presents none is refused before the upgrade, so it never costs a frame.
 *
 * The assertion says *which* host is dialling, and whether that host has been
 * unpaired — an unpaired host still authenticates, because its own uninstall
 * has to. The handshake refuses one with `410`, the runner's cue to stop
 * dialling rather than walk its ladder forever. One unpaired while connected
 * is closed with `4410`, the same answer after the upgrade
 * (`RUNNER_LINK_CLOSE_CODES`).
 *
 * After the upgrade the first frame must be `hello`; anything else, or nothing
 * within the timeout, closes the socket. A runner below `MIN_SUPPORTED_PROTOCOL`
 * is refused **with** `update_required` rather than dropped (01).
 */
@Injectable()
export class RunnerLinkGateway {
  /** Each link's `events.append` messages, applied in arrival order (see `LinkAppendQueue`). */
  private readonly appendQueues = new WeakMap<SocketRunnerLink, LinkAppendQueue>();

  private readonly logger = new Logger(RunnerLinkGateway.name);
  private readonly server = new WebSocketServer({
    noServer: true,
    maxPayload: MAX_RUNNER_FRAME_BYTES,
  });

  constructor(
    @Inject(HOST_ASSERTION)
    private readonly assertions: HostAssertionPort,
    @Inject(LINK_REGISTRY)
    private readonly links: LinkRegistryPort,
    private readonly events: RelayEventsProcessor,
    private readonly credentials: CredentialsProcessor,
    private readonly configService: ConfigService,
  ) {}

  async handleUpgrade(request: IncomingMessage, socket: Duplex, head: Buffer): Promise<void> {
    if (!this.keyFingerprint) {
      // F6 is "pin what registration returned". Without a signing key there is
      // nothing to have returned, and advertising an empty pin would make the
      // runner's check either refuse everything or accept anything.
      refuseUpgrade(socket, 503, 'this control plane has no signing key configured');
      return;
    }
    const bearer = bearerOf(request.headers.authorization);
    if (!bearer || !this.assertions.recognises(bearer)) {
      refuseUpgrade(socket, 401, 'a runner presents its boot assertion as a bearer');
      return;
    }
    let hostId: string;
    let unpaired: boolean;
    try {
      ({ hostId, unpaired } = await this.assertions.verify(bearer));
    } catch {
      refuseUpgrade(socket, 401, 'boot assertion rejected');
      return;
    }
    if (unpaired) {
      refuseUpgrade(
        socket,
        410,
        'this host was unpaired; pair it again from Add host',
        RUNNER_LINK_REFUSALS.UNPAIRED,
      );
      return;
    }
    // Read before the upgrade: the address the link came from is a fact about
    // this request, and the socket is handed over as soon as it is accepted.
    const address = clientAddressOf(request, this.trustedProxyHops);
    this.server.handleUpgrade(request, socket, head, (ws) => this.accept(ws, hostId, address));
  }

  private accept(ws: WebSocket, hostId: string, address: string | null): void {
    const timer = setTimeout(
      () => ws.close(RUNNER_LINK_CLOSE_CODES.HELLO_TIMEOUT, 'hello expected'),
      HELLO_TIMEOUT_MS,
    );
    ws.once('message', (data, isBinary) => {
      clearTimeout(timer);
      if (isBinary) {
        ws.close(RUNNER_LINK_CLOSE_CODES.HELLO_EXPECTED, 'hello expected');
        return;
      }
      const hello = helloSchema.safeParse(parseJson(data as Buffer));
      if (!hello.success) {
        this.logger.warn({ message: 'hello rejected', hostId, issues: hello.error.issues.length });
        ws.close(RUNNER_LINK_CLOSE_CODES.HELLO_EXPECTED, 'hello expected');
        return;
      }
      const range = `this control plane speaks protocol ${MIN_SUPPORTED_PROTOCOL}..${PROTOCOL_VERSION}`;
      if (hello.data.protocol.max < MIN_SUPPORTED_PROTOCOL) {
        ws.send(JSON.stringify({ type: 'hint', kind: 'update_required', detail: range }));
        ws.close(RUNNER_LINK_CLOSE_CODES.PROTOCOL_MISMATCH, 'update required');
        return;
      }
      if (hello.data.protocol.min > PROTOCOL_VERSION) {
        // A runner newer than this control plane: nothing it can update to, so
        // it is told to wait rather than to update.
        ws.send(
          JSON.stringify({ type: 'hint', kind: 'blocked', retryAfterSeconds: 300, detail: range }),
        );
        ws.close(RUNNER_LINK_CLOSE_CODES.PROTOCOL_MISMATCH, 'protocol too new');
        return;
      }
      void this.open(ws, hostId, hello.data, address);
    });
    ws.on('error', (error) => {
      this.logger.warn({
        message: 'runner socket error before hello',
        hostId,
        error: error.message,
      });
    });
  }

  private async open(
    ws: WebSocket,
    hostId: string,
    hello: ReturnType<typeof helloSchema.parse>,
    address: string | null,
  ): Promise<void> {
    const link = new SocketRunnerLink(
      hostId,
      hello.runId,
      this.links.nextEpoch(hostId),
      ws,
      hello.capabilities,
    );
    const replaced = this.links.register(link);
    if (replaced instanceof SocketRunnerLink) {
      // The same host again, faster than its old socket noticed: the newer link
      // wins, and the older one's browsers reconnect through the new epoch.
      replaced.close(RUNNER_LINK_CLOSE_CODES.REPLACED, 'replaced by a newer link');
    }

    let alive = true;
    let pingSentAt = 0;
    const appends = new LinkAppendQueue(
      (run) => this.applyAppends(link, run),
      {
        pause: () => ws.pause(),
        resume: () => {
          // A pong that arrived while paused is read now; the next beat judges.
          alive = true;
          ws.resume();
        },
        overflow: (reason) => {
          this.logger.warn({
            message: 'runner link overloaded; closing so it resends later',
            hostId,
            reason,
          });
          // Read again so the close handshake can complete; the queue is already
          // disposed, so nothing more is applied.
          ws.resume();
          link.close(LINK_OVERLOADED, 'append queue overloaded; try again later');
        },
      },
      APPEND_QUEUE_LIMITS,
    );
    this.appendQueues.set(link, appends);

    ws.on('message', (data, isBinary) => {
      if (isBinary) {
        this.onBinary(link, data as Buffer);
        return;
      }
      void this.onControl(link, data as Buffer);
    });
    ws.on('pong', () => {
      alive = true;
      // The keepalive's own ping, timed: the "echo 41 ms" a host row shows.
      if (pingSentAt) link.roundTripMillis = Date.now() - pingSentAt;
    });
    const keepAlive = setInterval(() => {
      // A paused socket reads no pongs, so a missed one proves nothing while
      // the pause is on purpose. The queue's own maximum pause ends a link that
      // stays stuck.
      if (appends.paused) return;
      if (!alive) {
        this.logger.warn({ message: 'runner link missed a pong; terminating', hostId });
        ws.terminate();
        return;
      }
      alive = false;
      pingSentAt = Date.now();
      ws.ping();
    }, LINK_PING_INTERVAL_MS);
    keepAlive.unref();

    ws.on('close', (code, reason) => {
      clearInterval(keepAlive);
      appends.dispose();
      this.links.unregister(link);
      for (const sink of link.drainAttachments()) sink.closed('link_lost');
      this.logger.log({
        message: 'runner link down',
        hostId,
        epoch: link.epoch,
        code,
        reason: reason.toString(),
      });
    });
    ws.on('error', (error) => {
      this.logger.warn({ message: 'runner socket error', hostId, error: error.message });
    });

    // Parsed through the same schema the runner parses it with: what leaves this
    // process is what the shared package says leaves it.
    link.send(
      welcomeSchema.parse({
        type: 'welcome',
        protocol: PROTOCOL_VERSION,
        keyFingerprint: this.keyFingerprint,
        hostId,
        epoch: link.epoch,
      }),
    );
    try {
      await this.events.onHello(link, hello, link.connectedAt, address);
    } catch (error) {
      this.logger.error({ message: 'hello could not be recorded', hostId, error: String(error) });
    }
  }

  private onBinary(link: SocketRunnerLink, frame: Buffer): void {
    const decoded = decodeFrame(frame);
    if (!decoded) return;
    // A frame for an attachment that is already gone is dropped here: the
    // browser detached and the runner has not yet processed the detach.
    link.attachment(decoded.attachmentId)?.deliver(decoded.bytes);
  }

  private async onControl(link: SocketRunnerLink, data: Buffer): Promise<void> {
    // No size check here: `maxPayload` has already refused anything larger than
    // `MAX_RUNNER_FRAME_BYTES` with 1009, before buffering it.
    const parsed = protocolMessageSchema.safeParse(parseJson(data));
    if (!parsed.success) {
      this.logger.warn({ message: 'unparseable control frame from runner', hostId: link.hostId });
      return;
    }
    const message = parsed.data;
    if (message.type === 'events.append') {
      // In arrival order, coalesced, and bounded: see `LinkAppendQueue`. Every
      // other message still runs on its own, so a credential ask never queues
      // behind the log.
      this.appendQueues.get(link)?.push(message);
      return;
    }
    return this.process(link, message);
  }

  /** One coalesced run of a link's batches; a failure is logged, never thrown. */
  private async applyAppends(link: SocketRunnerLink, run: AppendRun): Promise<void> {
    try {
      await this.events.onEventsAppend(link, run);
    } catch (error) {
      this.logger.error({
        message: 'a runner message could not be processed',
        hostId: link.hostId,
        type: 'events.append',
        batches: run.length,
        error: String(error),
      });
    }
  }

  /** Dispatch one message; a failure is logged, never thrown, so a chain keeps going. */
  private async process(link: SocketRunnerLink, message: ProtocolMessage): Promise<void> {
    try {
      await this.dispatch(link, message);
    } catch (error) {
      this.logger.error({
        message: 'a runner message could not be processed',
        hostId: link.hostId,
        type: message.type,
        error: String(error),
      });
    }
  }

  private async dispatch(link: SocketRunnerLink, message: ProtocolMessage): Promise<void> {
    switch (message.type) {
      case 'heartbeat':
        return this.events.onHeartbeat(link, message);
      case 'events.append':
        // Queued in `onControl`; never dispatched one by one.
        return;
      case 'command.failed': {
        // An attach's refusal is its browser's; any other is the session's.
        const sink = link.attachmentByCommand(message.commandId);
        if (sink) {
          sink.refused(message.code, message.detail);
          return;
        }
        return this.events.onCommandFailed(link, message);
      }
      case 'attachment.closed':
        link.attachment(message.attachmentId)?.closed('runner_closed', message.reason);
        link.closeAttachment(message.attachmentId);
        return;
      case 'credentials.token':
        return this.credentials.onToken(link, message);
      case 'hello':
        // A second hello on an open link is a runner bug, not a reconnect.
        link.close(RUNNER_LINK_CLOSE_CODES.HELLO_EXPECTED, 'hello already received');
        return;
      default:
        // Every other type is control plane → runner; a runner sending one is
        // ignored rather than trusted.
        this.logger.warn({
          message: 'unexpected message from runner',
          hostId: link.hostId,
          type: message.type,
        });
    }
  }

  /** The fingerprint registration handed every host, which the runner pins. */
  /** `TRUST_PROXY`: how many reverse-proxy hops to believe in `X-Forwarded-For`. */
  private get trustedProxyHops(): number {
    return this.configService.get<number>('app.trustProxy') ?? 0;
  }

  private get keyFingerprint(): string | null {
    const value = this.configService.get<string>('hosts.signingKeyFingerprint');
    return value && /^[0-9a-f]{64}$/.test(value) ? value : null;
  }
}

function bearerOf(header: string | undefined): string | null {
  if (!header) return null;
  const [scheme, token] = header.split(' ', 2);
  return scheme?.toLowerCase() === 'bearer' && token ? token.trim() : null;
}

function parseJson(data: Buffer): unknown {
  try {
    return JSON.parse(data.toString('utf8'));
  } catch {
    return undefined;
  }
}
