/**
 * The API's route policy for request metrics: every controller prefix has a
 * group, and the policy fits the budget `HttpMetricsModule` enforces. The
 * labels a real request produces through Nest's router are
 * `src/__tests__/http-metrics-routing.spec.ts`.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { HttpMetricsModule, httpMetricRoute } from '@oppenheimer/backend-core';
import { describe, expect, it } from 'vitest';
import { apiHttpMetricsOptions } from '../infrastructure/http-metrics.config';

const SRC = resolve(__dirname, '../..');

/** Every `@Controller` path in the API, from source: what a new prefix would add. */
function controllerPaths(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return entry.name === '__tests__' ? [] : controllerPaths(path);
    if (!entry.name.endsWith('.controller.ts')) return [];
    const match = /@Controller\(\s*'([^']*)'\s*\)/.exec(readFileSync(path, 'utf8'));
    return match ? [match[1]] : [];
  });
}

describe('the API route policy', () => {
  const paths = [...new Set(controllerPaths(SRC))];

  it('finds the controllers to classify', () => {
    expect(paths.length).toBeGreaterThan(20);
  });

  it.each(paths)('gives /%s a group of its own rather than other', (path) => {
    // A new controller prefix must be placed in a group before it ships, or
    // its traffic disappears into `other` on every dashboard.
    expect(httpMetricRoute(apiHttpMetricsOptions, `/api/v1/${path}/:id`)).not.toBe('other');
  });

  it('fits the cardinality budget the module enforces', () => {
    expect(() => HttpMetricsModule.register(apiHttpMetricsOptions)).not.toThrow();
  });
});
