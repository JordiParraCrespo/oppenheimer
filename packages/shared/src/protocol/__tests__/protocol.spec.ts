import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { attachTicketHintSchema, HINT_KINDS } from '../hint.js';
import { toProtocolJsonSchema } from '../json-schema.js';
import {
  RUNNER_LINK_CLOSE_CODES,
  RUNNER_LINK_REFUSAL_HEADER,
  RUNNER_LINK_REFUSALS,
} from '../link.js';
import {
  PROTOCOL_MAX_EVENT_PAYLOAD_BYTES,
  PROTOCOL_MESSAGE_TYPES,
  protocolMessageSchema,
} from '../messages.js';
import { sessionSnapshotSchema } from '../primitives.js';
import { commandId, hostFacts, occurredAt, SAMPLES, sessionId, snapshot } from '../samples.js';
import { PROTOCOL_VERSION } from '../version.js';

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

describe('session.create for every catalog agent', () => {
  const create = SAMPLES['session.create'];

  it('carries OpenCode with a `provider/model` and a level', () => {
    const parsed = protocolMessageSchema.parse({
      ...create,
      agent: 'opencode',
      launch: { model: 'anthropic/claude-opus-5-5', permission: 'ask' },
    });
    expect(parsed).toMatchObject({ agent: 'opencode', launch: { permission: 'ask' } });
  });

  it('carries Grok with a model, a level and an effort', () => {
    const parsed = protocolMessageSchema.parse({
      ...create,
      agent: 'grok',
      launch: { model: 'grok-4.7', permission: 'auto', effort: 'high' },
    });
    expect(parsed).toMatchObject({
      agent: 'grok',
      launch: { model: 'grok-4.7', permission: 'auto', effort: 'high' },
    });
  });

  it('carries a blank terminal with no level at all', () => {
    const parsed = protocolMessageSchema.parse({ ...create, agent: 'shell', launch: {} });
    expect(parsed).toMatchObject({ agent: 'shell', launch: {} });
    if (parsed.type === 'session.create') expect(parsed.launch.permission).toBeUndefined();
  });

  it('refuses an agent outside the catalog', () => {
    expect(protocolMessageSchema.safeParse({ ...create, agent: 'cursor' }).success).toBe(false);
  });
});

describe('host facts on the link', () => {
  it('refuses the invented facts shape in hello', () => {
    expect(
      protocolMessageSchema.safeParse({
        ...SAMPLES.hello,
        host: { hostname: 'h', os: 'darwin', arch: 'arm64', tools: {}, agents: [] },
      }).success,
    ).toBe(false);
  });

  it('carries the runner’s whole Facts struct in hello and heartbeat, not a thinner variant', () => {
    for (const type of ['hello', 'heartbeat'] as const) {
      const parsed = protocolMessageSchema.parse(SAMPLES[type]);
      expect(parsed).toMatchObject({ type });
      if (parsed.type === 'hello' || parsed.type === 'heartbeat') {
        expect(parsed.host).toEqual(hostFacts);
      }
    }
    const parsed = protocolMessageSchema.parse(SAMPLES.heartbeat);
    if (parsed.type === 'heartbeat') {
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
    const rejected = [{ idempotencyKey: 'run:2', reason: 'payload too large' }];
    const parsed = protocolMessageSchema.parse({
      type: 'events.ack',
      batchId: 'b1',
      accepted: ['run:1'],
      rejected,
    });
    expect(parsed).toMatchObject({ type: 'events.ack', rejected });
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

  it('refuses any login URL from a plain shell, which has no vendor', () => {
    expect(
      sessionSnapshotSchema.safeParse({
        ...snapshot,
        agent: 'shell',
        loginUrl: 'https://claude.ai/oauth/authorize',
      }).success,
    ).toBe(false);
    expect(
      sessionSnapshotSchema.safeParse({ ...snapshot, agent: 'shell', loginUrl: null }).success,
    ).toBe(true);
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

  it('accepts Grok’s own sign-in hosts, and refuses them from another agent and the reverse', () => {
    const grok = (loginUrl: string) =>
      sessionSnapshotSchema.safeParse({ ...snapshot, agent: 'grok', loginUrl }).success;
    expect(grok('https://accounts.x.ai/oauth2/device?user_code=KKG6-57R3')).toBe(true);
    expect(grok('https://auth.x.ai/oauth2/authorize?client_id=x')).toBe(true);
    expect(grok('https://accounts.x.ai.attacker.test/oauth2/device')).toBe(false);
    expect(grok('https://claude.ai/oauth/authorize')).toBe(false);
    expect(
      sessionSnapshotSchema.safeParse({
        ...snapshot,
        agent: 'claude-code',
        loginUrl: 'https://accounts.x.ai/oauth2/device',
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

  it('carries the link constants, so the runner generates them rather than keeping a twin', () => {
    expect(emitted['x-constants']).toMatchObject({
      protocolVersion: PROTOCOL_VERSION,
      closeCodes: RUNNER_LINK_CLOSE_CODES,
      refusalHeader: RUNNER_LINK_REFUSAL_HEADER,
      refusals: RUNNER_LINK_REFUSALS,
      frameHeaderBytes: 4,
      creditWindowBytes: 256 * 1024,
      maxEventPayloadBytes: PROTOCOL_MAX_EVENT_PAYLOAD_BYTES,
    });
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
