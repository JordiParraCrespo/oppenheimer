import { describe, expect, it } from 'vitest';
import { turnReach } from '../domain/bot-turn-reach.policy';

/**
 * What a turn may reach beyond its conversation, by who it answers: the
 * owner's turns reach what the bot can; a contact's, in a person's chat or
 * a group's, nothing of the owner's.
 */
describe('turnReach', () => {
  // What breaks this: someone the owner allowed on their number driving the
  // owner's tools or reading their memory, or the owner's own turns losing them.
  it('gives a contact’s turn nothing of the owner’s, and the owner’s turns all of it', () => {
    const none = {
      tools: false,
      ownerMemory: false,
      skills: false,
      history: 'contacts',
    };
    expect(turnReach({ contact: 'group' })).toEqual({ ...none, contact: 'group' });
    expect(turnReach({ contact: 'direct' })).toEqual({ ...none, contact: 'direct' });
    expect(turnReach({ contact: null })).toEqual({
      tools: true,
      ownerMemory: true,
      skills: true,
      history: 'all',
      contact: null,
    });
  });
});
