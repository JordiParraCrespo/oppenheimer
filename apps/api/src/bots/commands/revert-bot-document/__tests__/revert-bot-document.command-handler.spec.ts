import { randomUUID } from 'node:crypto';
import type { AccessScope } from '@oppenheimer/backend-authz';
import { None, Some } from 'oxide.ts';
import { BotLookupResolver } from '../../../application/bot-lookup.resolver';
import type { BotRepositoryPort } from '../../../database/bot.repository.port';
import type { BotDocumentRepositoryPort } from '../../../database/bot-document.repository.port';
import { BotEntity } from '../../../domain/bot.entity';
import { BotDocumentEntity } from '../../../domain/bot-document.entity';
import { RevertBotDocumentCommand } from '../revert-bot-document.command';
import { RevertBotDocumentCommandHandler } from '../revert-bot-document.command-handler';

/** Revert from the revisions list: the old content as a new revision, or a 404 for none. */
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
    id: `${bot.id}:soul`,
    props: {
      organizationId,
      botId: bot.id,
      name: 'soul',
      content: 'v2',
      revision: 2,
      updatedBy: 'user',
      updatedByUserId: userId,
    },
  });
  const documents = {
    findOne: vi.fn<BotDocumentRepositoryPort['findOne']>(async () => Some(document)),
    findRevision: vi.fn<BotDocumentRepositoryPort['findRevision']>(async () =>
      Some({
        id: randomUUID(),
        organizationId,
        botId: bot.id,
        name: 'soul' as const,
        revision: 1,
        content: 'v1',
        author: 'user' as const,
        authorUserId: userId,
        note: '',
        revertedFrom: null,
        createdAt: new Date(),
      }),
    ),
    save: vi.fn<BotDocumentRepositoryPort['save']>(async () => 'saved'),
  } satisfies Pick<BotDocumentRepositoryPort, 'findOne' | 'findRevision' | 'save'>;
  const bots = {
    findOneById: vi.fn<BotRepositoryPort['findOneById']>(async () => Some(bot)),
  } satisfies Pick<BotRepositoryPort, 'findOneById'>;
  const handler = new RevertBotDocumentCommandHandler(
    new BotLookupResolver(bots as unknown as BotRepositoryPort),
    documents as unknown as BotDocumentRepositoryPort,
  );
  const revert = (revision: number) =>
    handler.execute(new RevertBotDocumentCommand({ scope, botId: bot.id, name: 'soul', revision }));
  return { document, documents, revert };
}

describe('RevertBotDocumentCommandHandler', () => {
  it('writes the old content as the next revision, marked as a revert', async () => {
    const { document, documents, revert } = setup();
    await revert(1);
    expect(documents.save).toHaveBeenCalledWith(document);
    expect(document.pendingRevision).toMatchObject({ revision: 3, content: 'v1', revertedFrom: 1 });
  });

  it('refuses a revision the document never had with BOTS_007 and writes nothing', async () => {
    const { documents, revert } = setup();
    documents.findRevision.mockResolvedValueOnce(None);
    await expect(revert(9)).rejects.toMatchObject({ code: 'BOTS_007' });
    expect(documents.save).not.toHaveBeenCalled();
  });
});
