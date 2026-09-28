import type { IncomingMessage, Server } from 'node:http';
import type { Duplex } from 'node:stream';
import { Injectable, Logger, type OnApplicationBootstrap } from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import { BROWSER_ATTACH_PATH, BrowserAttachGateway } from './browser-attach.gateway';
import { RUNNER_LINK_PATH, RunnerLinkGateway } from './runner-link.gateway';
import { refuseUpgrade } from './upgrade.util';

/**
 * Mounts the two sockets on the API's own HTTP server.
 *
 * They are `upgrade` listeners rather than Nest gateways because neither is a
 * request/response pair: the runner link is a long-lived multiplexed stream and
 * the attach socket carries raw PTY bytes, and the credential each takes lives
 * in the handshake — a bearer header and a subprotocol — where Nest's pipeline
 * would not look for it. The path split is here so each gateway only ever sees
 * an upgrade meant for it.
 */
@Injectable()
export class RelayUpgradeGateway implements OnApplicationBootstrap {
  private readonly logger = new Logger(RelayUpgradeGateway.name);

  constructor(
    private readonly adapterHost: HttpAdapterHost,
    private readonly runners: RunnerLinkGateway,
    private readonly browsers: BrowserAttachGateway,
  ) {}

  onApplicationBootstrap(): void {
    const server = this.adapterHost.httpAdapter?.getHttpServer?.() as Server | undefined;
    if (!server || typeof server.on !== 'function') {
      this.logger.warn({ message: 'no HTTP server to mount the relay on; sockets disabled' });
      return;
    }
    this.mount(server);
  }

  mount(server: Server): void {
    server.on('upgrade', (request: IncomingMessage, socket: Duplex, head: Buffer) => {
      void this.route(request, socket, head);
    });
    this.logger.log({
      message: 'relay mounted',
      runner: RUNNER_LINK_PATH,
      attach: BROWSER_ATTACH_PATH,
    });
  }

  async route(request: IncomingMessage, socket: Duplex, head: Buffer): Promise<void> {
    const pathname = pathnameOf(request.url);
    // Node's HTTP server drops its own error listener when it hands a socket to
    // an 'upgrade' listener, and `ws` only adds one inside `handleUpgrade`. A
    // peer that resets while a gateway awaits (the runner's assertion) would
    // otherwise raise an 'error' nobody hears, which takes the process down.
    socket.on('error', (error) => {
      this.logger.debug({ message: 'upgrade socket error', pathname, error: error.message });
    });
    try {
      switch (pathname) {
        case RUNNER_LINK_PATH:
          await this.runners.handleUpgrade(request, socket, head);
          return;
        case BROWSER_ATTACH_PATH:
          await this.browsers.handleUpgrade(request, socket, head);
          return;
        default:
          refuseUpgrade(socket, 404, 'no such socket');
      }
    } catch (error) {
      this.logger.error({ message: 'upgrade failed', pathname, error: String(error) });
      refuseUpgrade(socket, 500, 'upgrade failed');
    }
  }
}

/** A request target `URL` cannot parse (`http://[`) routes nowhere, rather than throwing. */
function pathnameOf(url: string | undefined): string {
  try {
    return new URL(url ?? '/', 'http://relay.invalid').pathname;
  } catch {
    return '';
  }
}
