import { afterEach, describe, expect, it, vi } from 'vitest';
import { rememberFolder } from '../lib/folder-memory';
import { initialDraft, onlyFields, openDraft, rememberDraft } from '../lib/new-session-draft';
import { defaultModelFor } from '../lib/session-options';

/**
 * What New session remembers between visits: every chip's last choice. The
 * permission level opens on `auto` and then on the last level picked, and
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
      cloudProvider: null,
      cloudModel: null,
      projectId: null,
      hostId: null,
      scope: [],
      folder: null,
      agent: 'claude-code',
      model: defaultModelFor('claude-code'),
      permission: 'auto',
      efforts: {},
      codexEnvironment: null,
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

  /**
   * Claude Code's cloud runs Claude Code, and the API refuses another agent
   * there. A draft that opened on it with Codex would fail only once sent.
   */
  it('opens a host’s cloud on Claude Code when the agent left runs in no vendor’s cloud', () => {
    store({ where: 'cloud', cloudProvider: null, agent: 'grok', model: 'grok-4.6' });

    expect(initialDraft()).toMatchObject({
      where: 'cloud',
      agent: 'claude-code',
      model: defaultModelFor('claude-code'),
    });
  });

  it('reopens Codex’s cloud on Codex', () => {
    store({ where: 'cloud', cloudProvider: null, agent: 'codex', model: 'gpt-6-astra' });

    expect(initialDraft()).toMatchObject({ where: 'cloud', agent: 'codex', model: 'gpt-6-astra' });
  });

  it('lets an address naming another agent win over a remembered host cloud', () => {
    store({ where: 'cloud', cloudProvider: null, agent: 'claude-code' });

    expect(initialDraft({ agent: 'grok' })).toMatchObject({ where: 'worktree', agent: 'grok' });
  });

  it('keeps each known agent’s pick as left, and drops the old single stop', () => {
    // Whether a pick is one of the model's levels is decided when the slider
    // is drawn, not when storage is read.
    store({ effort: 'medium', efforts: { codex: 'infinite', 'gone-agent': 'high', grok: 7 } });

    expect(initialDraft().efforts).toEqual({ codex: 'infinite' });
  });

  it.each(['ask', 'auto', 'full'] as const)(
    'restores the last permission level picked (%s)',
    (permission) => {
      store({ permission });

      expect(initialDraft().permission).toBe(permission);
    },
  );

  it('restores the last repository and branch, dropping entries of another shape', () => {
    store({ scope: [{ id: 'inst:1', branch: 'main' }, { id: 7 }, 'inst:2'] });

    expect(initialDraft().scope).toEqual([{ id: 'inst:1', branch: 'main' }]);
  });

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
  it('writes every chip but the folder, and they read back', () => {
    rememberDraft({
      where: 'folder',
      cloudProvider: 'cursor',
      cloudModel: 'grok-4.7',
      projectId: 'p1',
      hostId: 'h1',
      scope: [{ id: 'x', branch: 'y' }],
      agent: 'codex',
      model: 'gpt-6-astra',
      permission: 'ask',
      efforts: { codex: 'low' },
      codexEnvironment: { hostId: 'h1', id: 'e_1', label: 'Web' },
      // A caller holding the whole draft passes it; the folder must not be
      // written: it is remembered per host, on its own.
      ...({ folder: '/tmp' } as object),
    });

    expect(Object.keys(JSON.parse(window.localStorage.getItem(KEY) ?? '{}')).sort()).toEqual([
      'agent',
      'cloudModel',
      'cloudProvider',
      'codexEnvironment',
      'efforts',
      'hostId',
      'model',
      'permission',
      'projectId',
      'scope',
      'where',
    ]);
    expect(initialDraft()).toMatchObject({
      where: 'folder',
      cloudModel: 'grok-4.7',
      projectId: 'p1',
      scope: [{ id: 'x', branch: 'y' }],
      agent: 'codex',
      permission: 'ask',
      efforts: { codex: 'low' },
      codexEnvironment: { hostId: 'h1', id: 'e_1', label: 'Web' },
    });
  });

  it('reads a remembered vendor back only beside the cloud, so a host place stays a host’s', () => {
    store({ where: 'cloud', cloudProvider: 'cursor' });
    expect(initialDraft().cloudProvider).toBe('cursor');

    store({ where: 'worktree', cloudProvider: 'cursor' });
    expect(initialDraft().cloudProvider).toBeNull();
  });

  it('swallows a storage that refuses the write', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('quota', 'QuotaExceededError');
    });

    expect(() =>
      rememberDraft({
        where: 'worktree',
        cloudProvider: 'cursor',
        cloudModel: null,
        projectId: null,
        hostId: null,
        scope: [],
        agent: 'claude-code',
        model: null,
        permission: 'auto',
        efforts: {},
        codexEnvironment: null,
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

/**
 * The project a visit lands on fills only the chips the last visit left empty;
 * the last choice outranks its defaults. Decided once, as the draft opens.
 */
describe('the chips the landing project may fill', () => {
  it('keeps every remembered chip over the project default', () => {
    store({ hostId: 'h1', scope: [{ id: 'inst:1', branch: 'main' }], agent: 'claude-code' });

    expect(openDraft().fillable).toEqual([]);
  });

  it('lets the project fill every chip when nothing is remembered', () => {
    expect(openDraft().fillable).toEqual(['hostId', 'scope', 'agent', 'model']);
  });

  it('lets the project fill an empty remembered scope', () => {
    store({ hostId: 'h1', scope: [], agent: 'claude-code' });

    expect(openDraft().fillable).toEqual(['scope']);
  });

  it('keeps a project default to the chips named', () => {
    const defaults = {
      hostId: 'h-project',
      scope: [{ id: 'inst:9', branch: 'develop' }],
      agent: 'codex' as const,
    };

    expect(onlyFields(defaults, ['scope', 'model'])).toEqual({ scope: defaults.scope });
  });
});
