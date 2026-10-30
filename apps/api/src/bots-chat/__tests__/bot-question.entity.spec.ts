import type { BotQuestion } from '@oppenheimer/shared';
import { BotQuestionEntity } from '../domain/bot-question.entity';

/**
 * A card of questions is decided once: answered with one answer per
 * question that fits it, dismissed, or retired by a new message, never
 * twice, and never approved (it has no call to run).
 */
const REPO: BotQuestion = {
  header: 'Repo',
  question: 'Which repository?',
  multiSelect: false,
  options: [
    { label: 'acme/api', description: null },
    { label: 'acme/web', description: null },
  ],
};
const SCOPE: BotQuestion = {
  header: null,
  question: 'What should it cover?',
  multiSelect: true,
  options: [
    { label: 'Tests', description: null },
    { label: 'Docs', description: null },
    { label: 'Changelog', description: null },
  ],
};

const ask = (questions: BotQuestion[] = [REPO, SCOPE]) =>
  BotQuestionEntity.ask({
    organizationId: 'org-1',
    botId: 'bot-1',
    turnId: 'turn-1',
    questions,
    summary: 'Which repository? (+1 more)',
  });
const NOW = new Date('2026-10-29T10:00:00Z');

describe('BotQuestionEntity', () => {
  it('stores one answer per question, picks in order and once, their words trimmed', () => {
    const card = ask();
    card.answer('owner-1', NOW, [
      { picks: [1], other: null },
      { picks: [2, 0, 2], other: '  and the README ' },
    ]);
    expect(card).toMatchObject({ status: 'answered', decidedByUserId: 'owner-1', decidedAt: NOW });
    expect(card.answers).toEqual([
      { picks: [1], other: null },
      { picks: [0, 2], other: 'and the README' },
    ]);
  });

  it('names what does not fit: the count, an option it lacks, two picks of one, a blank', () => {
    const card = ask();
    expect(card.answersProblem([{ picks: [0], other: null }])).toContain('2 answer(s), not 1');
    expect(
      card.answersProblem([
        { picks: [5], other: null },
        { picks: [0], other: null },
      ]),
    ).toBe('Question 1 has 2 options');
    expect(
      card.answersProblem([
        { picks: [0, 1], other: null },
        { picks: [0], other: null },
      ]),
    ).toBe('Question 1 takes one option');
    expect(
      card.answersProblem([
        { picks: [0], other: null },
        { picks: [], other: '   ' },
      ]),
    ).toBe('Question 2 is not answered');
    expect(() => card.answer('owner-1', NOW, [{ picks: [0], other: null }])).toThrow();
    expect(card.status).toBe('pending');
  });

  it('takes their own words alone as an answer', () => {
    const card = ask([REPO]);
    card.answer('owner-1', NOW, [{ picks: [], other: 'acme/docs' }]);
    expect(card.answers).toEqual([{ picks: [], other: 'acme/docs' }]);
  });

  it('is dismissed with their note and no answers', () => {
    const card = ask();
    card.dismiss('owner-1', NOW, '  not now ');
    expect(card).toMatchObject({ status: 'dismissed', note: 'not now', answers: null });
  });

  it('is decided once: a second answer, a dismissal or an expiry after it throws', () => {
    const card = ask([REPO]);
    card.answer('owner-1', NOW, [{ picks: [0], other: null }]);
    expect(() => card.dismiss('owner-1', NOW)).toThrow('already answered');
    expect(() => card.expire(NOW)).toThrow('already answered');
  });

  it('expires with nobody deciding, and remembers the status its next write is conditioned on', () => {
    const card = ask();
    card.expire(NOW);
    expect(card).toMatchObject({
      status: 'expired',
      decidedByUserId: null,
      statusAtLoad: 'pending',
    });
    card.markPersisted();
    expect(card.statusAtLoad).toBe('expired');
  });

  it('holds one to four questions', () => {
    expect(() => ask([])).toThrow();
    expect(() => ask([REPO, REPO, REPO, REPO, REPO])).toThrow();
  });
});
