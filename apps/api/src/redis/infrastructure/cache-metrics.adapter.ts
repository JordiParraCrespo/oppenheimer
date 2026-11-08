import { Injectable } from '@nestjs/common';
import type { CacheReadObserver } from '@oppenheimer/backend-cache';
import { InjectMetric, type ModuleMetrics } from '@oppenheimer/backend-core';

export const CACHE_READS_TOTAL = 'cache_reads_total';

export const CacheMetrics: ModuleMetrics = {
  [CACHE_READS_TOTAL]: {
    type: 'counter',
    help: 'Cache reads by key namespace, operation and result (hit, miss, error, coalesced); mget counts each key',
    labelNames: ['namespace', 'operation', 'result'],
  },
};

/**
 * At most this many namespaces get a label of their own; the rest are
 * `other`. A namespace is a key's first segment, which callers write as a
 * literal (`github:`, `attach:`), so the set is small; the cap is what keeps
 * a key written without one (its whole value is then the "namespace") from
 * growing the series without bound.
 */
const MAX_NAMESPACES = 20;
const NAMESPACE = /^[a-z][a-z0-9_-]{0,31}$/;

interface CounterLike {
  inc(labels: Record<string, string>, value?: number): void;
}

/**
 * Counts every read of the cache (`cache_reads_total`), so a hit rate is a
 * rate over `result="hit"` against all of them, per namespace. Handed to the
 * cache as its `onRead` (`app.module.ts`).
 */
@Injectable()
export class CacheReadMetricsAdapter {
  private readonly namespaces = new Set<string>();

  constructor(@InjectMetric(CACHE_READS_TOTAL) private readonly reads: CounterLike) {}

  readonly observe: CacheReadObserver = ({ operation, namespace, result }) => {
    this.reads.inc({ namespace: this.label(namespace), operation, result });
  };

  private label(namespace: string): string {
    if (this.namespaces.has(namespace)) return namespace;
    if (!NAMESPACE.test(namespace) || this.namespaces.size >= MAX_NAMESPACES) return 'other';
    this.namespaces.add(namespace);
    return namespace;
  }
}
