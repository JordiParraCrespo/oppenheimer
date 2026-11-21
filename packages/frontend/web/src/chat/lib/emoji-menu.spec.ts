import { describe, expect, it } from 'vitest';
import { type EmojiRow, emojiQuery, insertEmoji, loadEmoji, matchingEmoji } from './emoji-menu';

/**
 * Which emoji a composer's `:` menu offers and what a pick writes. What breaks
 * this: a menu that opens on `10:30` or a URL, a tag match (`:hap` for 😀)
 * dropped, or a pick that eats the text after the caret.
 */
const row = (name: string, emoji: string, tags: string[] = []): EmojiRow => ({
  id: name,
  emoji,
  name,
  tags,
});

describe('emojiQuery', () => {
  it('reads a shortcode typed before the caret, wherever it sits in the line', () => {
    expect(emojiQuery(':hap', 4)).toEqual({ query: 'hap', start: 0 });
    expect(emojiQuery('so :Hap and more', 7)).toEqual({ query: 'hap', start: 3 });
  });

  it('opens nothing for a time, a URL, a single letter or a caret past the shortcode', () => {
    expect(emojiQuery('at 10:30', 8)).toBeNull();
    expect(emojiQuery('http://x', 8)).toBeNull();
    expect(emojiQuery('so :h', 5)).toBeNull();
    expect(emojiQuery(':hap more', 9)).toBeNull();
    expect(emojiQuery(':hap', null)).toBeNull();
  });
});

describe('matchingEmoji', () => {
  it('ranks a shortcode that starts with the query, then one containing it, then a tag', () => {
    const rows = [
      row('grinning', '😀', ['smile', 'happy']),
      row('unhappy', '☹️'),
      row('happy_cat', '😺'),
    ];
    expect(matchingEmoji(rows, 'happ').map((r) => r.name)).toEqual([
      'happy_cat',
      'unhappy',
      'grinning',
    ]);
  });
});

describe('insertEmoji', () => {
  it('puts the emoji and a space in the shortcode’s place, keeping what follows', () => {
    expect(insertEmoji('so :hap', { start: 3, caret: 7 }, '😀')).toEqual({
      text: 'so 😀 ',
      caret: 6,
    });
    expect(insertEmoji(':hap rest', { start: 0, caret: 4 }, '😀')).toEqual({
      text: '😀 rest',
      caret: 2,
    });
  });
});

describe('loadEmoji', () => {
  it('finds what Claude Code web offers for :hap, by GitHub shortcode and tag', async () => {
    const rows = await loadEmoji();
    expect(matchingEmoji(rows, 'hap').map((r) => `${r.emoji}:${r.name}`)).toEqual(
      expect.arrayContaining(['😀:grinning', '😃:smiley', '😄:smile', '😆:laughing']),
    );
  });
});
