import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { Test } from '@nestjs/testing';
import {
  createMetricsProvider,
  HttpMetricsModule,
  METRICS_REGISTRY,
  MetricsModule,
  type Registry,
} from '@oppenheimer/backend-core';
import { beforeAll, describe, expect, it } from 'vitest';
import { parse } from 'yaml';
import { apiHttpMetricsOptions } from '../health/infrastructure/http-metrics.config';
import { BacklogMetrics } from '../outbox/infrastructure/backlog-metrics.adapter';

/**
 * The alert rules and the dashboard in `deploy/dev/monitoring/` name metrics
 * by string, so a renamed metric leaves an alert that can never fire and a
 * panel that draws nothing, silently. This parses both files and checks every
 * metric they name against what the API's registry actually exports (its
 * process metrics, the HTTP metrics and the backlog gauges, registered as the
 * app registers them). It does not evaluate PromQL: there is no `promtool`
 * in the toolchain.
 */

const MONITORING = resolve(__dirname, '../../../../deploy/dev/monitoring');

interface Rule {
  alert?: string;
  expr?: string;
  for?: string;
  labels?: { severity?: string };
  annotations?: { summary?: string };
}

const rules: Rule[] = (
  parse(readFileSync(join(MONITORING, 'prometheus/api.rules.yaml'), 'utf8')) as {
    groups: { name: string; rules: Rule[] }[];
  }
).groups.flatMap((group) => group.rules);

interface Panel {
  id: number;
  type: string;
  targets?: { expr: string }[];
}
const dashboard = JSON.parse(readFileSync(join(MONITORING, 'grafana/api.json'), 'utf8')) as {
  uid: string;
  panels: Panel[];
};

/** PromQL words that look like metric names but are functions, keywords or labels. */
const PROMQL = new Set([
  'sum',
  'rate',
  'increase',
  'delta',
  'changes',
  'absent',
  'time',
  'histogram_quantile',
  'by',
  'and',
  'or',
  'unless',
  'on',
  'clamp_min',
  'max',
  'min',
  'avg',
  'count',
]);

/** The metric names an expression selects: identifiers followed by `{`, `[` or nothing label-like. */
function metricsIn(expr: string): string[] {
  const withoutStrings = expr.replace(/"[^"]*"/g, '""');
  const withoutLabels = withoutStrings.replace(/\{[^}]*\}/g, '{}').replace(/by \([^)]*\)/g, '');
  return [...withoutLabels.matchAll(/\b([a-z_][a-z0-9_]*)\b(?!\s*\()/g)]
    .map((match) => match[1])
    .filter((word) => !PROMQL.has(word) && word.includes('_') && !word.startsWith('__'));
}

let exported: Set<string>;

beforeAll(async () => {
  const moduleRef = await Test.createTestingModule({
    imports: [MetricsModule.forRoot(), HttpMetricsModule.register(apiHttpMetricsOptions)],
    providers: [...createMetricsProvider(BacklogMetrics)],
  }).compile();
  await moduleRef.init();
  const registry = moduleRef.get<Registry>(METRICS_REGISTRY);
  const text = await registry.metrics();
  // Every series name as exported, histogram `_bucket`/`_sum`/`_count` included.
  exported = new Set([...text.matchAll(/^([a-z_][a-z0-9_]*)[{ ]/gm)].map((match) => match[1]));
  // The gauges a sampler has not set yet export no series, only their TYPE line.
  for (const match of text.matchAll(/^# TYPE ([a-z_][a-z0-9_]*) /gm)) exported.add(match[1]);
  await moduleRef.close();
});

describe('monitoring config', () => {
  it('finds rules, panels and exported metrics to compare', () => {
    expect(rules.length).toBeGreaterThan(10);
    expect(dashboard.panels.length).toBeGreaterThan(10);
    expect(exported.has('http_requests_total')).toBe(true);
    expect(exported.has('http_request_duration_seconds_bucket')).toBe(true);
    expect(exported.has('outbox_oldest_pending_age_seconds')).toBe(true);
  });

  it('gives every rule a name, an expression, a severity and a summary', () => {
    const incomplete = rules
      .filter(
        (rule) =>
          !rule.alert ||
          !rule.expr ||
          !['critical', 'warning'].includes(rule.labels?.severity ?? '') ||
          !rule.annotations?.summary,
      )
      .map((rule) => rule.alert ?? JSON.stringify(rule));
    expect(incomplete).toEqual([]);
  });

  it('scopes every rule to the API’s series', () => {
    expect(rules.filter((rule) => !rule.expr?.includes('app="api"')).map((r) => r.alert)).toEqual(
      [],
    );
  });

  it('names only metrics the API exports, in rules and panels alike', () => {
    const expressions = [
      ...rules.map((rule) => [`rule ${rule.alert}`, rule.expr ?? ''] as const),
      ...dashboard.panels.flatMap((panel) =>
        (panel.targets ?? []).map((target) => [`panel ${panel.id}`, target.expr] as const),
      ),
    ];
    const unknown = expressions.flatMap(([where, expr]) =>
      metricsIn(expr)
        .filter((name) => !exported.has(name))
        .map((name) => `${where}: ${name}`),
    );
    expect(unknown).toEqual([]);
  });

  it('gives every panel its own id', () => {
    const ids = dashboard.panels.map((panel) => panel.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
