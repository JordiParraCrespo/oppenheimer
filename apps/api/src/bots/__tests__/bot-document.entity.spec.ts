import { randomUUID } from 'node:crypto';
import type { BotDocumentRevision } from '../domain/bot.types';
import { userActor } from '../domain/bot.types';
import { BotDocumentEntity } from '../domain/bot-document.entity';

/**
 * A document's revision rules (`product/versions/mvp/25-bots.md` §1): a save
 * lands only over the revision it read, an unchanged save makes no revision,
 * and a revert appends rather than rewinds. The repository's conditional write
 * is the integration spec's.
 */
const author = randomUUID();

function stored(content = 'v2', revision = 2): BotDocumentEntity {
  return BotDocumentEntity.create({
    id: 'bot:instructions',
    props: {
      organizationId: randomUUID(),
      botId: 'bot',
      name: 'instructions',
      content,
      revision,
      updatedBy: 'user',
      updatedByUserId: author,
    },
  });
}

function revisionOf(document: BotDocumentEntity, revision: number, content: string) {
  return {
    id: randomUUID(),
    organizationId: document.organizationId,
    botId: document.botId,
    name: document.name,
    revision,
    content,
    author: 'user',
    authorUserId: author,
    note: '',
    revertedFrom: null,
    createdAt: new Date(),
  } satisfies BotDocumentRevision;
}

describe('BotDocumentEntity', () => {
  it('starts at revision 1 with that revision waiting to be written, so history begins at creation', () => {
    const document = BotDocumentEntity.initial({
      organizationId: randomUUID(),
      botId: 'bot',
      name: 'soul',
      content: '# Soul',
      actor: userActor(author),
    });
    expect(document.revision).toBe(1);
    expect(document.expectedRevision).toBe(0);
    expect(document.pendingRevision).toMatchObject({
      revision: 1,
      content: '# Soul',
      author: 'user',
      authorUserId: author,
      revertedFrom: null,
    });
  });

  it('writes the next revision over the one the writer read, conditioned on the stored one', () => {
    const document = stored();
    const outcome = document.write({
      content: 'v3',
      baseRevision: 2,
      actor: userActor(author),
      note: ' tighter rules ',
    });
    expect(outcome).toBe('written');
    expect(document.revision).toBe(3);
    expect(document.expectedRevision).toBe(2);
    expect(document.pendingRevision).toMatchObject({
      revision: 3,
      content: 'v3',
      note: 'tighter rules',
    });
  });

  it('refuses a save over a revision that is no longer current, and changes nothing', () => {
    const document = stored();
    expect(document.write({ content: 'v3', baseRevision: 1, actor: userActor(author) })).toBe(
      'stale',
    );
    expect(document.content).toBe('v2');
    expect(document.revision).toBe(2);
    expect(document.pendingRevision).toBeNull();
  });

  it('makes no revision for a save of what is already stored', () => {
    const document = stored();
    expect(document.write({ content: 'v2', baseRevision: 2, actor: userActor(author) })).toBe(
      'unchanged',
    );
    expect(document.pendingRevision).toBeNull();
  });

  it('records a change the bot makes as the bot’s, with no person on it', () => {
    const document = stored();
    document.write({ content: 'v3', baseRevision: 2, actor: { kind: 'bot' } });
    expect(document.updatedBy).toBe('bot');
    expect(document.updatedByUserId).toBeNull();
    expect(document.pendingRevision).toMatchObject({ author: 'bot', authorUserId: null });
  });

  it('reverts by appending the old content as the next revision', () => {
    const document = stored('v2', 2);
    expect(document.revertTo(revisionOf(document, 1, 'v1'), userActor(author))).toBe('written');
    expect(document.content).toBe('v1');
    expect(document.revision).toBe(3);
    expect(document.pendingRevision).toMatchObject({ revision: 3, content: 'v1', revertedFrom: 1 });
  });

  it('makes no revision for a revert to what is already current', () => {
    const document = stored('v2', 2);
    expect(document.revertTo(revisionOf(document, 2, 'v2'), userActor(author))).toBe('unchanged');
    expect(document.pendingRevision).toBeNull();
  });

  it('refuses to revert to another document’s revision', () => {
    const document = stored();
    const soul = { ...revisionOf(document, 1, 'v1'), name: 'soul' as const };
    expect(() => document.revertTo(soul, userActor(author))).toThrow();
  });

  it('conditions the next write on the revision this one stored, once it landed', () => {
    const document = stored();
    document.write({ content: 'v3', baseRevision: 2, actor: userActor(author) });
    document.written();
    expect(document.expectedRevision).toBe(3);
    expect(document.pendingRevision).toBeNull();
  });
});
