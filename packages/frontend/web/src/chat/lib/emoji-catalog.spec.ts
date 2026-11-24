import { describe, expect, it } from 'vitest';
import { type EmojiGroup, searchEmoji } from './emoji-catalog';

const groups: EmojiGroup[] = [
  {
    id: 'smileys',
    emoji: [
      { emoji: '😂', name: 'joy', words: ['joy', 'tears', 'laugh'] },
      { emoji: '😹', name: 'joy_cat', words: ['joy_cat'] },
    ],
  },
  {
    id: 'people',
    emoji: [{ emoji: '👍', name: '+1', words: ['+1', 'thumbsup', 'thumbs_up', 'approve'] }],
  },
];

/**
 * The picker's search. Breaks if a word that only holds the query outranks
 * one that starts with it, or if "thumbs up" typed with a space finds nothing.
 */
describe('searchEmoji', () => {
  it('lists what starts with the words before what only holds them', () => {
    expect(searchEmoji(groups, 'cat').map((entry) => entry.emoji)).toEqual(['😹']);
    expect(searchEmoji(groups, 'joy').map((entry) => entry.emoji)).toEqual(['😂', '😹']);
    expect(searchEmoji(groups, 'augh').map((entry) => entry.emoji)).toEqual(['😂']);
  });

  it('reads a space as the underscore a shortcode has, ignoring case', () => {
    expect(searchEmoji(groups, 'Thumbs Up').map((entry) => entry.emoji)).toEqual(['👍']);
  });

  it('finds nothing for nothing typed', () => {
    expect(searchEmoji(groups, '  ')).toEqual([]);
  });
});
