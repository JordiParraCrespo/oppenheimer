import type { InboxReportStatus } from '@oppenheimer/shared';
import type { Option } from 'oxide.ts';
import type { InboxReportEntity } from '../domain/inbox-report.entity';

export interface InboxReportRepositoryPort {
  /** Stores a new report, with its event in the same transaction. */
  insert(report: InboxReportEntity): Promise<void>;

  /** One report of the workspace; another workspace's is not found. */
  findOne(organizationId: string, id: string): Promise<Option<InboxReportEntity>>;

  /** The workspace's reports in `status`, the newest first, at most `limit`. */
  findByStatus(
    organizationId: string,
    status: InboxReportStatus,
    limit: number,
  ): Promise<InboxReportEntity[]>;

  /**
   * Writes the report's answer, with its event, if it is still open in the
   * store. Whether it was: of two answers at once, one gets `false`, and
   * neither its answer nor its event is kept.
   */
  saveAnswer(report: InboxReportEntity): Promise<boolean>;
}
