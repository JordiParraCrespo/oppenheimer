import { afterEach, describe, expect, it, vi } from 'vitest';
import { initialDraft, rememberDraft } from '../lib/new-session-draft';
import { defaultModelFor } from '../lib/session-options';

/**
 * What New session remembers between visits. The rule that matters is the one
 * the security review asked for: a permission level is never restored, so
 * `full` cannot come back because it was used once. Scope never comes back
 * either, and anything in storage the catalog does not recognise is ignored.
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
      permission: 'ask',
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

  it('drops an effort that is no level, an agent it does not know, and the old single stop', () => {
    store({ effort: 'medium', efforts: { codex: 'infinite', 'gone-agent': 'high', grok: 'max' } });

    expect(initialDraft().efforts).toEqual({ grok: 'max' });
  });

  it('never restores a permission level or a scope, whatever storage holds', () => {
    store({ permission: 'full', scope: [{ id: 'inst:1', branch: 'main' }] });

    const draft = initialDraft();
    expect(draft.permission).toBe('ask');
    expect(draft.scope).toEqual([]);
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
