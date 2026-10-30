import { BotMemoryFactEntity } from '@oppenheimer/frontend-consumer';
import { describe, expect, it } from 'vitest';
import { factRowModel } from '../lib/fact-row';

/**
 * How a memory row reads: a fact another bot shared is read only and says
 * so whoever wrote it; a fact about the person is tagged so before its tier;
 * an own fact's line says who wrote it last.
 */
const at = new Date('2026-10-29T10:00:00Z');
const later = new Date('2026-10-29T11:00:00Z');

function fact(over: {
  source?: 'user' | 'bot';
  tier?: 'profile' | 'log';
  scope?: 'bot' | 'person';
  botId?: string;
  updatedAt?: Date;
}) {
  return new BotMemoryFactEntity(
    'f-1',
    'Prefers squash merges.',
    over.source ?? 'user',
    over.tier ?? 'profile',
    over.scope ?? 'bot',
    over.botId ?? 'bot-1',
    at,
    over.updatedAt ?? at,
  );
}

describe('factRowModel', () => {
  it.each([
    [
      'another bot’s fact about you',
      fact({ scope: 'person', botId: 'bot-2', source: 'bot' }),
      { shared: true, kind: 'aboutYou', meta: 'sharedBy' },
    ],
    [
      'a fact it learned to look up',
      fact({ tier: 'log', source: 'bot' }),
      { shared: false, kind: 'lookedUp', meta: 'learned' },
    ],
    [
      'a fact about you it keeps in mind, from you',
      fact({ scope: 'person', tier: 'log' }),
      { shared: false, kind: 'aboutYou', meta: 'addedByYou' },
    ],
    [
      'a fact you reworded',
      fact({ updatedAt: later }),
      { shared: false, kind: null, meta: 'editedByYou' },
    ],
  ])('reads %s', (_, row, model) => {
    expect(factRowModel(row, 'bot-1')).toEqual(model);
  });
});
