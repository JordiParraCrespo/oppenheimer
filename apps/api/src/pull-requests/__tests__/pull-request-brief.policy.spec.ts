import { describe, expect, it } from 'vitest';
import {
  briefFromDescription,
  briefRequest,
  imagesOf,
  parseModelBrief,
} from '../domain/pull-request-brief.policy';

const BODY = `<!-- What did you change? -->
## Summary

The wallet screen showed a **spinner** forever with no accounts. It now says so. More detail here.

- Adds an [empty state](https://example.com/x)
- [x] Reuses \`AddAccountSheet\`

## Screenshots

![Light](https://github.com/user-attachments/assets/a.png)
<img width="400" alt="Dark" src="https://github.com/user-attachments/assets/b.png">
![Light again](https://github.com/user-attachments/assets/a.png)
![Local](http://localhost:3000/c.png)

- not a point: a later list
`;

describe('the pull request brief', () => {
  it('reads the description’s pictures in the order written, each once, and only over https', () => {
    expect(imagesOf(BODY)).toEqual([
      { url: 'https://github.com/user-attachments/assets/a.png', alt: 'Light' },
      { url: 'https://github.com/user-attachments/assets/b.png', alt: 'Dark' },
    ]);
  });

  it('without a model, leads with the description’s first sentence and its first list', () => {
    expect(briefFromDescription('Fix the empty state', BODY)).toEqual({
      headline: 'The wallet screen showed a spinner forever with no accounts.',
      points: ['Adds an empty state', 'Reuses AddAccountSheet'],
      lookFirst: null,
    });
  });

  it('falls back on the title when the description says nothing', () => {
    expect(briefFromDescription('Bump react-native to 0.80', '<!-- template -->\n')).toEqual({
      headline: 'Bump react-native to 0.80',
      points: [],
      lookFirst: null,
    });
  });

  it('takes a model’s answer only as three plain fields, whatever surrounds them', () => {
    const answer =
      'Here you go:\n```json\n{"headline": "Empty wallets now **say so**.", "points": ["a", 7, "", "b", "c", "d", "e"], "lookFirst": null, "merge": true}\n```';
    expect(parseModelBrief(answer)).toEqual({
      headline: 'Empty wallets now say so.',
      points: ['a', 'b', 'c', 'd'],
      lookFirst: null,
    });
  });

  it('refuses an answer with no headline or that is not JSON, so the description stands in', () => {
    expect(parseModelBrief('{"points": ["a"]}')).toBeNull();
    expect(parseModelBrief('I cannot summarize this.')).toBeNull();
    expect(parseModelBrief('{"headline": ')).toBeNull();
  });

  it('caps what a request sends of a large diff, and never sends the template comment', () => {
    const patch = 'x'.repeat(10_000);
    const files = Array.from({ length: 80 }, (_, index) => ({
      path: `src/file-${index}.ts`,
      status: 'modified',
      additions: 1,
      deletions: 0,
      patch,
    }));
    const { messages } = briefRequest({ title: 'Big', body: BODY, files });
    const content = messages[0]?.content ?? '';
    expect(content.length).toBeLessThan(25_000);
    expect(content).toContain('…and 20 more files');
    expect(content).not.toContain('What did you change?');
  });

  it('reads a description built to make its patterns backtrack without stalling the process', () => {
    const hostile = [
      '![]('.repeat(16_000),
      '<'.repeat(64_000),
      '['.repeat(64_000),
      `- ${' '.repeat(64_000)}a\rb`,
      '<img'.repeat(16_000),
    ];
    const started = performance.now();
    for (const body of hostile) {
      imagesOf(body);
      briefFromDescription('A title', body);
      briefRequest({ title: 'A title', body, files: [] });
    }
    // Unbounded, these took seconds each; a slow machine still has a wide margin.
    expect(performance.now() - started).toBeLessThan(1_500);
  });
});
