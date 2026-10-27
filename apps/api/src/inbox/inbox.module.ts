import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DeleteInboxMarkCommandHandler } from './commands/delete-inbox-mark/delete-inbox-mark.command-handler';
import { DeleteInboxMarkHttpController } from './commands/delete-inbox-mark/delete-inbox-mark.http.controller';
import { PutInboxMarkCommandHandler } from './commands/put-inbox-mark/put-inbox-mark.command-handler';
import { PutInboxMarkHttpController } from './commands/put-inbox-mark/put-inbox-mark.http.controller';
import { InboxMarkOrmEntity } from './database/inbox-mark.orm-entity';
import { InboxMarkRepository } from './database/inbox-mark.repository';
import { INBOX_MARK_REPOSITORY } from './inbox.di-tokens';
import { InboxMarkMapper } from './inbox-mark.mapper';
import { FindInboxMarkQueryHandler } from './queries/find-inbox-mark/find-inbox-mark.query-handler';
import { FindInboxMarksHttpController } from './queries/find-inbox-marks/find-inbox-marks.http.controller';
import { FindInboxMarksQueryHandler } from './queries/find-inbox-marks/find-inbox-marks.query-handler';

/**
 * The Inbox's marks (`product/versions/mvp/29-inbox.md` §3, §4): what a person
 * did to an occurrence of an item. The items are not here; the console reads
 * them from their sources and leaves out what the marks hide.
 */
@Module({
  imports: [CqrsModule, TypeOrmModule.forFeature([InboxMarkOrmEntity])],
  controllers: [
    FindInboxMarksHttpController,
    PutInboxMarkHttpController,
    DeleteInboxMarkHttpController,
  ],
  providers: [
    PutInboxMarkCommandHandler,
    DeleteInboxMarkCommandHandler,
    FindInboxMarksQueryHandler,
    FindInboxMarkQueryHandler,
    InboxMarkMapper,
    { provide: INBOX_MARK_REPOSITORY, useClass: InboxMarkRepository },
  ],
})
export class InboxModule {}
