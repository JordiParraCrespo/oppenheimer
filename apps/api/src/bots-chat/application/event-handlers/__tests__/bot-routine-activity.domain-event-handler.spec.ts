/**
 * The one writer of routine activity in a bot's chat: a routine's change and
 * a run that failed to start each become one line, written once however
 * often the outbox delivers the event, and announced on the bot's stream only
 * when it was written. What the line says is `bot-routine.policy.spec.ts`.
 */
import type { QueryBus } from '@nestjs/cqrs';
import type { BotRoutineRef } from '../../../../automations/domain/automation-read.types';
import { FindBotRoutineRefQuery } from '../../../../automations/queries/find-bot-routine-ref/find-bot-routine-ref.query';
import type { BotMessageRepositoryPort } from '../../../database/bot-message.repository.port';
import type { BotMessageEntity } from '../../../domain/bot-message.entity';
import type { BotStreamPort } from '../../../infrastructure/bot-stream.port';
import { BotRoutineActivityDomainEventHandler } from '../bot-routine-activity.domain-event-handler';

function setup(options: { stored?: boolean; routine?: BotRoutineRef | null } = {}) {
  const insertOnce = vi.fn(async (_line: BotMessageEntity) => options.stored ?? true);
  const messages: Pick<BotMessageRepositoryPort, 'insertOnce'> = { insertOnce };
  const publish = vi.fn(async () => undefined);
  const stream: Pick<BotStreamPort, 'publish'> = { publish };
  const execute = vi.fn(async () =>
    options.routine === undefined
      ? { organizationId: 'org-1', botId: 'bot-1', name: 'Morning PR digest' }
      : options.routine,
  );
  const handler = new BotRoutineActivityDomainEventHandler(
    messages as BotMessageRepositoryPort,
    stream as BotStreamPort,
    { execute } as unknown as QueryBus,
  );
  return { handler, insertOnce, publish, execute };
}

const changed = {
  id: 'event-1',
  aggregateId: 'automation-1',
  organizationId: 'org-1',
  botId: 'bot-1',
  name: 'Morning PR digest',
  activity: 'paused' as const,
  pausedReason: 'user',
};

describe('BotRoutineActivityDomainEventHandler', () => {
  it('writes a routine’s change as a line keyed by its event, and tells the open chats', async () => {
    const { handler, insertOnce, publish } = setup();
    await handler.onChanged(changed);
    const [line] = insertOnce.mock.calls[0];
    expect(line).toMatchObject({
      id: 'event-1',
      botId: 'bot-1',
      turnId: null,
      event: { activity: 'paused', automationId: 'automation-1', reason: 'user' },
    });
    expect(publish).toHaveBeenCalledWith('bot-1', {
      type: 'message',
      turnId: null,
      messageId: 'event-1',
    });
  });

  // What breaks this: an outbox redelivery announcing the same line twice.
  it('announces nothing for a line a delivery before already wrote', async () => {
    const { handler, publish } = setup({ stored: false });
    await handler.onChanged(changed);
    expect(publish).not.toHaveBeenCalled();
  });

  it('writes a run that could not start as a failure of its routine, named as it is now', async () => {
    const { handler, insertOnce, execute } = setup();
    await handler.onRun({
      id: 'event-2',
      aggregateId: 'run-1',
      automationId: 'automation-1',
      outcome: 'skipped',
      skipReason: 'workspace_rate_limited',
    });
    expect(execute).toHaveBeenCalledWith(
      new FindBotRoutineRefQuery({ automationId: 'automation-1' }),
    );
    expect(insertOnce.mock.calls[0][0]).toMatchObject({
      id: 'event-2',
      event: { activity: 'failed', runId: 'run-1', reason: 'workspace_rate_limited' },
    });
  });

  it('says nothing of a run a guard meant to stop, or of a session automation’s run', async () => {
    const quiet = setup();
    await quiet.handler.onRun({
      id: 'event-3',
      aggregateId: 'run-1',
      automationId: 'automation-1',
      outcome: 'skipped',
      skipReason: 'paused',
    });
    expect(quiet.execute).not.toHaveBeenCalled();

    const session = setup({ routine: null });
    await session.handler.onRun({
      id: 'event-4',
      aggregateId: 'run-2',
      automationId: 'automation-2',
      outcome: 'expired',
      skipReason: null,
    });
    expect(session.insertOnce).not.toHaveBeenCalled();
    expect(session.publish).not.toHaveBeenCalled();
  });
});
