import { describe, expect, it, vi } from 'vitest';
import type { ParkedImagePort } from '../../../../links/application/parked-image.port';
import { CollectSessionImageCommand } from '../collect-session-image.command';
import { CollectSessionImageCommandHandler } from '../collect-session-image.command-handler';

describe('CollectSessionImageCommandHandler', () => {
  it('asks for the image as the host the assertion named', async () => {
    const image = {
      hostId: 'host-a',
      sessionId: 's',
      mediaType: 'image/png' as const,
      data: Buffer.from([1]),
    };
    const images = {
      park: vi.fn(),
      collect: vi.fn().mockResolvedValue(image),
    } satisfies ParkedImagePort;

    await expect(
      new CollectSessionImageCommandHandler(images).execute(
        new CollectSessionImageCommand({ hostId: 'host-a', commandId: 'cmd-1' }),
      ),
    ).resolves.toBe(image);
    expect(images.collect).toHaveBeenCalledWith('cmd-1', 'host-a');
  });

  it('answers HOSTS_007 when nothing is waiting, whatever the reason', async () => {
    const images = {
      park: vi.fn(),
      collect: vi.fn().mockResolvedValue(undefined),
    } satisfies ParkedImagePort;

    await expect(
      new CollectSessionImageCommandHandler(images).execute(
        new CollectSessionImageCommand({ hostId: 'host-a', commandId: 'cmd-1' }),
      ),
    ).rejects.toMatchObject({ code: 'HOSTS_007' });
  });
});
