import { AppError } from '@oppenheimer/frontend-core';
import { describe, expect, it } from 'vitest';
import {
  BotDocumentEntity,
  BotEntity,
  BotMemoryFactEntity,
  documentConflictRevision,
} from '../bot.entity';

const at = new Date('2026-10-14T09:00:00.000Z');

function bot(name: string) {
  return new BotEntity(
    'bot-1',
    name,
    '',
    'mint',
    null,
    0,
    null,
    'anthropic',
    null,
    'medium',
    'auto',
    false,
    at,
    at,
    at,
  );
}

describe('BotEntity.initials', () => {
  it('takes the first letter of the first two words, so "New Bot" is NB', () => {
    expect(bot('New Bot').initials).toBe('NB');
    expect(bot('release bot for atlas').initials).toBe('RB');
  });

  it('takes two letters of a one-word name rather than one', () => {
    expect(bot('quota').initials).toBe('QU');
  });

  it('never splits a letter made of two code units', () => {
    expect(bot('Élan 𝒳ylo').initials).toBe('É𝒳');
  });
});

describe('BotDocumentEntity.isBlank', () => {
  it('reads instructions of only whitespace as not written yet', () => {
    expect(new BotDocumentEntity('instructions', ' \n ', 1, 'user', at).isBlank).toBe(true);
    expect(new BotDocumentEntity('instructions', '# Job', 2, 'user', at).isBlank).toBe(false);
  });
});

describe('BotMemoryFactEntity.isEdited', () => {
  it('is edited once its last write is not its first', () => {
    const later = new Date('2026-10-14T10:00:00.000Z');
    expect(new BotMemoryFactEntity('f', 'x', 'user', at, at).isEdited).toBe(false);
    expect(new BotMemoryFactEntity('f', 'x', 'user', at, later).isEdited).toBe(true);
  });
});

describe('documentConflictRevision', () => {
  const conflict = (problem: Record<string, unknown>) =>
    new AppError(
      { code: 'BOTS_CLIENT_009', message: 'Failed to save the revision' },
      {
        problem: {
          type: 'about:blank',
          title: 'The document was changed since it was loaded',
          status: 409,
          code: 'BOTS_006',
          ...problem,
        },
      },
    );

  it('reads the revision the document is at off the API’s conflict', () => {
    expect(documentConflictRevision(conflict({ revision: 7 }))).toBe(7);
  });

  it('is null for any other failure, so the editor shows it as a failure', () => {
    expect(documentConflictRevision(new Error('offline'))).toBeNull();
    expect(
      documentConflictRevision(
        new AppError({ code: 'BOTS_001', message: 'Bot not found' }, { status: 404 }),
      ),
    ).toBeNull();
    expect(documentConflictRevision(null)).toBeNull();
  });

  it('is null for a conflict without a revision rather than a made-up one', () => {
    expect(documentConflictRevision(conflict({}))).toBeNull();
  });
});
