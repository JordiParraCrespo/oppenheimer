/**
 * The scrape's gate: it exists only for the holder of `METRICS_TOKEN`, every
 * refusal looks like an unknown path, and a refusal is logged without the
 * secret that was presented.
 */
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MetricsProbeController, presentsToken } from '../probes/metrics.probe.controller';

const TOKEN = 'a'.repeat(40);
const basic = (user: string, password: string) =>
  `Basic ${Buffer.from(`${user}:${password}`).toString('base64')}`;

function controller(token: string | undefined) {
  const registry = {
    contentType: 'text/plain; version=0.0.4; charset=utf-8',
    metrics: async () => 'http_requests_total{route="hosts",status_class="2xx"} 1\n',
  };
  const config = new ConfigService({ health: { metricsToken: token } });
  return new MetricsProbeController(registry as never, config);
}

const response = () => ({ setHeader: vi.fn() });

describe('the metrics scrape', () => {
  const warn = vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => {});
  beforeEach(() => warn.mockClear());

  it('does not exist on a deployment without METRICS_TOKEN', async () => {
    await expect(
      controller(undefined).scrape(basic('prometheus', TOKEN), response() as never),
    ).rejects.toMatchObject({ httpStatus: 404 });
  });

  it.each([
    ['no credential', undefined],
    ['the wrong password', basic('prometheus', 'b'.repeat(40))],
    ['the token as a bearer', `Bearer ${TOKEN}`],
    ['a header with no password', `Basic ${Buffer.from('prometheus').toString('base64')}`],
  ])('answers the same 404 to %s', async (_label, authorization) => {
    await expect(
      controller(TOKEN).scrape(authorization, response() as never),
    ).rejects.toMatchObject({ httpStatus: 404 });
    // the operator learns a scrape was refused; the presented value is not logged
    expect(warn).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(warn.mock.calls)).not.toContain('b'.repeat(40));
  });

  it('renders the registry for the token, with its content type', async () => {
    const res = response();
    const body = await controller(TOKEN).scrape(basic('anyone', TOKEN), res as never);

    expect(res.setHeader).toHaveBeenCalledWith(
      'Content-Type',
      expect.stringContaining('text/plain'),
    );
    expect(body).toContain('http_requests_total');
  });

  it('accepts a password that itself contains a colon', () => {
    expect(presentsToken(basic('p', `${TOKEN}:x`), `${TOKEN}:x`)).toBe(true);
  });
});
