import 'reflect-metadata';
import type { CommandBus } from '@nestjs/cqrs';
import type { TelegramInbound, TelegramMessagesMessage } from '@oppenheimer/shared/protocol';
import { describe, expect, it, vi } from 'vitest';
import type { RunnerLink } from '../../links/application/link-registry.port';
import {
  TELEGRAM_INTAKE_PER_MINUTE,
  TELEGRAM_INTAKE_QUEUE_MAX,
  TelegramLinkProcessor,
} from '../infrastructure/telegram-link.processor';

/**
 * A runner's Telegram intake is the frame it can make the database grow
 * with, so it is bounded per link: stored one frame at a time, in order, with
 * a short backlog and a rate per minute. A frame past either is neither
 * stored nor acked, so the runner, which keeps it, offers it again later.
 * What intake stores is the module's specs.
 */

function frame(count: number, from = 0): TelegramMessagesMessage {
  const messages: TelegramInbound[] = Array.from({ length: count }, (_, index) => ({
    key: `chat/${from + index}`,
    id: `${from + index}`,
    chatId: '123456789',
    chatKind: 'direct',
    senderId: '123456789',
    text: 'hi',
    sentAt: '2026-11-08T10:00:00Z',
  }));
  return { type: 'telegram.messages', messages };
}

function harness() {
  const release: Array<() => void> = [];
  const execute = vi.fn(
    (command: { messages: TelegramInbound[] }) =>
      new Promise<string[]>((resolve) =>
        release.push(() => resolve(command.messages.map((m) => m.key))),
      ),
  );
  const link = { hostId: 'host-1', send: vi.fn().mockReturnValue(true) } as unknown as RunnerLink;
  const processor = new TelegramLinkProcessor({ execute } as unknown as CommandBus);
  return { execute, link, processor, release };
}

describe('TelegramLinkProcessor', () => {
  it('stores one frame at a time, in order, and acks each once stored', async () => {
    const { execute, link, processor, release } = harness();
    const first = processor.onMessages(link, frame(1, 0));
    const second = processor.onMessages(link, frame(1, 1));
    await Promise.resolve();
    expect(execute).toHaveBeenCalledTimes(1);

    release.shift()?.();
    await first;
    await vi.waitFor(() => expect(execute).toHaveBeenCalledTimes(2));
    release.shift()?.();
    await second;

    expect(vi.mocked(link.send).mock.calls.map(([sent]) => sent)).toEqual([
      { type: 'telegram.ack', keys: ['chat/0'] },
      { type: 'telegram.ack', keys: ['chat/1'] },
    ]);
  });

  it('drops a frame past the backlog, unacked', async () => {
    const { execute, link, processor } = harness();
    for (let index = 0; index < TELEGRAM_INTAKE_QUEUE_MAX + 1; index += 1) {
      void processor.onMessages(link, frame(1, index));
    }
    await Promise.resolve();
    expect(execute).toHaveBeenCalledTimes(1);
    await processor.onMessages(link, frame(1, 99));
    expect(link.send).not.toHaveBeenCalled();
  });

  it('drops a frame past the minute’s allowance, and takes it once the minute has passed', async () => {
    const { execute, link, processor, release } = harness();
    const now = Date.parse('2026-11-08T10:00:00Z');
    const full = TELEGRAM_INTAKE_PER_MINUTE / 50;
    for (let index = 0; index < full; index += 1) {
      const stored = processor.onMessages(link, frame(50, index * 50), now);
      await vi.waitFor(() => expect(release.length).toBe(1));
      release.shift()?.();
      await stored;
    }
    await processor.onMessages(link, frame(1, 9_000), now + 1_000);
    expect(execute).toHaveBeenCalledTimes(full);

    const later = processor.onMessages(link, frame(1, 9_001), now + 61_000);
    await vi.waitFor(() => expect(release.length).toBe(1));
    release.shift()?.();
    await later;
    expect(execute).toHaveBeenCalledTimes(full + 1);
  });
});
