import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AnswerInboxReportCommandHandler } from './commands/answer-inbox-report/answer-inbox-report.command-handler';
import { AnswerInboxReportHttpController } from './commands/answer-inbox-report/answer-inbox-report.http.controller';
import { DeleteInboxMarkCommandHandler } from './commands/delete-inbox-mark/delete-inbox-mark.command-handler';
import { DeleteInboxMarkHttpController } from './commands/delete-inbox-mark/delete-inbox-mark.http.controller';
import { PostInboxReportCommandHandler } from './commands/post-inbox-report/post-inbox-report.command-handler';
import { PostInboxReportHttpController } from './commands/post-inbox-report/post-inbox-report.http.controller';
import { PutInboxMarkCommandHandler } from './commands/put-inbox-mark/put-inbox-mark.command-handler';
import { PutInboxMarkHttpController } from './commands/put-inbox-mark/put-inbox-mark.http.controller';
import { InboxMarkOrmEntity } from './database/inbox-mark.orm-entity';
import { InboxMarkRepository } from './database/inbox-mark.repository';
import { InboxReportOrmEntity } from './database/inbox-report.orm-entity';
import { InboxReportRepository } from './database/inbox-report.repository';
import {
  INBOX_MARK_REPOSITORY,
  INBOX_REPORT_FILES,
  INBOX_REPORT_REPOSITORY,
} from './inbox.di-tokens';
import { InboxMarkMapper } from './inbox-mark.mapper';
import { InboxReportMapper } from './inbox-report.mapper';
import { StorageInboxReportFilesAdapter } from './infrastructure/storage-inbox-report-files.adapter';
import { FindInboxMarkQueryHandler } from './queries/find-inbox-mark/find-inbox-mark.query-handler';
import { FindInboxMarksHttpController } from './queries/find-inbox-marks/find-inbox-marks.http.controller';
import { FindInboxMarksQueryHandler } from './queries/find-inbox-marks/find-inbox-marks.query-handler';
import { FindInboxReportHttpController } from './queries/find-inbox-report/find-inbox-report.http.controller';
import { FindInboxReportQueryHandler } from './queries/find-inbox-report/find-inbox-report.query-handler';
import { FindInboxReportsHttpController } from './queries/find-inbox-reports/find-inbox-reports.http.controller';
import { FindInboxReportsQueryHandler } from './queries/find-inbox-reports/find-inbox-reports.query-handler';
import { ReadInboxReportImageHttpController } from './queries/read-inbox-report-image/read-inbox-report-image.http.controller';
import { ReadInboxReportImageQueryHandler } from './queries/read-inbox-report-image/read-inbox-report-image.query-handler';

/**
 * The Inbox's marks (`product/versions/mvp/29-inbox.md` §3, §4): what a person
 * did to an occurrence of an item. The items are not here; the console reads
 * them from their sources and leaves out what the marks hide. The one item
 * that is here is a report ("Reports"): what an agent sent, with its
 * pictures, and the person's answer.
 */
@Module({
  imports: [CqrsModule, TypeOrmModule.forFeature([InboxMarkOrmEntity, InboxReportOrmEntity])],
  controllers: [
    FindInboxMarksHttpController,
    PutInboxMarkHttpController,
    DeleteInboxMarkHttpController,
    FindInboxReportsHttpController,
    FindInboxReportHttpController,
    ReadInboxReportImageHttpController,
    PostInboxReportHttpController,
    AnswerInboxReportHttpController,
  ],
  providers: [
    PutInboxMarkCommandHandler,
    DeleteInboxMarkCommandHandler,
    FindInboxMarksQueryHandler,
    FindInboxMarkQueryHandler,
    InboxMarkMapper,
    { provide: INBOX_MARK_REPOSITORY, useClass: InboxMarkRepository },
    PostInboxReportCommandHandler,
    AnswerInboxReportCommandHandler,
    FindInboxReportsQueryHandler,
    FindInboxReportQueryHandler,
    ReadInboxReportImageQueryHandler,
    InboxReportMapper,
    { provide: INBOX_REPORT_REPOSITORY, useClass: InboxReportRepository },
    { provide: INBOX_REPORT_FILES, useClass: StorageInboxReportFilesAdapter },
  ],
})
export class InboxModule {}
