import { Inject, Injectable, Logger } from '@nestjs/common';
import type { BotEngine, BotEngineEvent, BotSteering } from '@oppenheimer/backend-agents';
import { MODEL_PROVIDER_KEYS_MAX } from '@oppenheimer/shared';
import type {
  TurnCredential,
  TurnCredentialsPort,
} from '../../bots/application/turn-credentials.port';
import { TURN_CREDENTIALS } from '../../bots/bots.di-tokens';
import { BOT_ENGINE } from '../bots-chat.di-tokens';
import type { BotTurnEntity } from '../domain/bot-turn.entity';
import { BotSteeringFactory } from './bot-steering.factory';
import { BotTurnContextResolver, type ResolvedBotTurn } from './bot-turn-context.resolver';
import { type TranscriptWrite, TurnTranscript } from './turn-transcript.policy';

/** What a run of the engine needs besides the turn: where it writes, and what watches it. */
export interface BotTurnRunIo {
  signal: AbortSignal;
  scratchDir: string;
  write: (written: TranscriptWrite) => Promise<void>;
  saw: (event: BotEngineEvent) => void;
}

/** How a turn's run went: its transcript, and the key it ended on. */
export interface BotTurnRun {
  transcript: TurnTranscript;
  credential: TurnCredential;
}

/** One run of the engine: its transcript, and the credit refusal it held back, if it did. */
interface Attempt {
  transcript: TurnTranscript;
  heldBack: BotEngineEvent | null;
  refusedForCredit: boolean;
}

/** Whether an event is a turn's end the provider refused because the account behind the key is spent. */
function isCreditRefusal(event: BotEngineEvent): boolean {
  return event.type === 'done' && event.reason === 'failed' && event.failure === 'usage_limit';
}

/**
 * Runs a turn's engine on the provider's keys in turn, so a workspace's next
 * key takes over when one runs out of credit. A turn the provider refuses
 * because the account behind its key is spent (`usage_limit`), before it
 * wrote anything or took a steer, reports the key (`TurnCredentialsPort.spent`,
 * which marks it) and runs again from the start on the next one, read afresh
 * so its reviewers and subagents move with it. A refusal after the turn wrote
 * something ends it as before, the key still marked, so the next turn starts
 * on the next key. A turn that completes on a key marked spent clears the
 * mark: it was topped up.
 */
@Injectable()
export class BotTurnKeyFailoverResolver {
  private readonly logger = new Logger(BotTurnKeyFailoverResolver.name);

  constructor(
    @Inject(BOT_ENGINE) private readonly engine: BotEngine,
    @Inject(TURN_CREDENTIALS) private readonly credentials: TurnCredentialsPort,
    private readonly context: BotTurnContextResolver,
    private readonly steering: BotSteeringFactory,
  ) {}

  async run(turn: BotTurnEntity, first: ResolvedBotTurn, io: BotTurnRunIo): Promise<BotTurnRun> {
    let shape = first;
    for (let attempt = 1; ; attempt += 1) {
      const run = await this.attempt(turn, shape, io, attempt < MODEL_PROVIDER_KEYS_MAX);
      const { organizationId, provider } = turn;
      if (run.refusedForCredit) {
        const next = await this.credentials.spent(
          organizationId,
          provider,
          shape.credential,
          new Date(),
        );
        const again = next && run.heldBack ? await this.context.resolve(turn, new Date()) : null;
        if (again) {
          this.logger.log({
            message: 'A bot turn moved to its provider’s next key',
            turnId: turn.id,
            provider,
          });
          shape = again;
          continue;
        }
      }
      // No key to move to: the refusal held back is the turn's end after all.
      if (run.heldBack) {
        for (const written of run.transcript.apply(run.heldBack)) await io.write(written);
      }
      return { transcript: run.transcript, credential: shape.credential };
    }
  }

  /** After the turn ended: a completed turn on a key marked spent clears the mark. */
  async ended(turn: BotTurnEntity, credential: TurnCredential): Promise<void> {
    if (turn.status !== 'completed') return;
    try {
      await this.credentials.worked(turn.organizationId, turn.provider, credential);
    } catch (error) {
      // The turn has ended; a mark left behind goes on a later turn.
      this.logger.warn({
        message: "Could not clear a provider key's spent mark",
        turnId: turn.id,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  private async attempt(
    turn: BotTurnEntity,
    shape: ResolvedBotTurn,
    io: BotTurnRunIo,
    mayMoveOn: boolean,
  ): Promise<Attempt> {
    const transcript = new TurnTranscript(turn);
    let tookSteer = false;
    const steering: BotSteering | undefined = shape.takesSteers
      ? (() => {
          const inner = this.steering.steering(turn);
          return {
            take: async () => {
              const taken = await inner.take();
              if (taken.length > 0) tookSteer = true;
              return taken;
            },
          };
        })()
      : undefined;
    const request = { ...shape.request, signal: io.signal, scratchDir: io.scratchDir, steering };
    let wrote = false;
    let heldBack: BotEngineEvent | null = null;
    let refusedForCredit = false;
    for await (const event of this.engine.run(request)) {
      io.saw(event);
      if (isCreditRefusal(event)) {
        refusedForCredit = true;
        // Nothing said yet: another key can run the turn as though this never happened.
        if (mayMoveOn && !wrote && !tookSteer) {
          heldBack = event;
          continue;
        }
      }
      for (const written of transcript.apply(event)) {
        wrote = true;
        await io.write(written);
      }
    }
    return { transcript, heldBack, refusedForCredit };
  }
}
