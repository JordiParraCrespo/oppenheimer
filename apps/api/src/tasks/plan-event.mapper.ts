import { Injectable } from '@nestjs/common';
import { PlanEventOrmEntity } from './database/plan-event.orm-entity';
import type { PlanChange } from './domain/plan-change.types';

/** A change an aggregate recorded, as the `plan_event` row that logs it. */
@Injectable()
export class PlanEventMapper {
  toRecord(
    subject: { organizationId: string; type: 'task' | 'milestone'; id: string },
    change: PlanChange,
  ): PlanEventOrmEntity {
    const record = new PlanEventOrmEntity();
    record.organizationId = subject.organizationId;
    record.subjectType = subject.type;
    record.subjectId = subject.id;
    record.projectId = change.projectId;
    record.milestoneId = change.milestoneId;
    record.kind = change.kind;
    record.actorType = change.actor.type;
    record.actorUserId = change.actor.userId;
    record.actorAgentId = change.actor.type === 'agent' ? change.actor.agentId : null;
    record.payload = change.payload;
    record.occurredAt = change.occurredAt;
    return record;
  }
}
