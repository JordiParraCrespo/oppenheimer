import { lookup } from 'node:dns/promises';
import { request as httpRequest, type IncomingMessage } from 'node:http';
import { request as httpsRequest } from 'node:https';
import { isIP, type LookupFunction } from 'node:net';
import { Injectable } from '@nestjs/common';
import { isPublicAddress, refuseUrl } from '../domain/web-address.policy';
import type { WebPagePort, WebPageResult } from './web-page.port';

/** Redirects followed before giving up. */
const MAX_REDIRECTS = 5;
/** One fetch, redirects included. */
const FETCH_TIMEOUT_MS = 15_000;
/** The most of a body that is read; the rest is cut. */
const MAX_BODY_BYTES = 2 * 1024 * 1024;
const USER_AGENT = 'OppenheimerBot/1.0 (+https://oppenheimer.dev/bots)';

const TEXT_TYPES = /^(text\/|application\/(json|xml|xhtml\+xml|[\w.+-]+\+(json|xml))\b)/i;

/**
 * `web_fetch` over Node's own HTTP client, so the address checked is the
 * address connected to: a host name is resolved here, every answer must be
 * public (`isPublicAddress`), and the connection is pinned to the first one
 * (no second lookup an attacker's DNS could answer differently). Redirects
 * are followed by hand and each is checked again. No cookies, no auth, no
 * proxy, a fixed user agent; 15 s and 2 MB at most.
 *
 * Budget (`integrations.md`): the web is not one system with one limit, so
 * the bound is ours: `web_fetch` allows a turn ten calls, and a turn at most
 * one call at a time.
 */
@Injectable()
export class GuardedWebPageAdapter implements WebPagePort {
  async fetch(url: string, signal: AbortSignal): Promise<WebPageResult> {
    let current: URL;
    try {
      current = new URL(url);
    } catch {
      return { kind: 'refused', reason: 'That is not a valid URL.' };
    }
    const deadline = AbortSignal.any([signal, AbortSignal.timeout(FETCH_TIMEOUT_MS)]);
    for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
      const refusal = refuseUrl(current);
      if (refusal) return { kind: 'refused', reason: refusal };
      const pinned = await this.resolve(current.hostname.replace(/^\[|\]$/g, ''));
      if ('reason' in pinned) return { kind: 'refused', reason: pinned.reason };
      let response: Response;
      try {
        response = await this.get(current, pinned, deadline);
      } catch (error) {
        return { kind: 'failed', reason: describeNetworkError(error, deadline) };
      }
      if (response.status >= 300 && response.status < 400 && response.location) {
        current = new URL(response.location, current);
        continue;
      }
      return this.page(current, response);
    }
    return { kind: 'failed', reason: `More than ${MAX_REDIRECTS} redirects.` };
  }

  /** The address to connect to, every one the name resolves to having been checked. */
  private async resolve(
    host: string,
  ): Promise<{ address: string; family: number } | { reason: string }> {
    if (isIP(host)) return { address: host, family: isIP(host) };
    let addresses: { address: string; family: number }[];
    try {
      addresses = await lookup(host, { all: true, verbatim: true });
    } catch {
      return { reason: `The name ${host} does not resolve.` };
    }
    if (addresses.length === 0 || addresses.some(({ address }) => !isPublicAddress(address))) {
      return { reason: 'That address is not on the public internet.' };
    }
    return addresses[0];
  }

  private get(
    url: URL,
    pinned: { address: string; family: number },
    signal: AbortSignal,
  ): Promise<Response> {
    const pin: LookupFunction = (_hostname, options, callback) => {
      if ((options as { all?: boolean }).all) {
        (callback as unknown as (error: null, addresses: object[]) => void)(null, [pinned]);
      } else callback(null, pinned.address, pinned.family);
    };
    const send = url.protocol === 'https:' ? httpsRequest : httpRequest;
    return new Promise((resolve, reject) => {
      const outgoing = send(
        url,
        {
          method: 'GET',
          lookup: pin,
          agent: false,
          signal,
          headers: {
            'user-agent': USER_AGENT,
            accept: 'text/html, text/plain, application/json, */*;q=0.5',
          },
        },
        (incoming) => readBody(incoming).then(resolve, reject),
      );
      outgoing.on('error', reject);
      outgoing.end();
    });
  }

  private page(url: URL, response: Response): WebPageResult {
    const contentType = (response.contentType ?? 'unknown').split(';')[0].trim();
    if (!TEXT_TYPES.test(contentType)) {
      return { kind: 'refused', reason: `Not a text page (${contentType}); it was not read.` };
    }
    const raw = response.body.toString('utf8');
    const html = /html/i.test(contentType);
    return {
      kind: 'page',
      page: {
        url: url.toString(),
        status: response.status,
        contentType,
        title: html ? titleOf(raw) : null,
        text: html ? htmlToText(raw) : raw,
        truncated: response.truncated,
      },
    };
  }
}

interface Response {
  status: number;
  location: string | null;
  contentType: string | null;
  body: Buffer;
  truncated: boolean;
}

function readBody(incoming: IncomingMessage): Promise<Response> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    let truncated = false;
    const done = () =>
      resolve({
        status: incoming.statusCode ?? 0,
        location: typeof incoming.headers.location === 'string' ? incoming.headers.location : null,
        contentType: incoming.headers['content-type'] ?? null,
        body: Buffer.concat(chunks),
        truncated,
      });
    incoming.on('data', (chunk: Buffer) => {
      if (truncated) return;
      const room = MAX_BODY_BYTES - size;
      chunks.push(chunk.length > room ? chunk.subarray(0, room) : chunk);
      size += Math.min(chunk.length, room);
      if (size >= MAX_BODY_BYTES) {
        truncated = true;
        incoming.destroy();
        done();
      }
    });
    incoming.on('end', done);
    incoming.on('error', (error) => (truncated ? undefined : reject(error)));
  });
}

function describeNetworkError(error: unknown, signal: AbortSignal): string {
  if (signal.aborted) return `No answer within ${FETCH_TIMEOUT_MS / 1000} seconds.`;
  const code = (error as { code?: string }).code;
  return code ? `The connection failed (${code}).` : 'The connection failed.';
}

function titleOf(html: string): string | null {
  const match = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html);
  return match ? decodeEntities(match[1]).replace(/\s+/g, ' ').trim() || null : null;
}

/** The readable text of a page: scripts, styles and tags dropped, block breaks kept. */
function htmlToText(html: string): string {
  return decodeEntities(
    html
      .replace(/<(script|style|noscript|svg|template)\b[\s\S]*?<\/\1>/gi, ' ')
      .replace(/<!--[\s\S]*?-->/g, ' ')
      .replace(/<(br|\/p|\/div|\/li|\/h[1-6]|\/tr|\/section|\/article)\b[^>]*>/gi, '\n')
      .replace(/<[^>]+>/g, ' '),
  )
    .replace(/[ \t\f\v]+/g, ' ')
    .replace(/\n\s*\n+/g, '\n\n')
    .trim();
}

function decodeEntities(text: string): string {
  return text
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, code: string) => {
      const point = Number(code);
      return point > 0 && point <= 0x10ffff ? String.fromCodePoint(point) : ' ';
    })
    .replace(/&amp;/g, '&');
}
