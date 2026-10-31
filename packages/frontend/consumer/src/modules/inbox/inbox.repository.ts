import { heyApiSdk, type InboxMarkResponseDto } from '@oppenheimer/api-client';
import { callApi } from '@oppenheimer/frontend-core';
import { injectable } from 'inversify';
import { InboxErrors } from './inbox.errors';
import { type InboxMark, InboxMarkEntity } from './inbox-mark.entity';

function toEntity(dto: InboxMarkResponseDto): InboxMarkEntity {
  return new InboxMarkEntity(
    dto.itemKey,
    dto.mark,
    dto.until ? new Date(dto.until) : null,
    new Date(dto.updatedAt),
  );
}

/** The caller's Inbox marks (`GET/PUT/DELETE /v1/inbox/marks`). */
@injectable()
export class InboxRepository {
  /** The caller's marks; a snooze that has ended is left out by the API. */
  findMarks(): Promise<InboxMarkEntity[]> {
    return callApi(InboxErrors.FETCH_MARKS_FAILED, async (api) => {
      const data = await api.body(heyApiSdk.findInboxMarks());
      return data.map(toEntity);
    });
  }

  /** Marks one occurrence, replacing whatever mark it had. `until` comes with a snooze only. */
  putMark(itemKey: string, mark: InboxMark, until?: Date): Promise<InboxMarkEntity> {
    return callApi(InboxErrors.PUT_MARK_FAILED, async (api) => {
      const data = await api.body(
        heyApiSdk.putInboxMark({
          path: { itemKey },
          body: { mark, ...(until ? { until: until.toISOString() } : {}) },
        }),
      );
      return toEntity(data);
    });
  }

  /** Clears an occurrence's mark: Bring back, Restore priority. Idempotent. */
  deleteMark(itemKey: string): Promise<void> {
    return callApi(InboxErrors.DELETE_MARK_FAILED, async (api) => {
      await api.result(heyApiSdk.deleteInboxMark({ path: { itemKey } }));
    });
  }
}
