#!/usr/bin/env node
/**
 * Query the local Loki (`pnpm monitoring:up`) with LogQL and print the lines,
 * oldest first: the way a person or an agent reads the API's logs from a
 * terminal, without opening Grafana.
 *
 *   pnpm logs                                         # the API's last 15 minutes
 *   pnpm logs '{app="api", level="error"}' --since 1h
 *   pnpm logs '{app="api"} |= "bot turn"' --limit 50
 *   pnpm logs '{app="api"} | req_id="3f0c…"'          # one request, every line
 *   pnpm logs '{app="api"} | json | context="RunBotTurnCommandHandler"' --raw
 *
 * Each line is printed as the API wrote it (pino JSON), so it pipes into `jq`;
 * `--raw` is the default when stdout is not a terminal, and `--pretty` turns
 * it into `time level context msg` for reading. Exits 1 when Loki cannot be
 * reached or refuses the query, printing why.
 *
 * Options: --since <15m|1h|2d> (default 15m), --limit <n> (default 200, at
 * most 5000), --url <loki> (default http://localhost:3100), --raw, --pretty.
 */
import { parseArgs } from 'node:util';

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    since: { type: 'string', default: '15m' },
    limit: { type: 'string', default: '200' },
    url: { type: 'string', default: 'http://localhost:3100' },
    raw: { type: 'boolean', default: false },
    pretty: { type: 'boolean', default: false },
    help: { type: 'boolean', short: 'h', default: false },
  },
});

if (values.help) {
  console.log(
    "pnpm logs ['<LogQL>'] [--since 15m] [--limit 200] [--url http://localhost:3100] [--raw|--pretty]",
  );
  process.exit(0);
}

const UNITS = { s: 1, m: 60, h: 3_600, d: 86_400 };

function seconds(duration) {
  const match = /^(\d+)([smhd])$/.exec(duration);
  if (!match) throw new Error(`--since takes a number and s, m, h or d (got "${duration}")`);
  return Number(match[1]) * UNITS[match[2]];
}

const LEVELS = { 10: 'trace', 20: 'debug', 30: 'info', 40: 'warn', 50: 'error', 60: 'fatal' };

function prettyLine(line) {
  try {
    const entry = JSON.parse(line);
    const time = new Date(entry.time).toISOString();
    const level = (LEVELS[entry.level] ?? String(entry.level)).padEnd(5);
    const context = entry.context ? `[${entry.context}] ` : '';
    const message = entry.msg ?? entry.message ?? '';
    const extra = entry.err?.stack ? `\n${entry.err.stack}` : '';
    return `${time} ${level} ${context}${message}${extra}`;
  } catch {
    return line;
  }
}

async function main() {
  const query = positionals[0] ?? '{app="api"}';
  const limit = Math.min(5_000, Math.max(1, Number.parseInt(values.limit, 10) || 200));
  const end = BigInt(Date.now()) * 1_000_000n;
  const start = end - BigInt(seconds(values.since)) * 1_000_000_000n;
  const params = new URLSearchParams({
    query,
    start: String(start),
    end: String(end),
    limit: String(limit),
    direction: 'backward',
  });

  let response;
  try {
    response = await fetch(`${values.url}/loki/api/v1/query_range?${params}`);
  } catch (error) {
    throw new Error(
      `Loki is not reachable at ${values.url} (${error.cause?.code ?? error.message}): run pnpm monitoring:up`,
    );
  }
  const body = await response.text();
  if (!response.ok) throw new Error(`Loki refused the query (${response.status}): ${body.trim()}`);

  const { data } = JSON.parse(body);
  if (data.resultType !== 'streams') {
    // A metric query (`rate(…)`, `count_over_time(…)`): print what Loki answered.
    console.log(JSON.stringify(data.result, null, 2));
    return;
  }
  const lines = data.result
    .flatMap((stream) => stream.values.map(([ns, line]) => [BigInt(ns), line]))
    .sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0))
    .map(([, line]) => line);

  const pretty = values.pretty || (!values.raw && process.stdout.isTTY);
  for (const line of lines) console.log(pretty ? prettyLine(line) : line);
  if (lines.length === 0) console.error(`No lines for ${query} in the last ${values.since}.`);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
