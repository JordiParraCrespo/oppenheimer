/**
 * The spend guard stopping a bot (`26-bot-routines.md` §6). What breaks this:
 * the other routines left running; no word to the owner, a word per routine,
 * or a word in a language they did not choose; and a pause delivered late
 * stopping everything again after the owner came back. Which routines pause
 * is `automations/__tests__/unattended-routines.spec.ts`.
 */
import type { CommandBus } from '@nestjs/cqrs';
import type { I18nService } from '@oppenheimer/backend-i18n';
import { PauseUnattendedRoutinesCommand } from '../../../automations/commands/pause-unattended-routines/pause-unattended-routines.command';
import type { BotEntity } from '../../../bots/domain/bot.entity';
import type { LocaleResolverPort } from '../../../profile/application/locale-resolver.port';
import type { BotNoticeRepositoryPort } from '../../database/bot-notice.repository.port';
import type { BotNoticeEntity } from '../../domain/bot-notice.entity';
import type { BotModelAccessResolver } from '../bot-model-access.resolver';
import { BotUnattendedRoutinesDomainEventHandler } from '../event-handlers/bot-unattended-routines.domain-event-handler';

const pausedAt = new Date('2026-11-07T12:00:00Z');

function setup(options: { teller?: string | null; seenAt?: Date; gone?: boolean } = {}) {
  const commands = { execute: vi.fn(async () => options.teller ?? 'routine-1') };
  const bot = {
    id: 'bot-1',
    createdByUserId: 'owner-1',
    ownerSeenAt: options.seenAt ?? new Date(pausedAt.getTime() - 4 * 86_400_000),
  } as BotEntity;
  const bots = {
    findBot: vi.fn<BotModelAccessResolver['findBot']>(async () => (options.gone ? null : bot)),
  };
  const put = vi.fn<BotNoticeRepositoryPort['put']>(async () => undefined);
  const locales = {
    resolveForRecipient: vi.fn<LocaleResolverPort['resolveForRecipient']>(async () => ({
      locale: 'es',
      timeZone: 'Europe/Madrid',
    })),
  };
  const t = vi.fn((key: string) => `[es] ${key}`);
  const i18n = { for: vi.fn(() => ({ t })) };
  const handler = new BotUnattendedRoutinesDomainEventHandler(
    commands as unknown as CommandBus,
    bots as unknown as BotModelAccessResolver,
    { put } as unknown as BotNoticeRepositoryPort,
    locales as unknown as LocaleResolverPort,
    i18n as unknown as I18nService,
  );
  return { commands, put, locales, i18n, handler };
}

const paused = (aggregateId: string, pausedReason: string | null = 'unattended') => ({
  aggregateId,
  organizationId: 'org-1',
  botId: 'bot-1',
  activity: 'paused' as const,
  pausedReason,
  metadata: { timestamp: pausedAt.getTime(), correlationId: 'c-1' },
});

describe('BotUnattendedRoutinesDomainEventHandler', () => {
  it("pauses the bot's other routines and tells the owner once, in their language", async () => {
    const { commands, put, locales, i18n, handler } = setup();
    await handler.handle(paused('routine-1'));

    const [command] = commands.execute.mock.calls[0] as unknown as [PauseUnattendedRoutinesCommand];
    expect(command).toBeInstanceOf(PauseUnattendedRoutinesCommand);
    expect(command).toMatchObject({ organizationId: 'org-1', botId: 'bot-1' });
    expect(locales.resolveForRecipient).toHaveBeenCalledWith('owner-1');
    expect(i18n.for).toHaveBeenCalledWith('es', 'Europe/Madrid');
    expect(put).toHaveBeenCalledTimes(1);
    const [notice] = put.mock.calls[0] as [BotNoticeEntity];
    expect(notice).toMatchObject({ botId: 'bot-1', text: '[es] bots.routineGuard.notice' });
  });

  it('says nothing for the pause of another routine of the same stop', async () => {
    const { put, handler } = setup({ teller: 'routine-1' });
    await handler.handle(paused('routine-2'));
    expect(put).not.toHaveBeenCalled();
  });

  // The regression: a pause delivered after the owner came back re-paused
  // every routine they had just resumed, while they sat in the chat.
  it('stops nothing more when the owner was back in the chat after the pause', async () => {
    const { commands, put, handler } = setup({ seenAt: new Date(pausedAt.getTime() + 1000) });
    await handler.handle(paused('routine-1'));
    expect(commands.execute).not.toHaveBeenCalled();
    expect(put).not.toHaveBeenCalled();
  });

  it('leaves any other pause, and a bot that is gone, alone', async () => {
    const { commands, put, handler } = setup();
    await handler.handle(paused('routine-1', 'user'));
    await handler.handle({ ...paused('routine-1'), activity: 'resumed' });
    await setup({ gone: true }).handler.handle(paused('routine-1'));
    expect(commands.execute).not.toHaveBeenCalled();
    expect(put).not.toHaveBeenCalled();
  });
});
