import { searchWords, snippetAround } from '../domain/bot-chat-search.policy';

/**
 * A `search_chat` hit is a window of the message around what was searched
 * for. What breaks this: a long message shown from its start when the match
 * is at its end, so the bot reads a page that does not hold what it asked
 * for; or the search syntax (quotes, `-`, `OR`) looked for as words.
 */
describe('searchWords', () => {
  it('drops the web-search syntax and keeps the words, lower-cased', () => {
    expect(searchWords('"Staging Deploy" -prod OR Friday')).toEqual([
      'staging',
      'deploy',
      'prod',
      'friday',
    ]);
  });
});

describe('snippetAround', () => {
  it('keeps a short message whole', () => {
    expect(snippetAround('Ship it  on\nFriday', ['friday'])).toBe('Ship it on Friday');
  });

  it('centres a long message on the first word it holds, marking both cuts', () => {
    const content = `${'a '.repeat(400)}the staging host is build-02 ${'b '.repeat(400)}`;
    const snippet = snippetAround(content, ['staging'], 100);
    expect(snippet).toContain('the staging host is build-02');
    expect(snippet.startsWith('…')).toBe(true);
    expect(snippet.endsWith('…')).toBe(true);
    expect(snippet.length).toBeLessThanOrEqual(102);
  });

  it('starts at the start when none of the words is there as typed', () => {
    const snippet = snippetAround(`deploys ${'x'.repeat(500)}`, ['deployment'], 50);
    expect(snippet.startsWith('deploys')).toBe(true);
  });
});
