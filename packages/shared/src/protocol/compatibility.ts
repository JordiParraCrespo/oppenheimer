/**
 * What a change to the link's JSON Schema breaks for a peer built against an
 * earlier one.
 *
 * **Build-only**, like `./json-schema.ts`, and not re-exported from
 * `./index.ts`: `src/protocol/__tests__/released-protocol.spec.ts` compares the
 * schema the Zod emits today with `protocol-schema/released.schema.json`, the
 * copy frozen at the last runner release, and fails on every break this finds.
 * The protocol only grows; a real break is a `PROTOCOL_VERSION` bump on purpose.
 *
 * The link has two directions on one union, and the schema does not say which
 * way a message travels (several travel both). So every message is held to
 * both peers' needs at once: an old **receiver** must still parse what a new
 * sender sends, and a new receiver must still accept what an old sender sends.
 * That makes the rules symmetric and conservative:
 *
 * - no message type removed, no property removed;
 * - no property newly required, and no required property made optional (an
 *   old receiver still needs it);
 * - no type changed, and no `anyOf` alternative added or removed (a field
 *   that becomes nullable can now carry a value an old receiver refuses);
 * - no enum value removed, no `const` changed, no enum on a field that had none;
 * - no upper bound (`maxLength`, `maximum`, `exclusiveMaximum`, `maxItems`)
 *   lowered or added, no lower bound (`minLength`, `minimum`,
 *   `exclusiveMinimum`, `minItems`) raised or added;
 * - no `pattern`, `format` or `contentEncoding` added or changed;
 * - no `default` changed or removed: it is what an old sender's omission means;
 * - no released `x-constants` entry removed or changed, and `protocolVersion`
 *   never lowered (raising it is the deliberate break, see
 *   `unversionedProtocolBreaks`).
 *
 * Growing is allowed: a new message type, a new optional property, a relaxed
 * bound, a dropped pattern, and a **new enum value**. That last one is a
 * decision: the runner decodes enums as plain Go strings (`json.Unmarshal`, no
 * strict mode), so a value it has never seen does not fail its decode, and the
 * control plane, which parses with Zod, ships before any runner that could
 * send it. A new value the control plane sends still lands in an old runner's
 * default branch, though, so its sender gates it on `hello.capabilities` or the
 * negotiated version; this comparison cannot see that, the review must.
 */

type Schema = Record<string, unknown>;

export type ProtocolBreakRule =
  | 'message-removed'
  | 'property-removed'
  | 'property-required'
  | 'property-no-longer-required'
  | 'type-changed'
  | 'enum-narrowed'
  | 'const-changed'
  | 'bound-tightened'
  | 'format-changed'
  | 'default-changed'
  | 'constant-changed'
  | 'version-lowered';

export interface ProtocolBreak {
  /** Where, as `<message type>.<property>…`, `[]` for an array's items. */
  path: string;
  rule: ProtocolBreakRule;
  detail: string;
}

const UPPER_BOUNDS = ['maxLength', 'maximum', 'exclusiveMaximum', 'maxItems'] as const;
const LOWER_BOUNDS = ['minLength', 'minimum', 'exclusiveMinimum', 'minItems'] as const;
const EXACT_KEYWORDS = ['pattern', 'format', 'contentEncoding'] as const;

/**
 * Every break between `released` and `current`, both as
 * `toProtocolJsonSchema()` emits them, in schema order. Empty means a peer
 * built against `released` still speaks to one built against `current`.
 */
export function findProtocolBreaks(released: Schema, current: Schema): ProtocolBreak[] {
  const breaks: ProtocolBreak[] = [];
  const report = (path: string, rule: ProtocolBreakRule, detail: string) =>
    breaks.push({ path, rule, detail });

  const before = { defs: asSchema(released.$defs) };
  const after = { defs: asSchema(current.$defs) };
  const currentMessages = messagesOf(current);
  for (const [type, branch] of messagesOf(released)) {
    const next = currentMessages.get(type);
    if (!next) {
      report(type, 'message-removed', 'the message type is gone');
      continue;
    }
    compareNode(branch, next, type, before, after, report);
  }

  const releasedVersion = protocolVersionOf(released);
  const currentVersion = protocolVersionOf(current);
  if (currentVersion < releasedVersion) {
    report(
      'x-constants.protocolVersion',
      'version-lowered',
      `went back from ${releasedVersion} to ${currentVersion}`,
    );
  }
  const { protocolVersion: _r, ...releasedConstants } = asSchema(released['x-constants']);
  const { protocolVersion: _c, ...currentConstants } = asSchema(current['x-constants']);
  compareConstants(releasedConstants, currentConstants, 'x-constants', report);
  return breaks;
}

/**
 * The breaks the release snapshot owes an answer for: none once
 * `PROTOCOL_VERSION` has moved past the snapshot's, because the bump is the
 * break on purpose and refreshing the snapshot at release resets the baseline.
 */
export function unversionedProtocolBreaks(released: Schema, current: Schema): ProtocolBreak[] {
  if (protocolVersionOf(current) > protocolVersionOf(released)) return [];
  return findProtocolBreaks(released, current);
}

/** One line per break, for a test failure a reviewer can read. */
export function describeProtocolBreaks(breaks: readonly ProtocolBreak[]): string[] {
  return breaks.map(({ path, rule, detail }) => `${path}: ${rule} (${detail})`);
}

function protocolVersionOf(schema: Schema): number {
  const version = asSchema(schema['x-constants']).protocolVersion;
  if (typeof version !== 'number')
    throw new Error('the schema carries no x-constants.protocolVersion');
  return version;
}

/** One schema's `$defs`, to resolve its own `$ref`s against. */
interface Side {
  defs: Schema;
}

type Report = (path: string, rule: ProtocolBreakRule, detail: string) => void;

function messagesOf(schema: Schema): Map<string, Schema> {
  const messages = new Map<string, Schema>();
  for (const branch of (schema.anyOf as Schema[] | undefined) ?? []) {
    const type = asSchema(asSchema(branch.properties).type).const;
    if (typeof type !== 'string') throw new Error('a message branch has no `type` const');
    messages.set(type, branch);
  }
  return messages;
}

function compareNode(
  released: Schema,
  current: Schema,
  path: string,
  before: Side,
  after: Side,
  report: Report,
): void {
  const was = alternativesOf(released, before);
  const now = alternativesOf(current, after);
  if (was.length === 1 && now.length === 1) {
    const [a] = was;
    const [b] = now;
    if (kindOf(a) !== kindOf(b)) {
      report(path, 'type-changed', `${kindOf(a)} → ${kindOf(b)}`);
    } else {
      compareAlternative(a, b, path, before, after, report);
    }
    return;
  }
  const nowByKind = new Map(now.map((node) => [kindOf(node), node]));
  const wasKinds = new Set(was.map(kindOf));
  for (const a of was) {
    const b = nowByKind.get(kindOf(a));
    if (!b) report(path, 'type-changed', `no longer accepts ${kindOf(a)}`);
    else compareAlternative(a, b, path, before, after, report);
  }
  for (const b of now) {
    if (!wasKinds.has(kindOf(b))) report(path, 'type-changed', `can now carry ${kindOf(b)}`);
  }
}

function compareAlternative(
  released: Schema,
  current: Schema,
  path: string,
  before: Side,
  after: Side,
  report: Report,
): void {
  if ('const' in released && !sameJson(released.const, current.const)) {
    report(path, 'const-changed', `${json(released.const)} → ${json(current.const)}`);
  }

  if (Array.isArray(current.enum)) {
    if (!Array.isArray(released.enum)) {
      report(path, 'enum-narrowed', `now limited to ${json(current.enum)}`);
    } else {
      const removed = released.enum.filter(
        (value) => !(current.enum as unknown[]).some((v) => sameJson(v, value)),
      );
      if (removed.length > 0) report(path, 'enum-narrowed', `drops ${json(removed)}`);
    }
  }

  for (const key of UPPER_BOUNDS) {
    const was = released[key];
    const now = current[key];
    if (typeof now !== 'number') continue;
    if (typeof was !== 'number') report(path, 'bound-tightened', `${key} ${now} added`);
    else if (now < was) report(path, 'bound-tightened', `${key} lowered from ${was} to ${now}`);
  }
  for (const key of LOWER_BOUNDS) {
    const was = released[key];
    const now = current[key];
    if (typeof now !== 'number') continue;
    if (typeof was !== 'number') report(path, 'bound-tightened', `${key} ${now} added`);
    else if (now > was) report(path, 'bound-tightened', `${key} raised from ${was} to ${now}`);
  }

  for (const key of EXACT_KEYWORDS) {
    if (current[key] === undefined || current[key] === released[key]) continue;
    report(
      path,
      'format-changed',
      released[key] === undefined
        ? `${key} ${json(current[key])} added`
        : `${key} ${json(released[key])} → ${json(current[key])}`,
    );
  }

  if ('default' in released && !sameJson(released.default, current.default)) {
    report(
      path,
      'default-changed',
      'default' in current
        ? `${json(released.default)} → ${json(current.default)}`
        : `${json(released.default)} removed`,
    );
  }

  if (released.properties || current.properties) {
    compareObject(released, current, path, before, after, report);
  }
  if (released.items && current.items) {
    compareNode(
      asSchema(released.items),
      asSchema(current.items),
      `${path}[]`,
      before,
      after,
      report,
    );
  }
}

function compareObject(
  released: Schema,
  current: Schema,
  path: string,
  before: Side,
  after: Side,
  report: Report,
): void {
  const was = asSchema(released.properties);
  const now = asSchema(current.properties);
  const wasRequired = new Set((released.required as string[] | undefined) ?? []);
  const nowRequired = new Set((current.required as string[] | undefined) ?? []);

  for (const [key, property] of Object.entries(was)) {
    const at = `${path}.${key}`;
    if (!(key in now)) {
      report(at, 'property-removed', 'the property is gone');
      continue;
    }
    if (wasRequired.has(key) && !nowRequired.has(key)) {
      report(at, 'property-no-longer-required', 'an old receiver still needs it');
    }
    compareNode(asSchema(property), asSchema(now[key]), at, before, after, report);
  }
  for (const key of nowRequired) {
    if (!wasRequired.has(key)) {
      report(
        `${path}.${key}`,
        'property-required',
        key in was ? 'was optional' : 'a new required property',
      );
    }
  }
  if (current.additionalProperties === false && released.additionalProperties !== false) {
    report(path, 'bound-tightened', 'additionalProperties: false added');
  }
}

/** A node as the alternatives it accepts, `$ref`s resolved and `anyOf`s flattened. */
function alternativesOf(node: Schema, side: Side, depth = 0): Schema[] {
  if (depth > 32) throw new Error('a $ref chain that never ends');
  if (typeof node.$ref === 'string')
    return alternativesOf(resolve(node.$ref, side), side, depth + 1);
  if (Array.isArray(node.anyOf)) {
    return (node.anyOf as Schema[]).flatMap((branch) => alternativesOf(branch, side, depth + 1));
  }
  return [node];
}

function resolve(ref: string, side: Side): Schema {
  const name = ref.replace('#/$defs/', '');
  const def = side.defs[name];
  if (!def) throw new Error(`unknown $ref ${ref}`);
  return asSchema(def);
}

function kindOf(node: Schema): string {
  if (Array.isArray(node.type)) return [...node.type].sort().join('|');
  if (typeof node.type === 'string') return node.type;
  if ('const' in node) return `const ${json(node.const)}`;
  return 'any';
}

function compareConstants(released: unknown, current: unknown, path: string, report: Report) {
  if (Array.isArray(released) && Array.isArray(current)) {
    const removed = released.filter((value) => !current.some((v) => sameJson(v, value)));
    if (removed.length > 0) report(path, 'constant-changed', `drops ${json(removed)}`);
    return;
  }
  if (isSchema(released) && isSchema(current)) {
    for (const [key, value] of Object.entries(released)) {
      if (!(key in current)) report(`${path}.${key}`, 'constant-changed', 'removed');
      else compareConstants(value, current[key], `${path}.${key}`, report);
    }
    return;
  }
  if (!sameJson(released, current)) {
    report(path, 'constant-changed', `${json(released)} → ${json(current)}`);
  }
}

function isSchema(value: unknown): value is Schema {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function asSchema(value: unknown): Schema {
  return isSchema(value) ? value : {};
}

function sameJson(a: unknown, b: unknown): boolean {
  return json(a) === json(b);
}

function json(value: unknown): string {
  return JSON.stringify(value) ?? 'undefined';
}
