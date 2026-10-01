import { afterEach, describe, expect, it, vi } from 'vitest';
import { initialDraft, rememberDraft } from '../lib/new-session-draft';
import { defaultModelFor } from '../lib/session-options';

/**
 * What New session remembers between visits. A permission level is never
 * restored: every visit opens on `full`, whatever the last one picked. Scope
 * never comes back either, and anything in storage the catalog does not
 * recognise is ignored.
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
      projectId: null,
      hostId: null,
      scope: [],
      agent: 'claude-code',
      model: defaultModelFor('claude-code'),
      permission: 'full',
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

  it.each(['ask', 'auto', 'full'])(
    'never restores a permission level or a scope, whatever storage holds (%s)',
    (permission) => {
      store({ permission, scope: [{ id: 'inst:1', branch: 'main' }] });

      const draft = initialDraft();
      expect(draft.permission).toBe('full');
      expect(draft.scope).toEqual([]);
    },
  );

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
  it('writes only the five choices worth carrying, and they read back', () => {
    rememberDraft({
      projectId: 'p1',
      hostId: 'h1',
      agent: 'codex',
      model: 'gpt-6-astra',
      efforts: { codex: 'low' },
      // A caller holding the whole draft passes it; the rest must not be written.
      ...({ permission: 'full', scope: [{ id: 'x', branch: 'y' }] } as object),
    });

    expect(Object.keys(JSON.parse(window.localStorage.getItem(KEY) ?? '{}')).sort()).toEqual([
      'agent',
      'efforts',
      'hostId',
      'model',
      'projectId',
    ]);
    expect(initialDraft()).toMatchObject({
      projectId: 'p1',
      agent: 'codex',
      efforts: { codex: 'low' },
    });
  });

  it('swallows a storage that refuses the write', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('quota', 'QuotaExceededError');
    });

    expect(() =>
      rememberDraft({
        projectId: null,
        hostId: null,
        agent: 'claude-code',
        model: null,
        efforts: {},
      }),
    ).not.toThrow();
  });
});
