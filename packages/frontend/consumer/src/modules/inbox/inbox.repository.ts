import { heyApiSdk, type InboxMarkResponseDto } from '@oppenheimer/api-client';
import { MapApiError, unwrap, unwrapBody } from '@oppenheimer/frontend-core';
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
  @MapApiError(InboxErrors.FETCH_MARKS_FAILED)
  async findMarks(): Promise<InboxMarkEntity[]> {
    const data = await unwrapBody(heyApiSdk.findInboxMarks(), InboxErrors.FETCH_MARKS_FAILED);
    return data.map(toEntity);
  }

  /** Marks one occurrence, replacing whatever mark it had. `until` comes with a snooze only. */
  @MapApiError(InboxErrors.PUT_MARK_FAILED)
  async putMark(itemKey: string, mark: InboxMark, until?: Date): Promise<InboxMarkEntity> {
    const data = await unwrapBody(
      heyApiSdk.putInboxMark({
        path: { itemKey },
        body: { mark, ...(until ? { until: until.toISOString() } : {}) },
      }),
      InboxErrors.PUT_MARK_FAILED,
    );
    return toEntity(data);
  }

  /** Clears an occurrence's mark: Bring back, Restore priority. Idempotent. */
  @MapApiError(InboxErrors.DELETE_MARK_FAILED)
  async deleteMark(itemKey: string): Promise<void> {
    await unwrap(heyApiSdk.deleteInboxMark({ path: { itemKey } }), InboxErrors.DELETE_MARK_FAILED);
  }
}
