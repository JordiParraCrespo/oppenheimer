import type { ChatStep, ChatTurn as Turn } from '@oppenheimer/frontend-consumer';
import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ChatTurn } from '../components/chat-turn';
import { findInChat, findRangesIn } from '../lib/chat-find';

/**
 * The find reads a turn's words twice: `findInChat` counts them off the
 * transcript (the reply's markdown as `markdownText` reads it), and
 * `findRangesIn` finds them in what the turn drew, to paint and land on.
 * Each hit is the nth range of its turn, so the two must agree, match for
 * match. What breaks this: the renderer learning a token or a piece of
 * chrome (a band, a label, a trail) that one side reads and the other does
 * not, which lands the bar on the wrong words or on none. Every markdown
 * construct the chat draws is here, drawn by the real `ChatTurn`.
 */

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: 'en', resolvedLanguage: 'en' },
  }),
  initReactI18next: { type: '3rdParty', init: () => {} },
}));

afterEach(cleanup);

const REPLY = [
  '# Release notes for the build',
  '',
  'The **build** passed, _the_ `build.ts` script ran, and [the build log](https://ci.example/build) is up.',
  'A soft line break inside the build paragraph.',
  '',
  '- one build item',
  '- [x] a build task, done',
  '  1. a nested build step',
  '',
  '> a quoted build note',
  '',
  '| build | result |',
  '| --- | --- |',
  '| build one | ok |',
  '',
  '```ts',
  'const build = run("build");',
  '```',
  '',
  '```',
  'plain text build output',
  '```',
  '',
  '<details><summary>Build logs</summary>',
  '',
  'the hidden build log',
  '',
  '</details>',
  '',
  'Escaped \\*build\\*, an entity &amp; build, <b>bold build</b>, H<sub>2</sub>O, <kbd>build</kbd>.',
  '',
  '---',
  '',
  'İstanbul build, last.',
].join('\n');

const QUERIES = [
  'build',
  'BUILD',
  'the build',
  'build log',
  'build.ts',
  'ts',
  'text',
  'ok',
  'logs',
  '& build',
  'h2o',
  'paragraph.\na',
  'item a build',
  'release notes',
  'i̇stanbul',
  'istanbul',
];

const reply = (id: string, text: string): ChatStep => ({
  kind: 'reply',
  id,
  at: null,
  text,
  truncated: false,
});

const turn: Turn = {
  id: 't1',
  prompt: { id: 'p', text: 'Write the build notes', files: 0, images: [], at: null },
  steps: [reply('r1', REPLY), reply('r2', 'Done with the build.')],
  model: null,
  contextTokens: null,
  startedAt: null,
  lastAt: null,
  working: false,
};

describe('the find reads what the turn draws', () => {
  it.each(QUERIES)('counts %j as many times as it finds it drawn', (query) => {
    const { container } = render(<ChatTurn turn={turn} found />);
    const needle = query.trim().toLocaleLowerCase();
    const drawn = [...container.querySelectorAll('[data-chat-find]')].flatMap((words) =>
      findRangesIn(words, needle),
    );
    expect(drawn).toHaveLength(findInChat([turn], query).length);
  });
});
