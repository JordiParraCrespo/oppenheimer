import { Inject, Injectable } from '@nestjs/common';
import { AppError } from '@oppenheimer/backend-core';
import type { CloudRunsPort } from '../../cloud-agents/application/cloud-runs.port';
import { CLOUD_RUNS } from '../../cloud-agents/cloud-agents.di-tokens';
import type { WorkSessionRepositoryPort } from '../database/work-session.repository.port';
import type { SessionCloudRunEntity } from '../domain/session-cloud-run.entity';
import { cloudRunEntries } from '../domain/session-log-entry.factory';
import { cloudPromptRefusal, type SessionPromptSender } from '../domain/session-prompt.policy';
import { SESSION_EVENT_KINDS } from '../domain/session-state.policy';
import { WorkSessionEntity } from '../domain/work-session.entity';
import { WORK_SESSION_REPOSITORY } from '../sessions.di-tokens';
import type { TypedPrompt } from './session-prompt-typer.resolver';

/**
 * A follow-up to a cloud session a vendor runs (Cursor's), sent as the vendor
 * takes one: a new run on the same agent (`product/next-steps/cloud-agents.md`,
 * "Follow-ups to a cloud agent"). The same three moves as typing into a
 * terminal (`SessionPromptTyperResolver`), so the log reads one way:
 *
 * 1. **Claim.** `prompt.sent`, with the sender as the API read it, appended
 *    only while the agent is not on a run and no other prompt waits; of two
 *    sent at once, one is claimed and the other refused. Keyed by
 *    `commandId`, so a retry claims once.
 * 2. **Deliver.** The vendor is asked on the launcher's own key. A refusal
 *    (still busy at the vendor, a rate limit, a key gone) is
 *    `prompt.undelivered`, which cancels the turn the claim opened, and the
 *    vendor's code is thrown for the caller to read. Nothing is queued.
 * 3. **Acknowledge.** The new run becomes the one the session follows, and
 *    its first status is folded into the log like any sync's, so the turn
 *    moves on and a bot following the session is woken when it ends.
 */
@Injectable()
export class CloudFollowUpResolver {
  constructor(
    @Inject(CLOUD_RUNS) private readonly runs: CloudRunsPort,
    @Inject(WORK_SESSION_REPOSITORY) private readonly sessions: WorkSessionRepositoryPort,
  ) {}

  async send(
    session: WorkSessionEntity,
    run: SessionCloudRunEntity,
    prompt: { commandId: string; text: string; sender: SessionPromptSender },
    now: Date = new Date(),
  ): Promise<TypedPrompt> {
    const notReady = cloudPromptRefusal(run, session.fold, session.latestTurn, now);
    if (notReady) return { outcome: 'not-ready', reason: notReady };

    const claimed = await this.sessions.appendEventsIf(
      session,
      [
        this.entry(prompt.commandId, SESSION_EVENT_KINDS.PROMPT_SENT, {
          text: prompt.text,
          sender: prompt.sender,
        }),
      ],
      (fold, latestTurn) => cloudPromptRefusal(run, fold, latestTurn, now) === null,
    );
    if (!claimed) {
      return {
        outcome: 'not-ready',
        reason: 'The agent moved on before the prompt could be sent.',
      };
    }
    if (claimed.appended.length === 0) return { outcome: 'claimed-before' };

    let report: Awaited<ReturnType<CloudRunsPort['followUp']>>;
    try {
      report = await this.runs.followUp(
        { organizationId: session.organizationId, userId: session.createdByUserId },
        run.provider,
        run.externalId,
        prompt.text,
      );
    } catch (error) {
      if (error instanceof AppError) {
        await this.sessions.appendEvents(session, [
          this.entry(prompt.commandId, SESSION_EVENT_KINDS.PROMPT_UNDELIVERED, {
            id: prompt.commandId,
          }),
        ]);
      }
      throw error;
    }

    const runIdAtLoad = run.latestRunId;
    run.followedUp(report, now);
    await this.sessions.saveCloudRunIf(run, runIdAtLoad);
    const events = cloudRunEntries(report, now);
    if (events.length > 0) await this.sessions.appendEvents(session, events);
    return { outcome: 'typed', seq: claimed.appended.at(-1)?.seq };
  }

  private entry(commandId: string, kind: string, payload: unknown) {
    return {
      idempotencyKey: WorkSessionEntity.apiIdempotencyKey(commandId, kind),
      source: 'api' as const,
      kind,
      payload,
    };
  }
}
