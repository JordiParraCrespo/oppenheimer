import {
  heyApiSdk,
  type InboxMarkResponseDto,
  type InboxReportResponseDto,
} from '@oppenheimer/api-client';
import { callApi } from '@oppenheimer/frontend-core';
import { injectable } from 'inversify';
import { InboxErrors } from './inbox.errors';
import { type InboxMark, InboxMarkEntity } from './inbox-mark.entity';
import { InboxReportEntity } from './inbox-report.entity';

function toEntity(dto: InboxMarkResponseDto): InboxMarkEntity {
  return new InboxMarkEntity(
    dto.itemKey,
    dto.mark,
    dto.until ? new Date(dto.until) : null,
    new Date(dto.updatedAt),
  );
}

function toReport(dto: InboxReportResponseDto): InboxReportEntity {
  return new InboxReportEntity(
    dto.id,
    dto.title,
    dto.body,
    dto.source,
    dto.link,
    dto.images,
    dto.status,
    new Date(dto.createdAt),
  );
}

/**
 * The caller's Inbox marks (`GET/PUT/DELETE /v1/inbox/marks`) and the
 * workspace's reports (`/v1/inbox/reports`).
 */
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

  /** The reports still waiting on the person, newest first. */
  findReports(): Promise<InboxReportEntity[]> {
    return callApi(InboxErrors.FETCH_REPORTS_FAILED, async (api) => {
      const data = await api.body(heyApiSdk.findInboxReports());
      return data.map(toReport);
    });
  }

  /** A report's picture, for its card to draw: the API serves the bytes only to whoever may read it. */
  readReportImage(reportId: string, imageId: string): Promise<Blob> {
    return callApi(InboxErrors.READ_REPORT_IMAGE_FAILED, async (api) => {
      const body = await api.body(
        heyApiSdk.readInboxReportImage({ path: { id: reportId, imageId }, parseAs: 'blob' }),
      );
      return body as unknown as Blob;
    });
  }

  /** Answers a report, once: the API refuses a second answer (`INBOX_006`). */
  answerReport(id: string, text: string): Promise<InboxReportEntity> {
    return callApi(InboxErrors.ANSWER_REPORT_FAILED, async (api) => {
      const data = await api.body(heyApiSdk.answerInboxReport({ path: { id }, body: { text } }));
      return toReport(data);
    });
  }
}
