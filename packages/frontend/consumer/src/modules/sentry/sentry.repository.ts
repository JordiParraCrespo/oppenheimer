import { heyApiSdk } from '@oppenheimer/api-client';
import { callApi } from '@oppenheimer/frontend-core';
import type { PutSentryConnectionDto } from '@oppenheimer/shared/schemas/sentry';
import { injectable } from 'inversify';
import type { SentryStatus } from './sentry.entity';
import { SentryClientErrors } from './sentry.errors';

type StatusDto = NonNullable<Awaited<ReturnType<typeof heyApiSdk.findSentryConnection>>['data']>;

function toStatus(dto: StatusDto): SentryStatus {
  const connection = dto.connection;
  return {
    configured: dto.configured,
    connection: connection
      ? {
          id: connection.id,
          organizationSlug: connection.organizationSlug,
          secretHint: connection.secretHint,
          webhookUrl: connection.webhookUrl,
          connectedAt: new Date(connection.createdAt),
        }
      : null,
  };
}

/**
 * The workspace's Sentry organization, whose issues and alerts start
 * automations (`product/next-steps/sentry.md`). The client secret goes to
 * the API once and never comes back.
 */
@injectable()
export class SentryRepository {
  status(): Promise<SentryStatus> {
    return callApi(SentryClientErrors.STATUS_FAILED, async (api) => {
      return toStatus(await api.body(heyApiSdk.findSentryConnection()));
    });
  }

  /** Answers the status with the connection, its webhook URL included. */
  connect(body: PutSentryConnectionDto): Promise<SentryStatus> {
    return callApi(SentryClientErrors.CONNECT_FAILED, async (api) => {
      return toStatus(await api.body(heyApiSdk.putSentryConnection({ body })));
    });
  }

  disconnect(): Promise<void> {
    return callApi(SentryClientErrors.DISCONNECT_FAILED, async (api) => {
      await api.result(heyApiSdk.removeSentryConnection());
    });
  }
}
