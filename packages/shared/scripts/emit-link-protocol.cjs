#!/usr/bin/env node
/**
 * Write the runner's link vocabulary from the protocol's JSON Schema.
 *
 * `protocol-schema/protocol.schema.json` is the contract 01 names (open
 * question 1: "Zod is the source … the Go structs are generated from the
 * artifact — one source, two languages, no hand-written twin"). This reads the
 * artifact, not the Zod, so the artifact really is what the runner is built
 * against, and writes `apps/runner/internal/link/protocol.gen.go`: one struct per
 * message, the type names, and the link's constants from `x-constants`. It runs
 * in `pnpm --filter @oppenheimer/shared build`, right after the schema is
 * emitted, and the result is committed. `link-protocol.spec.ts` fails when the
 * committed file is stale, and the runner's `protocol_test.go` decodes every
 * TypeScript sample strictly into these structs.
 *
 * Two things the schema cannot say are tables here, and the emitter fails
 * rather than guesses when either misses an entry:
 *
 * - the Go width of an integer (`INTEGER_TYPES`): a JSON range does not pick
 *   one, and an attachment id is a `uint32` because the frame header is;
 * - the Go name of an inline object (`NESTED_NAMES`) where the runner already
 *   has one, so the generated names read like the code that uses them.
 *
 * `#/$defs/hostFacts` is not generated: it is the runner's own `Facts` struct,
 * which the schema follows (packages/shared/AGENTS.md), so it maps onto
 * `hostdomain.Facts` and `protocol_test.go` checks the two agree.
 *
 * The output is gofmt-clean by construction (columns aligned the way gofmt
 * aligns them); `protocol_test.go` holds it to `format.Source`.
 */
const { readFileSync, writeFileSync } = require('node:fs');
const { join, relative } = require('node:path');

const schemaPath = join(__dirname, '..', 'protocol-schema', 'protocol.schema.json');
const outputPath = join(
  __dirname,
  '..',
  '..',
  '..',
  'apps',
  'runner',
  'internal',
  'link',
  'protocol.gen.go',
);

const HOST_DOMAIN_IMPORT =
  'hostdomain "github.com/jordiparracrespo/oppenheimer/apps/runner/internal/host/domain"';

/** Defs the runner owns: mapped onto its type, never generated. */
const EXTERNAL_DEFS = { hostFacts: 'hostdomain.Facts', hostTool: 'hostdomain.Tool' };

/**
 * The Go type of every integer on the wire, by `$defs` name or by
 * `<owner>.<property>` path. An integer the table does not name fails the
 * emitter: a new one is a decision about its width, not a default.
 */
const INTEGER_TYPES = {
  windowIndex: 'int',
  attachmentId: 'uint32',
  githubRepoId: 'int64',
  'hello.protocol.min': 'int',
  'hello.protocol.max': 'int',
  'heartbeat.load.memoryAvailableBytes': 'uint64',
  'hint.retryAfterSeconds': 'int',
  'welcome.protocol': 'int',
  'welcome.epoch': 'uint64',
  'attachment.credit.bytes': 'int',
  'session.attach.cols': 'int',
  'session.attach.rows': 'int',
  'session.resize.cols': 'int',
  'session.resize.rows': 'int',
  'sessionSnapshot.stateSeconds': 'int',
};

/** Inline objects the runner already had a name for; the rest are `<Parent><Field>`. */
const NESTED_NAMES = {
  'hello.protocol': 'Range',
  'heartbeat.load': 'Load',
  'events.append.events[]': 'Event',
  'session.create.launch': 'LaunchOptions',
  'session.create.checkouts[]': 'Checkout',
  'sessionSnapshot.windows[]': 'Window',
};

/** Doc comments for the constants, which the schema carries as bare values. */
const CONSTANT_DOCS = {
  protocolVersion: [
    'ProtocolVersion is the one version of the wire this runner speaks: it',
    'advertises it as `hello.protocol.max`.',
  ],
  closeCodes: [
    'The close codes the control plane uses on the link, `4000 + HTTP status`.',
    'CloseUnpaired is terminal: its handshake twin is a 410 carrying',
    'RefusalHeader: RefusalUnpaired — see ErrUnpaired.',
  ],
  refusal: [
    "RefusalHeader and its values mark the control plane's own refusal at the",
    'handshake. A bare 410 is not trusted — any proxy in front of the control',
    'plane can answer one — and a host that took a stranger\'s as "unpaired"',
    'would stop dialling for good.',
  ],
  frameHeaderBytes: [
    'FrameHeader is the 4-byte big-endian attachment id every binary frame on',
    'the link starts with (01-protocol, "Framing").',
  ],
  creditWindowBytes: [
    "CreditWindow is 01's 256 KB: the bytes an attachment may have in flight",
    'before its PTY reads pause. A runaway build stalls its own pane, never the',
    'link.',
  ],
  maxFrameBytes: [
    'MaxFrameBytes is the largest frame either peer puts on the link: the',
    'control plane closes a link that sends a bigger one with 1009, so the',
    'runner reads no bigger one and never sends one.',
  ],
  capabilities: [
    'The hello capabilities: commands a runner takes beyond its protocol',
    "version's baseline.",
  ],
  maxEventPayloadBytes: [
    "MaxEventPayloadBytes caps an event's JSON payload string, because an event",
    'never carries pane text.',
  ],
};

/** `session.window.open` → `SessionWindowOpen`, `HELLO_EXPECTED` → `HelloExpected`. */
function pascal(value) {
  return value
    .split(/[._-]/)
    .filter(Boolean)
    .map((word) =>
      word === word.toUpperCase()
        ? word[0] + word.slice(1).toLowerCase()
        : word[0].toUpperCase() + word.slice(1),
    )
    .join('');
}

/** A JSON key as a Go field name, with Go's initialisms: `sessionId` → `SessionID`. */
function fieldName(key) {
  return (key[0].toUpperCase() + key.slice(1))
    .replace(/Id(?=[A-Z]|$)/g, 'ID')
    .replace(/Url(?=[A-Z]|$)/g, 'URL');
}

/** gofmt's tabwriter: each column padded to the widest cell of its section. */
function aligned(rows, indent) {
  const widths = [];
  for (const row of rows) {
    row.forEach((cell, i) => {
      if (i < row.length - 1) widths[i] = Math.max(widths[i] ?? 0, cell.length);
    });
  }
  return rows.map(
    (row) =>
      indent + row.map((cell, i) => (i < row.length - 1 ? cell.padEnd(widths[i]) : cell)).join(' '),
  );
}

function comment(lines, indent = '') {
  return lines.map((line) => `${indent}// ${line}`);
}

function build(schema) {
  const defs = schema.$defs ?? {};
  const structs = []; // { name, doc, fields: [{ name, type, tag, doc }] }
  const names = new Set();
  const emittedDefs = new Set();
  let usesTime = false;
  let usesHost = false;

  function claim(name, path) {
    if (names.has(name)) throw new Error(`two structs would be named ${name} (at ${path})`);
    names.add(name);
  }

  function integerType(path, defName) {
    const type = INTEGER_TYPES[defName ?? path];
    if (!type) {
      throw new Error(
        `no Go width for the integer at ${defName ? `#/$defs/${defName}` : path}; add it to INTEGER_TYPES`,
      );
    }
    return type;
  }

  function refType(ref) {
    const defName = ref.replace('#/$defs/', '');
    if (EXTERNAL_DEFS[defName]) {
      usesHost = true;
      return EXTERNAL_DEFS[defName];
    }
    const def = defs[defName];
    if (!def) throw new Error(`unknown $ref ${ref}`);
    if (def.type === 'object') {
      const name = pascal(defName);
      if (!emittedDefs.has(defName)) {
        emittedDefs.add(defName);
        pendingDefs.push([defName, name, def]);
      }
      return name;
    }
    return typeOf(def, defName, undefined, defName);
  }

  /** The Go type of a schema at `path`; `parent` names an inline object's struct. */
  function typeOf(node, path, parent, defName) {
    if (node.$ref) return refType(node.$ref);
    if (node.anyOf) {
      const others = node.anyOf.filter((branch) => branch.type !== 'null');
      if (others.length !== 1 || others.length === node.anyOf.length) {
        throw new Error(`unsupported anyOf at ${path}: only "X or null" maps onto Go`);
      }
      return `*${typeOf(others[0], path, parent, defName)}`;
    }
    switch (node.type) {
      case 'string':
        if (node.format === 'date-time') {
          usesTime = true;
          return 'time.Time';
        }
        return 'string';
      case 'boolean':
        return 'bool';
      case 'number':
        return 'float64';
      case 'integer':
        return integerType(path, defName);
      case 'array':
        return `[]${typeOf(node.items, `${path}[]`, parent)}`;
      case 'object': {
        const [owner, field] = parent;
        const name = NESTED_NAMES[path] ?? owner + fieldName(field);
        addStruct(name, [`${name} is ${owner}.${fieldName(field)}.`], node, path);
        return name;
      }
      default:
        throw new Error(`unsupported schema at ${path}: ${JSON.stringify(node)}`);
    }
  }

  const pendingDefs = [];

  function addStruct(name, doc, node, path) {
    claim(name, path);
    const struct = { name, doc: node.description ? [node.description] : doc, fields: [] };
    structs.push(struct);
    const required = new Set(node.required ?? []);
    for (const [key, property] of Object.entries(node.properties ?? {})) {
      let type = typeOf(property, `${path}.${key}`, [name, key]);
      const optional = !required.has(key);
      // A defaulted field is always sent, as Zod's own output always has it:
      // `hello.capabilities` is `[]`, never absent, and `acceptUnpushedWork`
      // is `false`.
      const omit = optional && property.default === undefined;
      if (omit && (type === 'time.Time' || structs.some((s) => s.name === type))) {
        type = `*${type}`; // omitempty never omits a struct value
      }
      struct.fields.push({
        name: fieldName(key),
        type,
        tag: `\`json:"${key}${omit ? ',omitempty' : ''}"\``,
        doc: property.description,
      });
    }
  }

  const messages = schema.anyOf.map((branch) => {
    const type = branch.properties?.type?.const;
    if (typeof type !== 'string') throw new Error('a message branch has no `type` const');
    return { type, name: pascal(type), branch };
  });
  for (const { type, name, branch } of messages) {
    addStruct(name, [`${name} is the \`${type}\` message.`], branch, type);
  }
  while (pendingDefs.length > 0) {
    const [defName, name, def] = pendingDefs.shift();
    addStruct(name, [`${name} is \`#/$defs/${defName}\`.`], def, defName);
  }

  return { messages, structs, usesTime, usesHost };
}

function renderStruct({ name, doc, fields }) {
  const lines = [...comment(doc), `type ${name} struct {`];
  // A comment line ends gofmt's alignment section, so align between them.
  let section = [];
  const flush = () => {
    lines.push(...aligned(section, '\t'));
    section = [];
  };
  for (const field of fields) {
    if (field.doc) {
      flush();
      lines.push(...comment([field.doc], '\t'));
    }
    section.push([field.name, field.type, field.tag]);
  }
  flush();
  lines.push('}');
  return lines;
}

function constGroup(rows) {
  return [
    'const (',
    ...aligned(
      rows.map(([name, value]) => [name, `= ${value}`]),
      '\t',
    ),
    ')',
  ];
}

function render(schema = JSON.parse(readFileSync(schemaPath, 'utf8'))) {
  const constants = schema['x-constants'];
  if (!constants) throw new Error('the schema carries no x-constants; rebuild @oppenheimer/shared');
  const { messages, structs, usesTime, usesHost } = build(schema);

  const imports = [];
  if (usesTime) imports.push('\t"time"');
  if (usesTime && usesHost) imports.push('');
  if (usesHost) imports.push(`\t${HOST_DOMAIN_IMPORT}`);

  const lines = [
    '// Code generated by packages/shared/scripts/emit-link-protocol.cjs from',
    '// packages/shared/protocol-schema/protocol.schema.json; DO NOT EDIT.',
    '',
    'package link',
    '',
  ];
  if (imports.length > 0) lines.push('import (', ...imports, ')', '');

  lines.push(
    ...comment(CONSTANT_DOCS.protocolVersion),
    `const ProtocolVersion = ${constants.protocolVersion}`,
    '',
    ...comment(CONSTANT_DOCS.closeCodes),
    ...constGroup(
      Object.entries(constants.closeCodes).map(([key, code]) => [`Close${pascal(key)}`, code]),
    ),
    '',
    ...comment(CONSTANT_DOCS.refusal),
    ...constGroup([
      ['RefusalHeader', JSON.stringify(constants.refusalHeader)],
      ...Object.entries(constants.refusals).map(([key, value]) => [
        `Refusal${pascal(key)}`,
        JSON.stringify(value),
      ]),
    ]),
    '',
    ...comment(CONSTANT_DOCS.frameHeaderBytes),
    `const FrameHeader = ${constants.frameHeaderBytes}`,
    '',
    ...comment(CONSTANT_DOCS.creditWindowBytes),
    `const CreditWindow = ${constants.creditWindowBytes}`,
    '',
    ...comment(CONSTANT_DOCS.maxFrameBytes),
    `const MaxFrameBytes = ${constants.maxFrameBytes}`,
    '',
    ...comment(CONSTANT_DOCS.maxEventPayloadBytes),
    `const MaxEventPayloadBytes = ${constants.maxEventPayloadBytes}`,
    '',
    ...comment(CONSTANT_DOCS.capabilities),
    ...constGroup(
      constants.capabilities.map((capability) => [
        `Capability${pascal(capability)}`,
        JSON.stringify(capability),
      ]),
    ),
    '',
    '// The `type` of every message on the link.',
    ...constGroup(messages.map(({ type, name }) => [`Type${name}`, JSON.stringify(type)])),
    '',
    "// MessageTypes is every message type on the link, in the schema's order.",
    'var MessageTypes = []string{',
    ...messages.map(({ name }) => `\tType${name},`),
    '}',
    '',
    '// NewMessage returns a pointer to a new struct for a message type, and false',
    '// for a type this runner does not know.',
    'func NewMessage(messageType string) (any, bool) {',
    '\tswitch messageType {',
    ...messages.flatMap(({ name }) => [`\tcase Type${name}:`, `\t\treturn new(${name}), true`]),
    '\t}',
    '\treturn nil, false',
    '}',
    '',
  );
  for (const struct of structs) lines.push(...renderStruct(struct), '');
  return lines.join('\n');
}

// Only when run: `require()` must not rewrite the committed file, or the spec
// that compares it with render() would compare a fresh render with itself.
if (require.main === module) {
  const output = render();
  if (process.argv.includes('--check')) {
    if (readFileSync(outputPath, 'utf8') !== output) {
      console.error(
        `${relative(process.cwd(), outputPath)} is stale; run pnpm --filter @oppenheimer/shared build`,
      );
      process.exit(1);
    }
    process.exit(0);
  }
  writeFileSync(outputPath, output, 'utf8');
  console.log(`runner link protocol written to ${relative(process.cwd(), outputPath)}`);
}

module.exports = { render, outputPath, schemaPath, INTEGER_TYPES };
