/**
 * When a bot dreams, what the dreamer is sent, and how its answer is read
 * (`25-bots.md` §4.1, "Dreaming"). What breaks this: a quiet bot paying for a
 * dream, or one with "Learn automatically" off having its memory rewritten
 * unasked; the person's own words or another bot's shared facts handed over
 * to be rewritten; an answer that drops most of the memory, invents a pile of
 * new facts or overfills it being used; a merged log fact losing its day.
 * The write itself, and its race with a save, are the integration suite's.
 */
import {
  BOT_DREAM_FACTS_MIN,
  BOT_DREAM_INTERVAL_MS,
  BOT_DREAM_WRITES_MIN,
  BOT_MEMORY_FACTS_MAX,
} from '@oppenheimer/shared';
import {
  BOT_DREAM_NEW_MAX,
  composeDreamRequest,
  type DreamFact,
  dreamLine,
  dreamTranscript,
  factRefs,
  readDream,
  rewritableFacts,
  shouldDream,
  undoLineId,
} from '../domain/bot-dream.policy';

const now = new Date('2026-11-07T12:00:00Z');
const BOT = '00000000-0000-4000-8000-0000000000b1';
const OTHER_BOT = '00000000-0000-4000-8000-0000000000b2';

function fact(id: string, overrides: Partial<DreamFact> = {}): DreamFact {
  return {
    id,
    botId: BOT,
    content: `fact ${id}`,
    tier: 'log',
    scope: 'bot',
    source: 'bot',
    createdAt: new Date('2026-11-01T09:00:00Z'),
    updatedAt: new Date('2026-11-01T09:00:00Z'),
    ...overrides,
  };
}

const ready = {
  rewritable: BOT_DREAM_FACTS_MIN,
  writesSince: BOT_DREAM_WRITES_MIN,
  lastDreamAt: null,
  learns: true,
};

describe('shouldDream', () => {
  it('dreams a bot that learns, keeps enough of its own facts and wrote enough since', () => {
    expect(shouldDream(ready, now)).toBe(true);
  });

  it('does not dream a bot with learning off, too few facts, or too few writes', () => {
    expect(shouldDream({ ...ready, learns: false }, now)).toBe(false);
    expect(shouldDream({ ...ready, rewritable: BOT_DREAM_FACTS_MIN - 1 }, now)).toBe(false);
    expect(shouldDream({ ...ready, writesSince: BOT_DREAM_WRITES_MIN - 1 }, now)).toBe(false);
  });

  it('waits a day after the last dream', () => {
    const justNow = new Date(now.getTime() - BOT_DREAM_INTERVAL_MS + 1);
    const aDayAgo = new Date(now.getTime() - BOT_DREAM_INTERVAL_MS);
    expect(shouldDream({ ...ready, lastDreamAt: justNow }, now)).toBe(false);
    expect(shouldDream({ ...ready, lastDreamAt: aDayAgo }, now)).toBe(true);
  });
});

describe('rewritableFacts', () => {
  it("rewrites only the facts the bot wrote itself, not the person's nor another bot's", () => {
    const own = fact('a');
    const byHand = fact('b', { source: 'user' });
    const shared = fact('c', { botId: OTHER_BOT, scope: 'person' });
    expect(rewritableFacts([own, byHand, shared], BOT)).toEqual([own]);
  });
});

describe('composeDreamRequest', () => {
  it('names each fact to rewrite by reference and fences the rest as data', () => {
    const message = composeDreamRequest({
      rewrite: factRefs([fact('a', { tier: 'profile', content: 'Likes  squash\nmerges' })]),
      keep: [fact('b', { source: 'user', content: 'Call me Jordi' })],
      summary: 'They work on oppenheimer.',
      messages: [{ role: 'user', content: 'ship it', createdAt: now }],
    });
    expect(message).toContain('[n1] (profile, about you, 2026-11-01) Likes squash merges');
    expect(message).toContain('<notes_to_leave>\n- (log, about you) Call me Jordi');
    expect(message).toContain('They work on oppenheimer.');
    expect(message).toContain('person (2026-11-07): ship it');
  });
});

describe('dreamTranscript', () => {
  it('keeps the newest messages that fit and leaves activity lines out', () => {
    const long = 'x'.repeat(120_000);
    const transcript = dreamTranscript([
      { role: 'user', content: long, createdAt: now },
      { role: 'activity', content: 'ran a tool', createdAt: now },
      { role: 'assistant', content: 'done', createdAt: now },
    ]);
    expect(transcript).toBe('bot (2026-11-07): done');
  });
});

describe('readDream', () => {
  const refs = factRefs([
    fact('a', { createdAt: new Date('2026-10-01T00:00:00Z') }),
    fact('b', { createdAt: new Date('2026-10-20T00:00:00Z') }),
    fact('c'),
    fact('d'),
  ]);
  const answer = (notes: unknown[], summary = 'Merged two.') => JSON.stringify({ notes, summary });

  it('reads the notes, keeping the newest day of the facts a note was merged from', () => {
    const plan = readDream(
      `\`\`\`json\n${answer([
        {
          content: ' Prefers   squash merges. ',
          tier: 'profile',
          about: 'person',
          from: ['n1', '[n2]'],
        },
        { content: 'Deploys go through dev.', tier: 'log', about: 'you', from: ['n3', 'n9'] },
      ])}\n\`\`\``,
      refs,
      0,
      now,
    );
    expect(plan).toEqual({
      facts: [
        {
          content: 'Prefers squash merges.',
          tier: 'profile',
          scope: 'person',
          createdAt: new Date('2026-10-20T00:00:00Z'),
        },
        {
          content: 'Deploys go through dev.',
          tier: 'log',
          scope: 'bot',
          createdAt: new Date('2026-11-01T09:00:00Z'),
        },
      ],
      note: 'Merged two.',
    });
  });

  it('leaves out bad notes and exact repeats, and dates a new note now', () => {
    const plan = readDream(
      answer([
        { content: 'Kept.', tier: 'log', about: 'you', from: ['n1'] },
        { content: 'kept.', tier: 'log', about: 'you', from: ['n2'] },
        { content: '', tier: 'log', about: 'you', from: [] },
        { content: 'x'.repeat(501), tier: 'log', about: 'you', from: [] },
        { content: 'Wrong tier.', tier: 'core', about: 'you', from: [] },
        { content: 'New.', tier: 'log', about: 'you', from: [] },
      ]),
      refs,
      0,
      now,
    );
    expect(plan?.facts.map((kept) => [kept.content, kept.createdAt])).toEqual([
      ['Kept.', new Date('2026-10-01T00:00:00Z')],
      ['New.', now],
    ]);
  });

  it(`adds at most ${BOT_DREAM_NEW_MAX} notes no fact stands behind`, () => {
    const many = Array.from({ length: BOT_DREAM_NEW_MAX + 3 }, (_, index) => ({
      content: `New ${index}.`,
      tier: 'log',
      about: 'you',
      from: [],
    }));
    expect(readDream(answer(many), refs, 0, now)?.facts).toHaveLength(BOT_DREAM_NEW_MAX);
  });

  it('refuses an answer that is not JSON, keeps nothing, keeps too little, or overfills', () => {
    const one = { content: 'One.', tier: 'log', about: 'you', from: ['n1'] };
    const manyRefs = factRefs(Array.from({ length: 20 }, (_, index) => fact(`f${index}`)));
    expect(readDream('I tidied it.', refs, 0, now)).toBeNull();
    expect(readDream(answer([]), refs, 0, now)).toBeNull();
    expect(readDream(answer([one, one]), manyRefs, 0, now)).toBeNull();
    expect(readDream(answer([one]), refs, BOT_MEMORY_FACTS_MAX, now)).toBeNull();
  });
});

describe('dreamLine', () => {
  it("tells the bot what changed, outside any turn, and an undo's line has an id of its own", () => {
    const line = dreamLine({
      id: '00000000-0000-4000-8000-00000000d001',
      organizationId: '00000000-0000-4000-8000-00000000a001',
      botId: BOT,
      activity: 'dreamed',
      factsBefore: 40,
      factsAfter: 22,
      note: 'Merged the deploy notes.',
      at: now,
    });
    expect(line.turnId).toBeNull();
    expect(line.content).toContain('your 40 notes are now 22');
    expect(line.content).toContain('Merged the deploy notes.');
    expect(line.event).toEqual({
      kind: 'dream',
      activity: 'dreamed',
      dreamId: line.id,
      factsBefore: 40,
      factsAfter: 22,
    });
    expect(undoLineId(line.id)).toBe(undoLineId(line.id));
    expect(undoLineId(line.id)).not.toBe(line.id);
  });
});
