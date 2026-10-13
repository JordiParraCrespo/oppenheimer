import { Injectable } from '@nestjs/common';
import type { PlanEventWeeklyCount } from './database/plan-event.repository.port';
import {
  PlanStatsModelTokensDto,
  PlanStatsPeriodDto,
  PlanStatsProjectDto,
  PlanStatsResponseDto,
  PlanStatsTotalsDto,
} from './dtos/plan-stats.response.dto';

/** A week of one model's usage on one project, as the sessions module reports it. */
export interface PlanUsageWeek {
  weekStart: string;
  projectId: string;
  model: string | null;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
}

export interface PlanStatsSources {
  from: string;
  to: string;
  timeZone: string;
  weeks: readonly string[];
  counts: readonly PlanEventWeeklyCount[];
  /** Null when usage is not read at all. */
  usage: readonly PlanUsageWeek[] | null;
  previous: {
    from: string;
    to: string;
    counts: readonly PlanEventWeeklyCount[];
    usage: readonly PlanUsageWeek[] | null;
  } | null;
}

const tokensOf = (week: PlanUsageWeek) => week.inputTokens + week.outputTokens;
const round2 = (value: number) => Math.round(value * 100) / 100;

/** Stats' weekly rows, as the response the Stats screen draws. */
@Injectable()
export class PlanStatsMapper {
  toResponse(sources: PlanStatsSources): PlanStatsResponseDto {
    const dto = new PlanStatsResponseDto();
    dto.from = sources.from;
    dto.to = sources.to;
    dto.timeZone = sources.timeZone;
    dto.weeks = [...sources.weeks];
    dto.current = this.toPeriod(sources.weeks, sources.counts, sources.usage);
    dto.previous = sources.previous
      ? this.toTotals(sources.previous.counts, sources.previous.usage)
      : null;
    dto.previousFrom = sources.previous?.from ?? null;
    dto.previousTo = sources.previous?.to ?? null;
    dto.projects = this.toProjects(sources.counts, sources.usage);
    dto.tokensMeasured = sources.usage && sources.usage.length > 0 ? 'headless' : 'none';
    return dto;
  }

  private toTotals(
    counts: readonly PlanEventWeeklyCount[],
    usage: readonly PlanUsageWeek[] | null,
  ): PlanStatsTotalsDto {
    const totals = new PlanStatsTotalsDto();
    this.fillTotals(totals, counts, usage);
    return totals;
  }

  private fillTotals(
    totals: PlanStatsTotalsDto,
    counts: readonly PlanEventWeeklyCount[],
    usage: readonly PlanUsageWeek[] | null,
  ): void {
    const sum = (kind: PlanEventWeeklyCount['kind']) =>
      counts.filter((row) => row.kind === kind).reduce((total, row) => total + row.count, 0);
    totals.tasksCompleted = sum('completed');
    totals.tasksCreated = sum('created');
    const measured = usage && usage.length > 0 ? usage : null;
    totals.tokens = measured ? measured.reduce((total, week) => total + tokensOf(week), 0) : null;
    totals.costUsd = measured
      ? round2(measured.reduce((total, week) => total + week.costUsd, 0))
      : null;
    totals.pullRequestsMerged = null;
  }

  private toPeriod(
    weeks: readonly string[],
    counts: readonly PlanEventWeeklyCount[],
    usage: readonly PlanUsageWeek[] | null,
  ): PlanStatsPeriodDto {
    const period = new PlanStatsPeriodDto();
    this.fillTotals(period, counts, usage);
    const series = (kind: PlanEventWeeklyCount['kind']) =>
      weeks.map((week) =>
        counts
          .filter((row) => row.kind === kind && row.weekStart === week)
          .reduce((total, row) => total + row.count, 0),
      );
    period.completedByWeek = series('completed');
    period.createdByWeek = series('created');

    const measured = usage && usage.length > 0 ? usage : null;
    if (!measured) {
      period.tokensByModel = null;
      period.costByWeek = null;
      return period;
    }
    const models = [...new Set(measured.map((week) => week.model))];
    period.tokensByModel = models
      .map((model) => {
        const own = measured.filter((week) => week.model === model);
        const row = new PlanStatsModelTokensDto();
        row.model = model;
        row.byWeek = weeks.map((week) =>
          own.filter((u) => u.weekStart === week).reduce((total, u) => total + tokensOf(u), 0),
        );
        row.total = row.byWeek.reduce((total, value) => total + value, 0);
        return row;
      })
      .sort((a, b) => b.total - a.total);
    period.costByWeek = weeks.map((week) =>
      round2(
        measured.filter((u) => u.weekStart === week).reduce((total, u) => total + u.costUsd, 0),
      ),
    );
    return period;
  }

  private toProjects(
    counts: readonly PlanEventWeeklyCount[],
    usage: readonly PlanUsageWeek[] | null,
  ): PlanStatsProjectDto[] {
    const ids = [
      ...new Set([...counts.map((row) => row.projectId), ...(usage ?? []).map((u) => u.projectId)]),
    ];
    const measured = usage && usage.length > 0;
    return ids.map((projectId) => {
      const row = new PlanStatsProjectDto();
      row.projectId = projectId;
      row.tasksCompleted = counts
        .filter((c) => c.projectId === projectId && c.kind === 'completed')
        .reduce((total, c) => total + c.count, 0);
      const own = (usage ?? []).filter((u) => u.projectId === projectId);
      row.tokens = measured ? own.reduce((total, u) => total + tokensOf(u), 0) : null;
      row.costUsd = measured ? round2(own.reduce((total, u) => total + u.costUsd, 0)) : null;
      row.pullRequestsMerged = null;
      return row;
    });
  }
}
