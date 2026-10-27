import { createHash } from 'node:crypto';
import { Injectable, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CacheService } from '@oppenheimer/backend-cache';
import { AppError, type RefusalReader, UpstreamLimiter } from '@oppenheimer/backend-core';
import type { CloudAgentRunState } from '../domain/cloud-agent.entity';
import { CloudAgentErrors } from '../domain/cloud-agents.errors';
import type {
  CursorAccess,
  CursorAgentRun,
  CursorCloudAgentsPort,
  CursorKeyOwner,
  CursorLaunch,
  CursorModel,
} from './cursor-cloud-agents.port';
import { cursorRunState, errorOf, recordOf, stringOf } from './cursor-cloud-agents.util';

const TIMEOUT_MS = 30_000;
/**
 * One open agent's poll and a list's three syncs a person, and a launch now
 * and then: eight in flight per process is plenty, and a burst past forty
 * waiting answers `CLOUD_AGENTS_007` rather than hanging the console.
 */
const LIMITS = { maxInFlight: 8, maxQueued: 40, maxWaitMs: 5_000 };
const MODELS_TTL_SECONDS = 60 * 60;
/** Cursor allows one repository listing a minute and thirty an hour per person. */
const REPOSITORIES_TTL_SECONDS = 10 * 60;

/**
 * Cursor's Cloud Agents API, v1 (`https://cursor.com/docs/cloud-agent/api/endpoints`),
 * on a person's own key as Basic auth (the key as user, no password).
 *
 * The budget (`.agents/rules/integrations.md`):
 *
 * - **What is counted.** Calls per person: a user key's calls count against
 *   its Cursor user, so the bucket is `user:<id>` (from `GET /v1/me`, kept on
 *   the credential), and a key that names no person is bucketed by a digest
 *   of the key. Every call carries its one bucket.
 * - **The windows.** Cursor's overview gives a default of 20 calls a minute
 *   per key; `GET /v1/repositories` is 1 a minute and 30 an hour per user.
 *   Neither sends a remaining-calls header today.
 * - **How it says stop.** `429` with `{ "error": { "code":
 *   "rate_limit_exceeded" } }`, a `Retry-After` when it sends one; the
 *   limiter pauses the bucket and answers `CLOUD_AGENTS_007`.
 * - **What a screen costs.** An open agent is read once in ten seconds, a
 *   list syncs three working agents at most once in thirty
 *   (`cloud-agent-sync.policy.ts`): about eighteen calls a minute at worst.
 *   Models are cached an hour and repositories ten minutes per bucket, so the
 *   launch dialog costs nothing after its first opening.
 */
@Injectable()
export class CursorCloudAgentsGateway implements CursorCloudAgentsPort {
  private readonly limiter: UpstreamLimiter;

  constructor(
    private readonly configService: ConfigService,
    @Optional() private readonly cache?: CacheService,
  ) {
    this.limiter = new UpstreamLimiter('Cursor', CloudAgentErrors.RATE_LIMITED, cache, LIMITS);
  }

  async me(apiKey: string): Promise<CursorKeyOwner> {
    const body = await this.call({ apiKey, bucket: keyBucket(apiKey) }, 'GET', '/v1/me');
    const userId = body.userId;
    return {
      keyName: stringOf(body.apiKeyName) ?? 'Cursor API key',
      userId: typeof userId === 'number' || typeof userId === 'string' ? String(userId) : null,
      email: stringOf(body.userEmail),
    };
  }

  async launch(access: CursorAccess, launch: CursorLaunch): Promise<CursorAgentRun> {
    const body = await this.call(access, 'POST', '/v1/agents', {
      agentId: `bc-${launch.agentId}`,
      prompt: { text: launch.prompt },
      ...(launch.model ? { model: { id: launch.model } } : {}),
      repos: [
        {
          url: launch.repositoryUrl,
          ...(launch.startingRef ? { startingRef: launch.startingRef } : {}),
        },
      ],
      autoCreatePR: launch.autoCreatePr,
    });
    const agent = recordOf(body.agent);
    const run = recordOf(body.run);
    const agentId = stringOf(agent.id);
    const runId = stringOf(run.id) ?? stringOf(agent.latestRunId);
    if (!agentId || !runId) {
      throw new AppError(CloudAgentErrors.PROVIDER_UNAVAILABLE, {
        detail: 'Cursor answered a launch with no agent or run id',
      });
    }
    return {
      agentId,
      name: stringOf(agent.name) ?? launch.prompt.slice(0, 80),
      url: stringOf(agent.url),
      ...cursorRunState(run, runId),
    };
  }

  async followUp(access: CursorAccess, agentId: string, prompt: string): Promise<string> {
    const body = await this.call(access, 'POST', `/v1/agents/${encodeURIComponent(agentId)}/runs`, {
      prompt: { text: prompt },
    });
    const runId = stringOf(recordOf(body.run).id) ?? stringOf(body.id);
    if (!runId) {
      throw new AppError(CloudAgentErrors.PROVIDER_UNAVAILABLE, {
        detail: 'Cursor answered a follow-up with no run id',
      });
    }
    return runId;
  }

  async cancel(access: CursorAccess, agentId: string, runId: string): Promise<void> {
    await this.call(
      access,
      'POST',
      `/v1/agents/${encodeURIComponent(agentId)}/runs/${encodeURIComponent(runId)}/cancel`,
    );
  }

  async read(access: CursorAccess, agentId: string, runId: string): Promise<CloudAgentRunState> {
    const body = await this.call(
      access,
      'GET',
      `/v1/agents/${encodeURIComponent(agentId)}/runs/${encodeURIComponent(runId)}`,
    );
    return cursorRunState(body, runId);
  }

  models(access: CursorAccess): Promise<CursorModel[]> {
    return this.cached(
      `cloud-agents:cursor:models:${access.bucket}`,
      MODELS_TTL_SECONDS,
      async () => {
        const body = await this.call(access, 'GET', '/v1/models');
        const items = Array.isArray(body.items) ? body.items : [];
        return items.flatMap((item): CursorModel[] => {
          const row = recordOf(item);
          const id = stringOf(row.id);
          // `default` is Cursor's own pick ("Auto"): a launch names no model for it.
          if (!id || id === 'default') return [];
          return [{ id, label: stringOf(row.displayName) ?? id }];
        });
      },
    );
  }

  repositories(access: CursorAccess): Promise<string[]> {
    return this.cached(
      `cloud-agents:cursor:repositories:${access.bucket}`,
      REPOSITORIES_TTL_SECONDS,
      async () => {
        const body = await this.call(access, 'GET', '/v1/repositories');
        const items = Array.isArray(body.items) ? body.items : [];
        return items.flatMap((item) => {
          const url = stringOf(recordOf(item).url);
          return url ? [url] : [];
        });
      },
    );
  }

  private cached<T>(key: string, ttlSeconds: number, load: () => Promise<T>): Promise<T> {
    return this.cache ? this.cache.getOrSet(key, ttlSeconds, load) : load();
  }

  /**
   * Every call to Cursor, through the limiter: its rate-limit problem
   * passes through as is, and every other refusal is mapped onto the
   * module's catalog with Cursor's own words as the detail.
   */
  private async call(
    access: CursorAccess,
    method: 'GET' | 'POST',
    path: string,
    body?: unknown,
  ): Promise<Record<string, unknown>> {
    let exchanged: { response: Response; errorBody: string | null };
    try {
      exchanged = await this.limiter.exchange(
        access.bucket,
        () =>
          fetch(`${this.baseUrl}${path}`, {
            method,
            headers: {
              authorization: `Basic ${Buffer.from(`${access.apiKey}:`).toString('base64')}`,
              accept: 'application/json',
              'user-agent': 'Oppenheimer',
              ...(body === undefined ? {} : { 'content-type': 'application/json' }),
            },
            body: body === undefined ? undefined : JSON.stringify(body),
            signal: AbortSignal.timeout(TIMEOUT_MS),
          }),
        readRateRefusal,
      );
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError(CloudAgentErrors.PROVIDER_UNAVAILABLE, {
        detail:
          error instanceof Error ? `Cursor unreachable: ${error.message}` : 'Cursor unreachable',
      });
    }
    const { response, errorBody } = exchanged;
    if (errorBody !== null) throw refusalOf(response.status, errorBody);
    const text = await response.text();
    if (!text) return {};
    try {
      return recordOf(JSON.parse(text));
    } catch {
      throw new AppError(CloudAgentErrors.PROVIDER_UNAVAILABLE, {
        detail: `Cursor answered ${response.status} with a body that is not JSON`,
      });
    }
  }

  private get baseUrl(): string {
    return this.configService.getOrThrow<string>('cloudAgents.cursorApiUrl').replace(/\/+$/, '');
  }
}

/** The bucket of a key whose owner is not known yet: a digest, never the key. */
export function keyBucket(apiKey: string): string {
  return `key:${createHash('sha256').update(apiKey).digest('hex').slice(0, 16)}`;
}

const readRateRefusal: RefusalReader = (errorBody) => ({
  limited: errorOf(errorBody).code === 'rate_limit_exceeded',
});

/** Cursor's refusal, in the words the console acts on. */
function refusalOf(status: number, errorBody: string): AppError {
  const { code, message } = errorOf(errorBody);
  const detail = message ? `Cursor: ${message}` : `Cursor answered ${status}`;
  const extensions = code ? { upstreamCode: code } : undefined;
  if (code === 'agent_busy') return new AppError(CloudAgentErrors.BUSY, { detail, extensions });
  if (code === 'run_not_cancellable') {
    return new AppError(CloudAgentErrors.NOT_CANCELLABLE, { detail, extensions });
  }
  if (status === 401 || code === 'key_not_supported') {
    return new AppError(CloudAgentErrors.KEY_REFUSED, { detail, extensions });
  }
  // 402 and `usage_limit_exceeded`: the person's Cursor plan is out of usage.
  if ([400, 402, 403, 409, 422].includes(status)) {
    return new AppError(CloudAgentErrors.REQUEST_REFUSED, { detail, extensions });
  }
  return new AppError(CloudAgentErrors.PROVIDER_UNAVAILABLE, { detail, extensions });
}
