import { Injectable } from '@nestjs/common';
import type { Mapper } from '@oppenheimer/backend-ddd';
import { SessionTerminalWatchOrmEntity } from './database/session-terminal-watch.orm-entity';
import { SessionTerminalWatchEntity } from './domain/session-terminal-watch.entity';

/** What a watch is, as a command answers it: never sent to a client as such. */
export interface SessionTerminalWatchView {
  watchId: string;
  pattern: string;
}

/** A terminal watch between its domain and persistence shapes. */
@Injectable()
export class SessionTerminalWatchMapper
  implements
    Mapper<SessionTerminalWatchEntity, SessionTerminalWatchOrmEntity, SessionTerminalWatchView>
{
  toPersistence(entity: SessionTerminalWatchEntity): SessionTerminalWatchOrmEntity {
    const record = new SessionTerminalWatchOrmEntity();
    record.id = entity.id;
    record.organizationId = entity.organizationId;
    record.sessionId = entity.sessionId;
    record.pattern = entity.pattern;
    record.matches = entity.matches;
    return record;
  }

  toDomain(record: SessionTerminalWatchOrmEntity): SessionTerminalWatchEntity {
    return SessionTerminalWatchEntity.create({
      id: record.id,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      props: {
        organizationId: record.organizationId,
        sessionId: record.sessionId,
        pattern: record.pattern,
        matches: record.matches,
      },
    });
  }

  toResponse(entity: SessionTerminalWatchEntity): SessionTerminalWatchView {
    return { watchId: entity.id, pattern: entity.pattern };
  }
}
