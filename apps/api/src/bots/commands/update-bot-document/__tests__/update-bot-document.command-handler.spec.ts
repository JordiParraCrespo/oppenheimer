import { randomUUID } from 'node:crypto';
import type { AccessScope } from '@oppenheimer/backend-authz';
import { Some } from 'oxide.ts';
import { BotLookupResolver } from '../../../application/bot-lookup.resolver';
import type { BotRepositoryPort } from '../../../database/bot.repository.port';
import type { BotDocumentRepositoryPort } from '../../../database/bot-document.repository.port';
import { BotEntity } from '../../../domain/bot.entity';
import { BotDocumentEntity } from '../../../domain/bot-document.entity';
import { UpdateBotDocumentCommand } from '../update-bot-document.command';
import { UpdateBotDocumentCommandHandler } from '../update-bot-document.command-handler';

/**
 * Saving a document from Settings: a stale save is refused with the current
 * revision, an unchanged one writes nothing, and a writer that loses the
 * conditional write is told so. The conditional write itself is the
 * integration spec's.
 */
const userId = randomUUID();
const organizationId = randomUUID();
const scope: AccessScope = {
  userId,
  organizationId,
  teamIds: [],
  grants: new Map(),
  bypass: false,
};

function setup() {
  const bot = BotEntity.createNew({
    organizationId,
    createdByUserId: userId,
    name: 'Ana',
    description: '',
    avatarColor: 'mint',
    groupId: null,
    homeHostId: null,
    provider: 'anthropic',
  });
  const document = BotDocumentEntity.create({
    id: `${bot.id}:instructions`,
    props: {
      organizationId,
      botId: bot.id,
      name: 'instructions',
      content: 'v2',
      revision: 2,
      updatedBy: 'user',
      updatedByUserId: userId,
    },
  });
  const bots = {
    findOneById: vi.fn<BotRepositoryPort['findOneById']>(async () => Some(bot)),
  } satisfies Pick<BotRepositoryPort, 'findOneById'>;
  const documents = {
    findOne: vi.fn<BotDocumentRepositoryPort['findOne']>(async () => Some(document)),
    save: vi.fn<BotDocumentRepositoryPort['save']>(async () => 'saved'),
  } satisfies Pick<BotDocumentRepositoryPort, 'findOne' | 'save'>;
  const handler = new UpdateBotDocumentCommandHandler(
    new BotLookupResolver(bots as unknown as BotRepositoryPort),
    documents as unknown as BotDocumentRepositoryPort,
  );
  const save = (name: string, content: string, baseRevision: number) =>
    handler.execute(
      new UpdateBotDocumentCommand({
        scope,
        botId: bot.id,
        name,
        input: { content, baseRevision },
      }),
    );
  return { document, documents, save };
}

describe('UpdateBotDocumentCommandHandler', () => {
  it('saves the next revision as the caller', async () => {
    const { document, documents, save } = setup();
    await save('instructions', 'v3', 2);
    expect(documents.save).toHaveBeenCalledWith(document);
    expect(document.pendingRevision).toMatchObject({ revision: 3, authorUserId: userId });
  });

  it('refuses a save over an older revision with BOTS_006 and the current one, and writes nothing', async () => {
    const { documents, save } = setup();
    await expect(save('instructions', 'v3', 1)).rejects.toMatchObject({
      code: 'BOTS_006',
      extensions: { revision: 2 },
    });
    expect(documents.save).not.toHaveBeenCalled();
  });

  it('writes nothing for a save of what is already stored', async () => {
    const { documents, save } = setup();
    await save('instructions', 'v2', 2);
    expect(documents.save).not.toHaveBeenCalled();
  });

  it('answers BOTS_006 when another save landed between the read and the write', async () => {
    const { documents, save } = setup();
    documents.save.mockResolvedValueOnce('conflict');
    await expect(save('instructions', 'v3', 2)).rejects.toMatchObject({ code: 'BOTS_006' });
  });

  it('refuses a document name that is not soul or instructions with BOTS_005', async () => {
    const { documents, save } = setup();
    await expect(save('readme', 'v3', 2)).rejects.toMatchObject({ code: 'BOTS_005' });
    expect(documents.findOne).not.toHaveBeenCalled();
  });
});
