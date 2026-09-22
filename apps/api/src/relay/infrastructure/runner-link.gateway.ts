import type { IncomingMessage } from 'node:http';
import type { Duplex } from 'node:stream';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  helloSchema,
  PROTOCOL_VERSION,
  type ProtocolMessage,
  protocolMessageSchema,
  welcomeSchema,
} from '@oppenheimer/shared/protocol';
import { type WebSocket, WebSocketServer } from 'ws';
import type { HostAssertionPort } from '../../hosts/application/host-assertion.port';
import { HOST_ASSERTION } from '../../hosts/hosts.di-tokens';
import type { LinkRegistryPort } from '../../links/application/link-registry.port';
import { LINK_REGISTRY } from '../../links/links.di-tokens';
import { CredentialsProcessor } from './credentials.processor';
import { decodeFrame } from './frame.util';
import { RelayEventsProcessor } from './relay-events.processor';
import { SocketRunnerLink } from './socket-runner-link.adapter';
import { refuseUpgrade } from './upgrade.util';

/** The path a runner dials, under the API's global prefix and version. */
export const RUNNER_LINK_PATH = '/api/v1/relay/runner';

/** How long the runner has to say hello after the upgrade. */
export const HELLO_TIMEOUT_MS = 10_000;

/** A control frame larger than this is not a control frame. */
const MAX_CONTROL_FRAME_BYTES = 512 * 1024;

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
 * After the upgrade the first frame must be `hello`; anything else, or nothing
 * within the timeout, closes the socket. A runner below `MIN_SUPPORTED_PROTOCOL`
 * is refused **with** `update_required` rather than dropped (01).
 */
@Injectable()
export class RunnerLinkGateway {
  private readonly logger = new Logger(RunnerLinkGateway.name);
  private readonly server = new WebSocketServer({ noServer: true, maxPayload: 16 * 1024 * 1024 });

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
    try {
      ({ hostId } = await this.assertions.verify(bearer));
    } catch {
      refuseUpgrade(socket, 401, 'boot assertion rejected');
      return;
    }
    this.server.handleUpgrade(request, socket, head, (ws) => this.accept(ws, hostId));
  }

  private accept(ws: WebSocket, hostId: string): void {
    const timer = setTimeout(() => ws.close(4408, 'hello expected'), HELLO_TIMEOUT_MS);
    ws.once('message', (data, isBinary) => {
      clearTimeout(timer);
      if (isBinary) {
        ws.close(4400, 'hello expected');
        return;
      }
      const hello = helloSchema.safeParse(parseJson(data as Buffer));
      if (!hello.success) {
        this.logger.warn({ message: 'hello rejected', hostId, issues: hello.error.issues.length });
        ws.close(4400, 'hello expected');
        return;
      }
      const range = `this control plane speaks protocol ${MIN_SUPPORTED_PROTOCOL}..${PROTOCOL_VERSION}`;
      if (hello.data.protocol.max < MIN_SUPPORTED_PROTOCOL) {
        ws.send(JSON.stringify({ type: 'hint', kind: 'update_required', detail: range }));
        ws.close(4426, 'update required');
        return;
      }
      if (hello.data.protocol.min > PROTOCOL_VERSION) {
        // A runner newer than this control plane: nothing it can update to, so
        // it is told to wait rather than to update.
        ws.send(
          JSON.stringify({ type: 'hint', kind: 'blocked', retryAfterSeconds: 300, detail: range }),
        );
        ws.close(4426, 'protocol too new');
        return;
      }
      void this.open(ws, hostId, hello.data);
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
  ): Promise<void> {
    const link = new SocketRunnerLink(hostId, hello.runId, this.links.nextEpoch(hostId), ws);
    const replaced = this.links.register(link);
    if (replaced instanceof SocketRunnerLink) {
      // The same host again, faster than its old socket noticed: the newer link
      // wins, and the older one's browsers reconnect through the new epoch.
      replaced.close(4409, 'replaced by a newer link');
    }

    ws.on('message', (data, isBinary) => {
      if (isBinary) {
        this.onBinary(link, data as Buffer);
        return;
      }
      void this.onControl(link, data as Buffer);
    });
    ws.on('close', (code, reason) => {
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
      await this.events.onHello(link, hello);
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
    if (data.byteLength > MAX_CONTROL_FRAME_BYTES) {
      link.close(1009, 'control frame too large');
      return;
    }
    const parsed = protocolMessageSchema.safeParse(parseJson(data));
    if (!parsed.success) {
      this.logger.warn({ message: 'unparseable control frame from runner', hostId: link.hostId });
      return;
    }
    try {
      await this.dispatch(link, parsed.data);
    } catch (error) {
      this.logger.error({
        message: 'a runner message could not be processed',
        hostId: link.hostId,
        type: parsed.data.type,
        error: String(error),
      });
    }
  }

  private async dispatch(link: SocketRunnerLink, message: ProtocolMessage): Promise<void> {
    switch (message.type) {
      case 'heartbeat':
        return this.events.onHeartbeat(link, message);
      case 'events.append':
        return this.events.onEventsAppend(link, message);
      case 'command.failed':
        link.attachmentByCommand(message.commandId)?.refused(message.code, message.detail);
        return;
      case 'attachment.closed':
        link.attachment(message.attachmentId)?.closed('runner_closed', message.reason);
        link.closeAttachment(message.attachmentId);
        return;
      case 'credentials.token':
        return this.credentials.onToken(link, message);
      case 'hello':
        // A second hello on an open link is a runner bug, not a reconnect.
        link.close(4400, 'hello already received');
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
