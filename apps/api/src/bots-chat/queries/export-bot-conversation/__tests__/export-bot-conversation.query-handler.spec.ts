import { randomUUID } from 'node:crypto';
import { AppError } from '@oppenheimer/backend-core';
import type { AccessScope } from '../../../../authz/domain/access-scope.types';
import type { BotLookupPort } from '../../../../bots/application/bot-lookup.port';
import type { BotEntity } from '../../../../bots/domain/bot.entity';
import { BotErrors } from '../../../../bots/domain/bots.errors';
import type { BotMessageRepositoryPort } from '../../../database/bot-message.repository.port';
import { BotMessageEntity } from '../../../domain/bot-message.entity';
import { ExportBotConversationQuery } from '../export-bot-conversation.query';
import {
  EXPORT_PAGE_SIZE,
  ExportBotConversationQueryHandler,
} from '../export-bot-conversation.query-handler';

/**
 * Export reads the whole chat a page at a time, each page after the last
 * message of the one before, and stops at the first short page; a bot the
 * caller cannot see is `BOTS_001` before anything is read. The keyset itself
 * is the integration suite's.
 */
const scope: AccessScope = {
  userId: randomUUID(),
  organizationId: randomUUID(),
  teamIds: [],
  grants: new Map(),
  bypass: false,
};
const botId = randomUUID();

function messages(count: number): BotMessageEntity[] {
  return Array.from({ length: count }, (_, index) =>
    BotMessageEntity.createNew({
      organizationId: scope.organizationId as string,
      botId,
      turnId: randomUUID(),
      role: 'user',
      content: `Message ${index}`,
      steps: [],
      position: 0,
    }),
  );
}

async function collect(pages: AsyncIterable<BotMessageEntity[]>): Promise<BotMessageEntity[][]> {
  const read: BotMessageEntity[][] = [];
  for await (const page of pages) read.push(page);
  return read;
}

describe('ExportBotConversationQueryHandler', () => {
  it('reads page after page from the last message read, until a short page', async () => {
    const all = messages(EXPORT_PAGE_SIZE + 2);
    const pages = [all.slice(0, EXPORT_PAGE_SIZE), all.slice(EXPORT_PAGE_SIZE)];
    const findExportPage = vi.fn(async () => pages.shift() ?? []);
    const handler = new ExportBotConversationQueryHandler(
      { bot: async () => ({ id: botId }) as BotEntity },
      { findExportPage } as unknown as BotMessageRepositoryPort,
    );
    const read = await collect(await handler.execute(new ExportBotConversationQuery(scope, botId)));
    expect(read.flat()).toEqual(all);
    expect(findExportPage).toHaveBeenNthCalledWith(1, scope, botId, null, EXPORT_PAGE_SIZE);
    expect(findExportPage).toHaveBeenNthCalledWith(
      2,
      scope,
      botId,
      all[EXPORT_PAGE_SIZE - 1],
      EXPORT_PAGE_SIZE,
    );
    expect(findExportPage).toHaveBeenCalledTimes(2);
  });

  it('answers BOTS_001 for a bot the caller cannot see, before reading a message', async () => {
    const findExportPage = vi.fn();
    const lookup: BotLookupPort = {
      bot: async () => {
        throw new AppError(BotErrors.NOT_FOUND);
      },
    };
    const handler = new ExportBotConversationQueryHandler(lookup, {
      findExportPage,
    } as unknown as BotMessageRepositoryPort);
    await expect(
      handler.execute(new ExportBotConversationQuery(scope, botId)),
    ).rejects.toMatchObject({ code: 'BOTS_001' });
    expect(findExportPage).not.toHaveBeenCalled();
  });
});
