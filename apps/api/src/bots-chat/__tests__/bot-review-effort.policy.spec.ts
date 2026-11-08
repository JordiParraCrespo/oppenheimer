import { reviewEffort } from '../domain/bot-review-effort.policy';

/**
 * The effort the goal and rule reviewers run at: the lowest a model offers,
 * or none when it offers no levels.
 */
// What breaks this: a reviewer sent no effort, which a model with levels reads
// as its default (often high), so every verdict cost a full reasoning pass.
describe('reviewEffort', () => {
  it('asks a model that offers levels for low, and one that offers none for nothing', () => {
    expect(reviewEffort({ provider: 'glm', model: 'glm-5.3' })).toBe('low');
    expect(reviewEffort({ provider: 'xai', model: 'grok-4.7' })).toBe('low');
    expect(reviewEffort({ provider: 'xai', model: 'grok-build-0.1' })).toBeNull();
  });
});
