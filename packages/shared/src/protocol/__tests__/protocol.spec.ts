import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { attachTicketHintSchema, HINT_KINDS } from '../hint';
import { toProtocolJsonSchema } from '../json-schema';
import {
  PROTOCOL_MAX_EVENT_PAYLOAD_BYTES,
  PROTOCOL_MESSAGE_TYPES,
  type ProtocolMessage,
  type ProtocolMessageType,
  protocolMessageSchema,
} from '../messages';
import { sessionSnapshotSchema } from '../primitives';
import { PROTOCOL_VERSION } from '../version';

const sessionId = '3f0d9e2c-6a4b-4e9a-9c3d-7b1e5a2f8c40';
const checkoutId = 'a1f2c3d4-5e6f-4a7b-8c9d-0e1f2a3b4c5d';
const commandId = 'b2c3d4e5-6f7a-4b8c-9d0e-1f2a3b4c5d6e';
const occurredAt = '2026-09-19T10:00:00Z';

/** `apps/runner/internal/host/domain/facts.go`, marshalled. */
const hostFacts = {
  platform: 'macos' as const,
  osVersion: '15.3.1',
  arch: 'arm64',
  hostname: 'jordis-mbp',
  user: 'jordi',
  home: '/Users/jordi',
  root: false,
  tools: [
    { name: 'git', path: '/usr/bin/git', version: '2.45.0', required: true },
    { name: 'tmux', path: '/opt/homebrew/bin/tmux', version: '3.5a', required: true },
    { name: 'claude', required: false },
  ],
  workspacePath: '/Users/jordi/oppenheimer-ai',
  diskFreeBytes: 120_000_000_000,
  runnerVersion: '0.4.1',
};

const snapshot = {
  sessionId,
  agent: 'claude-code',
  observed: 'working',
  stateSeconds: 12,
  windows: [{ index: 0, name: 'agent' }],
  agentSessionId: 'conv-1',
  reportHash: null,
  loginUrl: 'https://claude.ai/oauth/authorize?code=true',
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
    host: hostFacts,
    sessions: [snapshot],
  },
  heartbeat: {
    type: 'heartbeat',
    sentAt: occurredAt,
    channel: 'stable',
    host: hostFacts,
    load: { loadAverage1m: 1.25 },
    sessions: [snapshot],
  },
  hint: { type: 'hint', kind: 'update_required', detail: 'below min_supported' },
  welcome: {
    type: 'welcome',
    protocol: 1,
    keyFingerprint: 'a'.repeat(64),
    hostId: '4a2f0c9e-5b1d-4a7c-9e3f-2b8d6c1a0f47',
  },
  'command.failed': { type: 'command.failed', commandId, code: 'SESS_003', detail: 'stopped' },
  'session.detach': { type: 'session.detach', commandId, sessionId, attachmentId: 7 },
  'attachment.closed': { type: 'attachment.closed', attachmentId: 7, reason: 'pty closed' },
  'events.append': {
    type: 'events.append',
    batchId: 'run-7f3a-b12',
    sessionId,
    events: [
      { idempotencyKey: 'run-7f3a:1', kind: 'session.started', payload: '{}', occurredAt },
      {
        idempotencyKey: 'run-7f3a:2',
        kind: 'prompt.first',
        payload: '{"text":"fix the repo picker"}',
        occurredAt,
      },
    ],
  },
  'events.ack': {
    type: 'events.ack',
    batchId: 'run-7f3a-b12',
    accepted: ['run-7f3a:1', 'run-7f3a:2'],
  },
  'attachment.credit': { type: 'attachment.credit', attachmentId: 7, bytes: 262_144 },
  'session.create': {
    type: 'session.create',
    commandId,
    sessionId,
    organizationSlug: 'jordi',
    projectSlug: 'xrp-mobile',
    sessionSlug: 'bold-otter-3f9a7k',
    agent: 'claude-code',
    launch: { model: 'opus', permission: 'ask', effort: 'medium' },
    prompt: 'Fix the wallet list empty state',
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
  'session.stop': { type: 'session.stop', commandId, sessionId },
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
  'credentials.grant': {
    type: 'credentials.grant',
    requestId: commandId,
    sessionId,
    checkoutId,
    sealed: 'c2VhbGVkLXRva2Vu',
    expiresAt: occurredAt,
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

  it('answers a credentials request with its own type, both fields required', () => {
    const grant = SAMPLES['credentials.grant'];
    expect(protocolMessageSchema.parse(grant)).toMatchObject({ type: 'credentials.grant' });

    for (const missing of ['sealed', 'expiresAt'] as const) {
      const { [missing]: _dropped, ...partial } = grant as Record<string, unknown>;
      expect(protocolMessageSchema.safeParse(partial).success).toBe(false);
    }
  });

  it('refuses a grant smuggled onto the ask', () => {
    const withGrant = { ...SAMPLES['credentials.token'], sealed: 'c2VhbGVk' };
    const parsed = protocolMessageSchema.parse(withGrant);
    expect(parsed).not.toHaveProperty('sealed');
  });

  it('keeps the hint vocabulary closed', () => {
    for (const kind of HINT_KINDS) {
      expect(protocolMessageSchema.safeParse({ type: 'hint', kind }).success).toBe(true);
    }
    expect(protocolMessageSchema.safeParse({ type: 'hint', kind: 'offline' }).success).toBe(false);
  });

  it('keeps `host_offline` off the link — a runner cannot report itself offline', () => {
    expect(protocolMessageSchema.safeParse({ type: 'hint', kind: 'host_offline' }).success).toBe(
      false,
    );
    expect(attachTicketHintSchema.safeParse({ kind: 'host_offline' }).success).toBe(true);
    for (const kind of HINT_KINDS) {
      expect(attachTicketHintSchema.safeParse({ kind }).success).toBe(true);
    }
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
    const over = 'x'.repeat(PROTOCOL_MAX_EVENT_PAYLOAD_BYTES + 1);
    expect(
      protocolMessageSchema.safeParse({
        ...base,
        events: [{ idempotencyKey: 'run:1', kind: 'k', payload: over, occurredAt }],
      }).success,
    ).toBe(false);

    const exact = 'x'.repeat(PROTOCOL_MAX_EVENT_PAYLOAD_BYTES);
    expect(
      protocolMessageSchema.safeParse({
        ...base,
        events: [{ idempotencyKey: 'run:1', kind: 'k', payload: exact, occurredAt }],
      }).success,
    ).toBe(true);
  });

  it('carries the payload as a string, so the cap survives emission to JSON Schema', () => {
    expect(
      protocolMessageSchema.safeParse({
        ...base,
        events: [{ idempotencyKey: 'run:1', kind: 'k', payload: { a: 1 }, occurredAt }],
      }).success,
    ).toBe(false);
  });
});

describe('host facts on the link', () => {
  it('carries the runner’s Facts struct in hello, tools and all', () => {
    const parsed = protocolMessageSchema.parse(SAMPLES.hello);
    expect(parsed).toMatchObject({ type: 'hello' });
    if (parsed.type === 'hello') {
      expect(parsed.host.platform).toBe('macos');
      expect(parsed.host.tools.map((tool) => tool.name)).toEqual(['git', 'tmux', 'claude']);
      expect(parsed.host.workspacePath).toBe('/Users/jordi/oppenheimer-ai');
    }
  });

  it('refuses the invented facts shape in hello', () => {
    expect(
      protocolMessageSchema.safeParse({
        ...SAMPLES.hello,
        host: { hostname: 'h', os: 'darwin', arch: 'arm64', tools: {}, agents: [] },
      }).success,
    ).toBe(false);
  });

  it('sends the same Facts on the heartbeat, not a thinner variant', () => {
    const parsed = protocolMessageSchema.parse(SAMPLES.heartbeat);
    if (parsed.type === 'heartbeat') {
      expect(parsed.host).toEqual(hostFacts);
      expect(parsed.host.tools[0]).toEqual({
        name: 'git',
        path: '/usr/bin/git',
        version: '2.45.0',
        required: true,
      });
      // The three fields the heartbeat used to duplicate now live on `host`.
      expect(parsed).not.toHaveProperty('tools');
      expect(parsed).not.toHaveProperty('runnerVersion');
      expect(parsed.load).not.toHaveProperty('workspacesFreeBytes');
    }
  });

  it('refuses the old version-map tools on the heartbeat', () => {
    expect(
      protocolMessageSchema.safeParse({ ...SAMPLES.heartbeat, host: { tools: { git: '2.45.0' } } })
        .success,
    ).toBe(false);
  });

  it('carries no agents key anywhere — an agent is a probed tool', () => {
    for (const type of ['hello', 'heartbeat'] as const) {
      expect(JSON.stringify(SAMPLES[type])).not.toContain('"agents"');
    }
  });

  it('normalises a nil Go tools slice to an empty array', () => {
    const parsed = protocolMessageSchema.parse({
      ...SAMPLES.hello,
      host: { ...hostFacts, tools: null },
    });
    if (parsed.type === 'hello') expect(parsed.host.tools).toEqual([]);
  });
});

describe('flow control', () => {
  it('replenishes one attachment by a positive byte delta', () => {
    expect(
      protocolMessageSchema.parse({ type: 'attachment.credit', attachmentId: 0, bytes: 1 }),
    ).toEqual({ type: 'attachment.credit', attachmentId: 0, bytes: 1 });
  });

  it('refuses a zero or negative credit — a delta, never a running total', () => {
    for (const bytes of [0, -1, 1.5]) {
      expect(
        protocolMessageSchema.safeParse({ type: 'attachment.credit', attachmentId: 7, bytes })
          .success,
      ).toBe(false);
    }
  });

  it('keeps the attachment id inside the 4-byte range the binary frame prefix carries', () => {
    expect(
      protocolMessageSchema.safeParse({
        type: 'attachment.credit',
        attachmentId: 0xffffffff,
        bytes: 1,
      }).success,
    ).toBe(true);
    expect(
      protocolMessageSchema.safeParse({
        type: 'attachment.credit',
        attachmentId: 0x100000000,
        bytes: 1,
      }).success,
    ).toBe(false);
  });
});

describe('events.ack', () => {
  it('echoes the batch id, so a runner knows which batch it may drop', () => {
    const appended = SAMPLES['events.append'];
    const acked = SAMPLES['events.ack'];
    if (appended.type !== 'events.append' || acked.type !== 'events.ack') throw new Error('sample');
    expect(acked.batchId).toBe(appended.batchId);
    expect(acked.accepted).toEqual(appended.events.map((event) => event.idempotencyKey));
  });

  it('requires a batch id on the append too — there is nothing to echo otherwise', () => {
    const { batchId: _batchId, ...withoutBatchId } = SAMPLES['events.append'] as {
      batchId: string;
    } & Record<string, unknown>;
    expect(protocolMessageSchema.safeParse(withoutBatchId).success).toBe(false);
  });

  it('accepts an empty accepted list: nothing landed, so the runner resends', () => {
    expect(
      protocolMessageSchema.safeParse({ type: 'events.ack', batchId: 'b1', accepted: [] }).success,
    ).toBe(true);
  });

  it('names refused keys with a reason, which the runner must not resend', () => {
    const parsed = protocolMessageSchema.parse({
      type: 'events.ack',
      batchId: 'b1',
      accepted: ['run:1'],
      rejected: [{ idempotencyKey: 'run:2', reason: 'payload too large' }],
    });
    expect(parsed).toMatchObject({ type: 'events.ack' });
  });

  it('holds acknowledged keys to the same `<runId>:<n>` shape the append uses', () => {
    expect(
      protocolMessageSchema.safeParse({ type: 'events.ack', batchId: 'b1', accepted: ['nope'] })
        .success,
    ).toBe(false);
  });
});

describe('F3: a login URL on the wire is a vendor login URL', () => {
  const lookalike = 'https://claude.ai.attacker.test/oauth/authorize';

  it('accepts the reporting agent’s own vendor', () => {
    expect(protocolMessageSchema.safeParse(SAMPLES.hello).success).toBe(true);
    expect(
      sessionSnapshotSchema.safeParse({
        ...snapshot,
        agent: 'codex',
        loginUrl: 'https://auth.openai.com/authorize?x=1',
      }).success,
    ).toBe(true);
  });

  it('refuses a lookalike host in a hello and in a heartbeat', () => {
    for (const type of ['hello', 'heartbeat'] as const) {
      const message = SAMPLES[type];
      expect(
        protocolMessageSchema.safeParse({
          ...message,
          sessions: [{ ...snapshot, loginUrl: lookalike }],
        }).success,
      ).toBe(false);
    }
  });

  it('refuses the other vendor’s login URL for this agent', () => {
    expect(
      sessionSnapshotSchema.safeParse({
        ...snapshot,
        agent: 'claude-code',
        loginUrl: 'https://auth.openai.com/authorize',
      }).success,
    ).toBe(false);
  });

  it('still allows no login URL at all', () => {
    expect(sessionSnapshotSchema.safeParse({ ...snapshot, loginUrl: null }).success).toBe(true);
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

  it('names every reusable definition, so the Go generator does not emit `Schema0`', () => {
    const defs = emitted.$defs as Record<string, unknown>;
    expect(Object.keys(defs).filter((name) => name.startsWith('__'))).toEqual([]);
    expect(defs).toHaveProperty('sessionSnapshot');
  });

  it('carries the snapshot once and refs it from both hello and heartbeat', () => {
    const branches = emitted.anyOf as {
      properties: { type: { const: string }; sessions?: { items: unknown } };
    }[];
    for (const type of ['hello', 'heartbeat']) {
      const branch = branches.find((candidate) => candidate.properties.type.const === type);
      expect(branch?.properties.sessions?.items).toEqual({ $ref: '#/$defs/sessionSnapshot' });
    }
  });

  it('carries the 8 KB payload cap, so the runner cannot disagree about it', () => {
    const branches = emitted.anyOf as {
      properties: { type: { const: string }; events?: { items: { properties: unknown } } };
    }[];
    const append = branches.find((b) => b.properties.type.const === 'events.append');
    const eventProperties = append?.properties.events?.items.properties as
      | Record<string, unknown>
      | undefined;
    expect(eventProperties?.payload).toEqual({
      type: 'string',
      maxLength: PROTOCOL_MAX_EVENT_PAYLOAD_BYTES,
    });
  });

  it('carries the vendor-host constraint on loginUrl', () => {
    const snapshotDef = (emitted.$defs as Record<string, { properties: Record<string, unknown> }>)
      .sessionSnapshot;
    expect(JSON.stringify(snapshotDef.properties.loginUrl)).toContain('claude\\\\.ai');
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
