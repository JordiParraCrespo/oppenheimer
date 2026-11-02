import { SessionChat as Chat } from '@oppenheimer/frontend-consumer';
import { act, cleanup, render } from '@testing-library/react';
import { afterEach, beforeAll, expect, it, vi } from 'vitest';
import { SessionChat } from '../sections/session-chat';

/**
 * The session chat's render budget on its one busy clock, the agent writing:
 * each line of the transcript redraws the turn it lands in, never the turns
 * above it. What breaks this: the list subscribing to the whole chat state
 * and mapping every drawn turn into a new element per line, so a long
 * conversation costs each line the forty turns on screen. Turns are counted
 * at `ChatTurn`, by the prompt that opens them.
 */

const renders = vi.hoisted(() => new Map<string, number>());

vi.mock('../components/chat-turn', () => ({
  ChatTurn: ({ turn }: { turn: { prompt: { text: string } | null } }) => {
    const name = turn.prompt?.text ?? '';
    renders.set(name, (renders.get(name) ?? 0) + 1);
    return <div>{name}</div>;
  },
}));

vi.mock('@oppenheimer/frontend-consumer/react', () => ({
  useVoiceDictation: () => ({ available: false, transcribe: vi.fn() }),
  usePasteSessionFile: () => ({ mutateAsync: vi.fn() }),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: 'en', resolvedLanguage: 'en' },
  }),
  initReactI18next: { type: '3rdParty', init: () => {} },
}));

beforeAll(() => {
  globalThis.ResizeObserver ??= class {
    observe() {}
    disconnect() {}
    unobserve() {}
  } as unknown as typeof ResizeObserver;
  Element.prototype.scrollTo ??= () => {};
});

afterEach(() => {
  cleanup();
  renders.clear();
});

let uuid = 0;
const entry = (value: object) => JSON.stringify({ uuid: `e${++uuid}`, ...value });
const prompt = (text: string) => entry({ type: 'user', message: { role: 'user', content: text } });
const call = (id: string) =>
  entry({
    type: 'assistant',
    message: { content: [{ type: 'tool_use', id, name: 'Read', input: { file_path: 'a.ts' } }] },
  });
const result = (id: string) =>
  entry({
    type: 'user',
    message: { role: 'user', content: [{ type: 'tool_result', tool_use_id: id, content: 'ok' }] },
  });
const reply = (text: string) =>
  entry({ type: 'assistant', message: { content: [{ type: 'text', text }] } });

it('redraws only the turn a line of the transcript lands in', () => {
  const chat = new Chat();
  render(<SessionChat chat={chat} agent="claude-code" readOnly />);
  const history = Array.from({ length: 10 }, (_, turn) => [
    prompt(`Turn ${turn}`),
    call(`t${turn}`),
    result(`t${turn}`),
    reply('Done.'),
  ]).flat();
  act(() => chat.apply({ reset: true, entries: [...history, prompt('Now')] }));
  renders.clear();

  const lines = [call('n1'), result('n1'), call('n2'), result('n2'), reply('Done.')];
  for (const line of lines) act(() => chat.apply({ entries: [line] }));

  expect(renders.get('Now')).toBe(lines.length);
  expect([...renders.keys()]).toEqual(['Now']);
});
