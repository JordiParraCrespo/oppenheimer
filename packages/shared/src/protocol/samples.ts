import type { ProtocolMessage, ProtocolMessageType } from './messages.js';
import type { SessionSnapshot } from './primitives.js';

/**
 * One sample of every message on the link.
 *
 * **Build and test only.** Like `./json-schema`, this module is not re-exported
 * from `./index.ts`. `__tests__/protocol.spec.ts` parses every sample against the
 * Zod union, and `scripts/emit-protocol-schema.cjs` writes them to
 * `protocol-schema/samples.json`, which the runner's
 * `apps/runner/internal/link/protocol_test.go` decodes strictly into the
 * generated Go structs. So one set of samples is checked on both sides of the
 * wire: a field Zod gained and Go did not fails the Go test as an unknown field.
 */

export const sessionId = '3f0d9e2c-6a4b-4e9a-9c3d-7b1e5a2f8c40';
export const checkoutId = 'a1f2c3d4-5e6f-4a7b-8c9d-0e1f2a3b4c5d';
export const commandId = 'b2c3d4e5-6f7a-4b8c-9d0e-1f2a3b4c5d6e';
export const occurredAt = '2026-09-19T10:00:00Z';

/** `apps/runner/internal/host/domain/facts.go`, marshalled. */
export const hostFacts = {
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
    { name: 'codex', path: '/opt/homebrew/bin/codex', version: '0.155.1', required: false },
    { name: 'opencode', path: '/opt/homebrew/bin/opencode', version: '1.18.32', required: false },
    { name: 'grok', path: '/Users/jordi/.grok/bin/grok', version: '1.0.41', required: false },
  ],
  workspacePath: '/Users/jordi/oppenheimer-ai',
  diskFreeBytes: 120_000_000_000,
  runnerVersion: '0.4.1',
};

export const snapshot: SessionSnapshot = {
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
export const SAMPLES: Record<ProtocolMessageType, ProtocolMessage> = {
  hello: {
    type: 'hello',
    runnerVersion: '0.4.1',
    protocol: { min: 1, max: 1 },
    runId: 'run-7f3a',
    host: hostFacts,
    sessions: [snapshot],
    capabilities: ['session.image'],
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
    epoch: 3,
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
  'session.image': {
    type: 'session.image',
    commandId,
    sessionId,
    window: 0,
    mediaType: 'image/png',
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
  'repository.prepare': {
    type: 'repository.prepare',
    commandId,
    githubRepoId: 821374923,
    repositoryFullName: 'acme-labs/xrp-mobile',
    baseBranch: 'main',
    sealed: 'c2VhbGVkLXRva2Vu',
    expiresAt: '2026-10-02T12:00:00Z',
  },
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
