import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';
import {
  describeProtocolBreaks,
  findProtocolBreaks,
  type ProtocolBreak,
  unversionedProtocolBreaks,
} from '../compatibility.js';
import { toProtocolJsonSchema } from '../json-schema.js';

/**
 * The link only grows. `protocol-schema/released.schema.json` is the schema as
 * the last runner release shipped it, and every runner out there was built
 * against it; a change that breaks one of them fails here, before it ships,
 * unless `PROTOCOL_VERSION` moved on to say so.
 */
const require = createRequire(import.meta.url);
const { releasedPath } = require('../../../scripts/release-link-protocol.cjs');

type Schema = Record<string, unknown>;

const released = (): Schema => JSON.parse(readFileSync(releasedPath, 'utf8'));

describe('the released link protocol', () => {
  it('is still spoken by the schema the Zod emits today', () => {
    const breaks = unversionedProtocolBreaks(released(), toProtocolJsonSchema());
    expect(
      describeProtocolBreaks(breaks),
      'The runner link only grows: make the change additive, or bump PROTOCOL_VERSION ' +
        '(src/protocol/version.ts) on purpose. The snapshot is refreshed at a runner release ' +
        '(pnpm --filter @oppenheimer/shared protocol:release), never to make this pass.',
    ).toEqual([]);
  });

  it('lets a version bump carry a break on purpose', () => {
    const current = mutate((schema) => {
      delete branch(schema, 'hello').properties.runId;
      constants(schema).protocolVersion = (constants(schema).protocolVersion as number) + 1;
    });
    expect(findProtocolBreaks(released(), current)).not.toEqual([]);
    expect(unversionedProtocolBreaks(released(), current)).toEqual([]);
  });
});

describe('a break to the link protocol', () => {
  it('is a message type removed', () => {
    const current = mutate((schema) => {
      schema.anyOf = (schema.anyOf as Branch[]).filter((b) => typeOf(b) !== 'session.stop');
    });
    expect(breaksOf(current)).toEqual([rule('session.stop', 'message-removed')]);
  });

  it('is a property removed', () => {
    const current = mutate((schema) => {
      delete branch(schema, 'hello').properties.runId;
    });
    expect(breaksOf(current)).toEqual([rule('hello.runId', 'property-removed')]);
  });

  it('is a property removed from a shared definition, under every message that uses it', () => {
    const current = mutate((schema) => {
      delete defs(schema).sessionSnapshot.properties.windows;
    });
    expect(breaksOf(current).map((b) => b.path)).toEqual([
      'hello.sessions[].windows',
      'heartbeat.sessions[].windows',
    ]);
  });

  it('is an optional property made required, or a new required property', () => {
    const current = mutate((schema) => {
      const close = branch(schema, 'session.close');
      close.properties.reason = { type: 'string' };
      close.required.push('acceptUnpushedWork', 'reason');
    });
    expect(breaksOf(current)).toEqual([
      rule('session.close.acceptUnpushedWork', 'property-required'),
      rule('session.close.reason', 'property-required'),
    ]);
  });

  it('is a required property made optional, which an old receiver still needs', () => {
    const current = mutate((schema) => {
      const grant = branch(schema, 'credentials.grant');
      grant.required = grant.required.filter((key) => key !== 'sealed');
    });
    expect(breaksOf(current)).toEqual([
      rule('credentials.grant.sealed', 'property-no-longer-required'),
    ]);
  });

  it('is an enum value removed', () => {
    const current = mutate((schema) => {
      const kind = branch(schema, 'hint').properties.kind as { enum: string[] };
      kind.enum = kind.enum.filter((value) => value !== 'blocked');
    });
    expect(breaksOf(current)).toEqual([rule('hint.kind', 'enum-narrowed')]);
  });

  it('is a bound tightened: a maximum lowered, a minimum raised, a new cap', () => {
    const current = mutate((schema) => {
      const hello = branch(schema, 'hello');
      (hello.properties.runnerVersion as Schema).maxLength = 32;
      (hello.properties.runnerVersion as Schema).minLength = 2;
      (hello.properties.sessions as Schema).maxItems = 10;
    });
    expect(breaksOf(current)).toEqual([
      rule('hello.runnerVersion', 'bound-tightened'),
      rule('hello.runnerVersion', 'bound-tightened'),
      rule('hello.sessions', 'bound-tightened'),
    ]);
  });

  it('is a type changed, or a field that can now be null', () => {
    const current = mutate((schema) => {
      const hello = branch(schema, 'hello');
      hello.properties.runnerVersion = { type: 'integer' };
      hello.properties.runId = { anyOf: [hello.properties.runId, { type: 'null' }] };
    });
    expect(breaksOf(current)).toEqual([
      rule('hello.runnerVersion', 'type-changed'),
      rule('hello.runId', 'type-changed'),
    ]);
  });

  it('is a default changed, which is what an old sender meant by leaving it out', () => {
    const current = mutate((schema) => {
      (branch(schema, 'session.close').properties.acceptUnpushedWork as Schema).default = true;
    });
    expect(breaksOf(current)).toEqual([
      rule('session.close.acceptUnpushedWork', 'default-changed'),
    ]);
  });

  it('is a link constant changed or dropped', () => {
    const current = mutate((schema) => {
      const link = constants(schema);
      link.maxFrameBytes = (link.maxFrameBytes as number) / 2;
      link.capabilities = (link.capabilities as string[]).slice(1);
    });
    expect(breaksOf(current)).toEqual([
      rule('x-constants.maxFrameBytes', 'constant-changed'),
      rule('x-constants.capabilities', 'constant-changed'),
    ]);
  });

  it('is not growth: a new message, an optional field, an enum value, a looser bound', () => {
    const current = mutate((schema) => {
      const hello = branch(schema, 'hello');
      hello.properties.region = { type: 'string', maxLength: 64 };
      (hello.properties.runnerVersion as Schema).maxLength = 128;
      const kind = branch(schema, 'hint').properties.kind as { enum: string[] };
      kind.enum.push('draining');
      (schema.anyOf as Branch[]).push({
        type: 'object',
        properties: { type: { type: 'string', const: 'host.drain' } },
        required: ['type'],
      });
      constants(schema).capabilities = [...(constants(schema).capabilities as string[]), 'drain'];
    });
    expect(breaksOf(current)).toEqual([]);
  });
});

interface Branch extends Schema {
  properties: Record<string, unknown>;
  required: string[];
}

function mutate(change: (schema: Schema) => void): Schema {
  const schema = released();
  change(schema);
  return schema;
}

function breaksOf(current: Schema): Pick<ProtocolBreak, 'path' | 'rule'>[] {
  return findProtocolBreaks(released(), current).map(({ path, rule }) => ({ path, rule }));
}

function rule(path: string, name: ProtocolBreak['rule']): Pick<ProtocolBreak, 'path' | 'rule'> {
  return { path, rule: name };
}

function typeOf(message: Branch): unknown {
  return (message.properties.type as Schema).const;
}

function branch(schema: Schema, type: string): Branch {
  const found = (schema.anyOf as Branch[]).find((b) => typeOf(b) === type);
  if (!found) throw new Error(`no ${type} in the released schema`);
  return found;
}

function defs(schema: Schema): Record<string, Branch> {
  return schema.$defs as Record<string, Branch>;
}

function constants(schema: Schema): Schema {
  return schema['x-constants'] as Schema;
}
