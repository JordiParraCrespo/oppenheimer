import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PlanEventOrmEntity } from './plan-event.orm-entity';
import type {
  PlanEventRangeInput,
  PlanEventRepositoryPort,
  PlanEventWeeklyCount,
} from './plan-event.repository.port';

/**
 * Stats' reads of `plan_event`. The range is the zone's midnights, so a week is
 * the viewer's week; `IDX_plan_event_occurred` (or `_project_occurred` for one
 * project) serves the scan.
 */
@Injectable()
export class PlanEventRepository implements PlanEventRepositoryPort {
  constructor(
    @InjectRepository(PlanEventOrmEntity)
    private readonly repository: Repository<PlanEventOrmEntity>,
  ) {}

  async weeklyTaskCounts(input: PlanEventRangeInput): Promise<PlanEventWeeklyCount[]> {
    const rows: {
      weekStart: string;
      projectId: string;
      kind: 'created' | 'completed';
      count: string;
    }[] = await this.repository.query(
      `SELECT to_char(date_trunc('week', "occurredAt" AT TIME ZONE $4), 'YYYY-MM-DD') AS "weekStart",
                "projectId", kind, count(*) AS count
           FROM plan_event
          WHERE "organizationId" = $1
            AND ($5::uuid IS NULL OR "projectId" = $5::uuid)
            AND "subjectType" = 'task'
            AND kind IN ('created', 'completed')
            AND "occurredAt" >= ($2::date::timestamp AT TIME ZONE $4)
            AND "occurredAt" < (($3::date + 1)::timestamp AT TIME ZONE $4)
          GROUP BY 1, 2, 3`,
      [input.organizationId, input.from, input.to, input.timeZone, input.projectId ?? null],
    );
    return rows.map((row) => ({ ...row, count: Number(row.count) }));
  }
}
