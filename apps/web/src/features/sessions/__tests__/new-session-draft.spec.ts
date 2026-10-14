import { afterEach, describe, expect, it, vi } from 'vitest';
import { rememberFolder } from '../lib/folder-memory';
import { initialDraft, rememberDraft } from '../lib/new-session-draft';
import { defaultModelFor } from '../lib/session-options';

/**
 * What New session remembers between visits. The permission level opens on
 * `auto` and then on the last level picked. Scope never comes back, and
 * anything in storage the catalog does not recognise is ignored.
 */

const KEY = 'oppenheimer.new-session.draft';

const store = (value: unknown) =>
  window.localStorage.setItem(KEY, typeof value === 'string' ? value : JSON.stringify(value));

afterEach(() => {
  window.localStorage.clear();
  vi.restoreAllMocks();
});

describe('initialDraft', () => {
  it('opens on the fallback with nothing remembered', () => {
    expect(initialDraft()).toEqual({
      where: 'worktree',
      projectId: null,
      hostId: null,
      scope: [],
      folder: null,
      agent: 'claude-code',
      model: defaultModelFor('claude-code'),
      permission: 'auto',
      efforts: {},
    });
  });

  it('restores the project, host, agent, model and each agent’s effort', () => {
    store({
      projectId: 'p1',
      hostId: 'h1',
      agent: 'codex',
      model: 'gpt-6-astra',
      efforts: { codex: 'ultra', 'claude-code': 'xhigh' },
    });

    expect(initialDraft()).toMatchObject({
      projectId: 'p1',
      hostId: 'h1',
      agent: 'codex',
      model: 'gpt-6-astra',
      efforts: { codex: 'ultra', 'claude-code': 'xhigh' },
    });
  });

  it('keeps each known agent’s pick as left, and drops the old single stop', () => {
    // Whether a pick is one of the model's levels is decided when the slider
    // is drawn, not when storage is read.
    store({ effort: 'medium', efforts: { codex: 'infinite', 'gone-agent': 'high', grok: 7 } });

    expect(initialDraft().efforts).toEqual({ codex: 'infinite' });
  });

  it.each(['ask', 'auto', 'full'] as const)(
    'restores the last permission level picked, never a scope (%s)',
    (permission) => {
      store({ permission, scope: [{ id: 'inst:1', branch: 'main' }] });

      const draft = initialDraft();
      expect(draft.permission).toBe(permission);
      expect(draft.scope).toEqual([]);
    },
  );

  it('opens on auto when storage holds a level the catalog does not have', () => {
    store({ permission: 'yolo' });

    expect(initialDraft().permission).toBe('auto');
  });

  it("drops a model that is not the remembered agent's, taking that agent's default", () => {
    store({ agent: 'codex', model: 'claude-opus-5-5' });

    expect(initialDraft()).toMatchObject({ agent: 'codex', model: defaultModelFor('codex') });
  });

  it('ignores an agent the catalog does not have, and the model with it', () => {
    store({ agent: 'gone-agent', model: 'gpt-6-astra' });

    expect(initialDraft()).toMatchObject({
      agent: 'claude-code',
      model: defaultModelFor('claude-code'),
    });
  });

  it('opens on the fallback when storage holds something unreadable', () => {
    store('{not json');

    expect(initialDraft().agent).toBe('claude-code');
  });
});

describe('rememberDraft', () => {
  it('writes only the seven choices worth carrying, and they read back', () => {
    rememberDraft({
      where: 'folder',
      projectId: 'p1',
      hostId: 'h1',
      agent: 'codex',
      model: 'gpt-6-astra',
      permission: 'ask',
      efforts: { codex: 'low' },
      // A caller holding the whole draft passes it; the scope and the folder
      // must not be written: the folder is remembered per host, on its own.
      ...({ scope: [{ id: 'x', branch: 'y' }], folder: '/tmp' } as object),
    });

    expect(Object.keys(JSON.parse(window.localStorage.getItem(KEY) ?? '{}')).sort()).toEqual([
      'agent',
      'efforts',
      'hostId',
      'model',
      'permission',
      'projectId',
      'where',
    ]);
    expect(initialDraft()).toMatchObject({
      where: 'folder',
      projectId: 'p1',
      agent: 'codex',
      permission: 'ask',
      efforts: { codex: 'low' },
    });
  });

  it('swallows a storage that refuses the write', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('quota', 'QuotaExceededError');
    });

    expect(() =>
      rememberDraft({
        where: 'worktree',
        projectId: null,
        hostId: null,
        agent: 'claude-code',
        model: null,
        permission: 'auto',
        efforts: {},
      }),
    ).not.toThrow();
  });
});

/**
 * Where a session runs is remembered like the other chips, and a folder is
 * remembered per host: a path on one machine means nothing on another.
 */
describe('where and the folder', () => {
  it('drops a place the catalog does not have', () => {
    store({ where: 'container' });

    expect(initialDraft().where).toBe('worktree');
  });

  it("opens on the remembered host's last folder", () => {
    store({ where: 'folder', hostId: 'h1' });
    rememberFolder('h1', { path: '/home/jordi/code/atlas', home: '/home/jordi' });
    rememberFolder('h2', { path: '/srv/app', home: '/root' });

    expect(initialDraft()).toMatchObject({
      where: 'folder',
      hostId: 'h1',
      folder: '/home/jordi/code/atlas',
    });
  });

  /**
   * Settings' Open terminal: `?where=folder&host=…&path=~&agent=shell`. A path
   * under `~` waits for the host's home rather than opening on the last folder.
   */
  it('takes the place, host and agent an address names, and no folder for a path under ~', () => {
    store({ where: 'worktree', hostId: 'h1', agent: 'codex', model: 'gpt-6-astra' });
    rememberFolder('h2', { path: '/srv/app', home: '/root' });

    expect(
      initialDraft({ where: 'folder', hostId: 'h2', agent: 'shell', path: '~' }),
    ).toMatchObject({
      where: 'folder',
      hostId: 'h2',
      agent: 'shell',
      model: defaultModelFor('shell'),
      folder: null,
    });
  });

  it('opens on an absolute path the address names', () => {
    expect(initialDraft({ where: 'folder', path: '/srv/app' }).folder).toBe('/srv/app');
  });
});
