import { Injectable } from '@nestjs/common';
import { QueryBus } from '@nestjs/cqrs';
import type { WorkSessionEntity } from '../../sessions/domain/work-session.entity';
import { FindSessionQuery } from '../../sessions/queries/find-session/find-session.query';
import { waitViewOf } from '../bot-session-tool.mapper';
import {
  BOT_SESSION_WAIT_POLL_MS,
  sessionWaitAnswer,
  sessionWaitOutcome,
} from '../domain/bot-session-wait.policy';
import type { BotToolCallContext } from './bot-tool.factory';

/**
 * A bot's bounded wait on a session inside its turn (`25-bots.md` §4.2): it
 * reads the session as the owner every few seconds until its task settles,
 * the session is closed or the deadline passes, and answers in words. A turn
 * that is stopped stops its wait with it. The rules are
 * `bot-session-wait.policy.ts`; this is only the clock and the reads.
 */
@Injectable()
export class BotSessionWaitResolver {
  constructor(private readonly queryBus: QueryBus) {}

  async wait(
    context: BotToolCallContext,
    sessionId: string,
    seconds: number,
    signal: AbortSignal,
  ): Promise<string> {
    const started = Date.now();
    const deadline = started + seconds * 1_000;
    for (;;) {
      const session = await this.queryBus.execute<FindSessionQuery, WorkSessionEntity>(
        new FindSessionQuery({ scope: context.owner, sessionId }),
      );
      const outcome = sessionWaitOutcome(waitViewOf(session));
      const waited = Math.round((Date.now() - started) / 1_000);
      if (outcome.settled || Date.now() + BOT_SESSION_WAIT_POLL_MS > deadline) {
        return sessionWaitAnswer(sessionId, outcome, waited);
      }
      await pause(BOT_SESSION_WAIT_POLL_MS, signal);
    }
  }
}

/** Waits `ms`, or rejects the moment `signal` aborts. */
function pause(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) return reject(signal.reason);
    const timer = setTimeout(() => {
      signal.removeEventListener('abort', stop);
      resolve();
    }, ms);
    const stop = () => {
      clearTimeout(timer);
      reject(signal.reason);
    };
    signal.addEventListener('abort', stop, { once: true });
  });
}
