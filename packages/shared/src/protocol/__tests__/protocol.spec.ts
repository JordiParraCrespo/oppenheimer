import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { HINT_KINDS } from '../hint';
import { toProtocolJsonSchema } from '../json-schema';
import {
  PROTOCOL_MAX_EVENT_PAYLOAD_BYTES,
  PROTOCOL_MESSAGE_TYPES,
  type ProtocolMessage,
  type ProtocolMessageType,
  protocolMessageSchema,
} from '../messages';
import { PROTOCOL_VERSION } from '../version';

const sessionId = '3f0d9e2c-6a4b-4e9a-9c3d-7b1e5a2f8c40';
const checkoutId = 'a1f2c3d4-5e6f-4a7b-8c9d-0e1f2a3b4c5d';
const commandId = 'b2c3d4e5-6f7a-4b8c-9d0e-1f2a3b4c5d6e';
const occurredAt = '2026-09-19T10:00:00Z';

const snapshot = {
  sessionId,
  agent: 'claude-code',
  observed: 'working',
  stateSeconds: 12,
  windows: [{ index: 0, name: 'agent' }],
  agentSessionId: 'conv-1',
  reportHash: null,
  loginUrl: null,
};

/**
 * One sample per message type. The record is keyed by the union's own type list,
 * so a message added to the protocol without a sample here fails to compile.
 */
const SAMPLES: Record<ProtocolMessageType, ProtocolMessage> = {
  hello: {
    type: 'hello',
    runnerVersion: '0.4.1',
    protocol: { min: 1, max: 1 },
    runId: 'run-7f3a',
    host: {
      hostname: 'jordis-mbp',
      os: 'darwin',
      arch: 'arm64',
      tools: { git: '2.45.0', tmux: '3.5a', claude: null },
      agents: [{ id: 'claude-code', version: '2.1.144' }],
    },
    sessions: [snapshot],
  },
  heartbeat: {
    type: 'heartbeat',
    sentAt: occurredAt,
    runnerVersion: '0.4.1',
    channel: 'stable',
    load: { loadAverage1m: 1.25, workspacesFreeBytes: 120_000_000_000 },
    tools: { git: '2.45.0', tmux: '3.5a' },
    sessions: [snapshot],
  },
  hint: { type: 'hint', kind: 'update_required', detail: 'below min_supported' },
  'events.append': {
    type: 'events.append',
    sessionId,
    events: [
      { idempotencyKey: 'run-7f3a:1', kind: 'session.started', payload: {}, occurredAt },
      {
        idempotencyKey: 'run-7f3a:2',
        kind: 'prompt.first',
        payload: { text: 'fix the repo picker' },
        occurredAt,
      },
    ],
  },
  'session.create': {
    type: 'session.create',
    commandId,
    sessionId,
    organizationSlug: 'jordi',
    projectSlug: 'xrp-mobile',
    sessionSlug: 'bold-otter-3f9a7k',
    agent: 'claude-code',
    branch: 'oppenheimer/xrp-mobile/bold-otter-3f9a7k',
    checkouts: [
      {
        checkoutId,
        githubRepoId: 42,
        repositoryFullName: 'acme/xrp-mobile',
        directoryName: 'xrp-mobile',
        baseBranch: 'main',
      },
    ],
    cwdCheckoutId: checkoutId,
  },
  'session.attach': {
    type: 'session.attach',
    commandId,
    sessionId,
    window: 0,
    attachmentId: 7,
    cols: 120,
    rows: 40,
  },
  'session.input': {
    type: 'session.input',
    commandId,
    sessionId,
    window: 0,
    data: 'Zml4IHRoZSBwaWNrZXIK',
  },
  'session.resize': {
    type: 'session.resize',
    commandId,
    sessionId,
    attachmentId: 7,
    cols: 100,
    rows: 30,
  },
  'session.window.open': { type: 'session.window.open', commandId, sessionId, name: 'tests' },
  'session.window.close': { type: 'session.window.close', commandId, sessionId, window: 1 },
  'session.close': { type: 'session.close', commandId, sessionId, acceptUnpushedWork: false },
  'session.restart': { type: 'session.restart', commandId, sessionId },
  'host.preflight': { type: 'host.preflight', commandId },
  'host.update': { type: 'host.update', commandId, version: '0.5.0', channel: 'stable' },
  'credentials.token': {
    type: 'credentials.token',
    requestId: commandId,
    sessionId,
    checkoutId,
    githubRepoId: 42,
  },
  'credentials.revoke': {
    type: 'credentials.revoke',
    requestId: commandId,
    sessionId,
    checkoutId,
  },
};

describe('protocol message union', () => {
  it('covers every type the link carries, and nothing else', () => {
    expect(new Set(PROTOCOL_MESSAGE_TYPES).size).toBe(PROTOCOL_MESSAGE_TYPES.length);
    expect(Object.keys(SAMPLES).sort()).toEqual([...PROTOCOL_MESSAGE_TYPES].sort());
  });

  it('round-trips a message of every type', () => {
    for (const type of PROTOCOL_MESSAGE_TYPES) {
      const encoded = JSON.stringify(SAMPLES[type]);
      const parsed = protocolMessageSchema.parse(JSON.parse(encoded));
      expect(parsed.type).toBe(type);
    }
  });

  it('discriminates on `type` rather than guessing', () => {
    expect(protocolMessageSchema.safeParse({ ...SAMPLES.hello, type: 'nope' }).success).toBe(false);
    const { type: _type, ...withoutType } = SAMPLES.heartbeat;
    expect(protocolMessageSchema.safeParse(withoutType).success).toBe(false);
  });

  it('refuses a command with a session id that is not a uuid', () => {
    expect(
      protocolMessageSchema.safeParse({ ...SAMPLES['session.restart'], sessionId: 'session-1' })
        .success,
    ).toBe(false);
  });

  it('defaults `acceptUnpushedWork` to false, so a close never silently discards work', () => {
    const parsed = protocolMessageSchema.parse({ type: 'session.close', commandId, sessionId });
    expect(parsed).toMatchObject({ acceptUnpushedWork: false });
  });

  it('answers a credentials request on the same type, with the grant sealed to the host', () => {
    const parsed = protocolMessageSchema.parse({
      ...SAMPLES['credentials.token'],
      grant: { sealed: 'c2VhbGVkLXRva2Vu', expiresAt: occurredAt },
    });
    expect(parsed).toMatchObject({ type: 'credentials.token' });
  });

  it('keeps the hint vocabulary closed', () => {
    for (const kind of HINT_KINDS) {
      expect(protocolMessageSchema.safeParse({ type: 'hint', kind }).success).toBe(true);
    }
    expect(protocolMessageSchema.safeParse({ type: 'hint', kind: 'offline' }).success).toBe(false);
  });
});

describe('events.append', () => {
  const base = SAMPLES['events.append'];

  it('requires the `<runId>:<n>` idempotency key the runner owns', () => {
    for (const idempotencyKey of ['run-7f3a', ':1', 'run 7f3a:1', 'run-7f3a:x']) {
      expect(
        protocolMessageSchema.safeParse({
          ...base,
          events: [{ idempotencyKey, kind: 'k', payload: {}, occurredAt }],
        }).success,
      ).toBe(false);
    }
  });

  it('carries no `seq`: the control plane assigns it under a row lock', () => {
    const parsed = protocolMessageSchema.parse(base);
    expect(parsed).toMatchObject({ type: 'events.append' });
    if (parsed.type === 'events.append') {
      expect(parsed.events[0]).not.toHaveProperty('seq');
    }
  });

  it('refuses an empty batch', () => {
    expect(protocolMessageSchema.safeParse({ ...base, events: [] }).success).toBe(false);
  });

  it('caps a payload at 8 KB, because it never carries pane text', () => {
    const tooBig = { text: 'x'.repeat(PROTOCOL_MAX_EVENT_PAYLOAD_BYTES) };
    expect(
      protocolMessageSchema.safeParse({
        ...base,
        events: [{ idempotencyKey: 'run:1', kind: 'k', payload: tooBig, occurredAt }],
      }).success,
    ).toBe(false);

    const fits = { text: 'x'.repeat(100) };
    expect(
      protocolMessageSchema.safeParse({
        ...base,
        events: [{ idempotencyKey: 'run:1', kind: 'k', payload: fits, occurredAt }],
      }).success,
    ).toBe(true);
  });
});

describe('emitted JSON Schema', () => {
  const emitted = toProtocolJsonSchema();

  it('describes one branch per message type', () => {
    const branches = emitted.anyOf as { properties: { type: { const: string } } }[];
    expect(branches.map((branch) => branch.properties.type.const).sort()).toEqual(
      [...PROTOCOL_MESSAGE_TYPES].sort(),
    );
  });

  it('is versioned by the protocol, not by the package', () => {
    expect(emitted.$id).toContain(`/v${PROTOCOL_VERSION}/`);
  });

  it('matches the committed artifact — a wire change is a reviewable diff', () => {
    const committed = JSON.parse(
      readFileSync(join(__dirname, '..', '..', '..', 'protocol-schema', 'protocol.schema.json'), {
        encoding: 'utf8',
      }),
    );
    expect(committed).toEqual(emitted);
  });
});
