#!/usr/bin/env node
// How good is dictation, on real voices, against Wispr Flow?
//
// Each case in `cases.json` is one recorded clip (a 16-bit PCM WAV under
// `clips/`), what its speaker meant to type (`expected`), the names the
// screen would have shown (`vocabulary`), the ones that must come out
// spelled right (`names`), and optionally what Wispr Flow wrote for the same
// clip (`wispr`). The runner sends every clip through the real pipeline,
// `POST /v1/voice/transcriptions` on a running API, exactly as the console
// does, and scores:
//   wer      word error rate of the answer against `expected`, after both are
//            lowercased and stripped of punctuation and backticks: what the
//            person would have had to fix. Also for the raw transcript (the
//            speech model alone) and for Wispr Flow's text, when given.
//   names    the share of `names` that appear in the answer exactly as written
//   latency  the request's time, stop to text, as the console waits for it
// A case passes when its answer's WER is no worse than Wispr Flow's (or under
// 10 % where there is no Wispr text) and every name is right.
//
//   node scripts/evals/voice/run.mjs                    every case
//   node scripts/evals/voice/run.mjs --case <id>        one case
//   node scripts/evals/voice/run.mjs --grade <report>   re-score a saved report
//   env: VOICE_EVAL_API (default http://localhost:3000/api),
//        VOICE_EVAL_TOKEN (an API token with sessions:write; required)
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const PASS_WER = 0.1;

function arg(name) {
  const at = process.argv.indexOf(`--${name}`);
  return at === -1 ? undefined : process.argv[at + 1];
}

/** The words a person would have to fix: lowercased, without punctuation or backticks. */
export function wordsOf(text) {
  return text
    .normalize('NFC')
    .toLowerCase()
    .replace(/[`"“”«»¿?¡!.,;:()[\]{}]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
}

/** Word error rate: the edits (substitutions, insertions, deletions) per word of `expected`. */
export function wer(expected, actual) {
  const want = wordsOf(expected);
  const got = wordsOf(actual);
  if (want.length === 0) return got.length === 0 ? 0 : 1;
  let previous = Array.from({ length: got.length + 1 }, (_, j) => j);
  for (let i = 1; i <= want.length; i++) {
    const row = [i];
    for (let j = 1; j <= got.length; j++) {
      const swap = previous[j - 1] + (want[i - 1] === got[j - 1] ? 0 : 1);
      row.push(Math.min(swap, previous[j] + 1, row[j - 1] + 1));
    }
    previous = row;
  }
  return previous[got.length] / want.length;
}

function percentile(values, p) {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))];
}

const mean = (values) =>
  values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
const pct = (value) => (value === null ? '—' : `${(value * 100).toFixed(1)} %`);

async function transcribe(api, token, testCase) {
  const form = new FormData();
  const audio = readFileSync(join(HERE, testCase.clip));
  form.append('audio', new Blob([audio], { type: 'audio/wav' }), 'dictation.wav');
  if (testCase.vocabulary?.length) form.append('vocabulary', testCase.vocabulary.join('\n'));
  const started = performance.now();
  const response = await fetch(`${api}/v1/voice/transcriptions`, {
    method: 'POST',
    headers: { authorization: `Bearer ${token}` },
    body: form,
  });
  const latencyMs = Math.round(performance.now() - started);
  const body = await response.text();
  if (!response.ok) return { error: `${response.status} ${body.slice(0, 200)}`, latencyMs };
  const { text, raw, provider, polished } = JSON.parse(body);
  return { text, raw, provider, polished, latencyMs };
}

function score(testCase, answer) {
  if (answer.error) return { ...answer, pass: false };
  const names = testCase.names ?? [];
  const namesRight = names.filter((name) => answer.text.includes(name)).length;
  const result = {
    ...answer,
    wer: wer(testCase.expected, answer.text),
    rawWer: wer(testCase.expected, answer.raw),
    wisprWer: testCase.wispr === undefined ? null : wer(testCase.expected, testCase.wispr),
    names: names.length ? namesRight / names.length : null,
  };
  const bar = result.wisprWer ?? PASS_WER;
  result.pass = result.wer <= bar + 1e-9 && namesRight === names.length;
  return result;
}

function summarise(results) {
  const ok = results.filter((result) => !result.error);
  const rows = results.map((result) =>
    result.error
      ? `| ${result.id} | error | | | | | ${result.error} |`
      : `| ${result.id} | ${result.pass ? '✅' : '❌'} | ${pct(result.wer)} | ${pct(result.rawWer)} | ${pct(result.wisprWer)} | ${pct(result.names)} | ${result.latencyMs} ms |`,
  );
  const latencies = ok.map((result) => result.latencyMs);
  return [
    '| Case | Pass | WER | Raw WER | Wispr WER | Names | Latency |',
    '| --- | --- | --- | --- | --- | --- | --- |',
    ...rows,
    '',
    `Passed ${results.filter((result) => result.pass).length} of ${results.length}.`,
    `Mean WER ${pct(mean(ok.map((result) => result.wer)))} (raw ${pct(mean(ok.map((result) => result.rawWer)))}, Wispr Flow ${pct(mean(ok.map((result) => result.wisprWer).filter((value) => value !== null)))}).`,
    `Names right ${pct(mean(ok.map((result) => result.names).filter((value) => value !== null)))}.`,
    `Latency p50 ${percentile(latencies, 50) ?? '—'} ms, p90 ${percentile(latencies, 90) ?? '—'} ms.`,
  ].join('\n');
}

async function main() {
  const graded = arg('grade');
  if (graded) {
    const report = JSON.parse(readFileSync(graded, 'utf8'));
    const cases = new Map(report.cases.map((testCase) => [testCase.id, testCase]));
    console.log(
      summarise(
        report.results.map((result) => ({ id: result.id, ...score(cases.get(result.id), result) })),
      ),
    );
    return;
  }

  // biome-ignore lint/suspicious/noUndeclaredEnvVars: a root script, not a Turborepo task — nothing caches its output.
  const token = process.env.VOICE_EVAL_TOKEN;
  if (!token) throw new Error('Set VOICE_EVAL_TOKEN to an API token with sessions:write.');
  // biome-ignore lint/suspicious/noUndeclaredEnvVars: as above.
  const base = process.env.VOICE_EVAL_API ?? 'http://localhost:3000/api';
  const api = base.replace(/\/+$/, '');
  let cases;
  try {
    cases = JSON.parse(readFileSync(join(HERE, 'cases.json'), 'utf8'));
  } catch {
    throw new Error('No cases.json: copy cases.example.json and record its clips (README.md).');
  }
  const only = arg('case');
  if (only) cases = cases.filter((testCase) => testCase.id === only);

  const results = [];
  for (const testCase of cases) {
    const answer = await transcribe(api, token, testCase);
    results.push({ id: testCase.id, ...score(testCase, answer) });
    console.error(`${testCase.id}: ${answer.error ?? answer.text}`);
  }

  const summary = summarise(results);
  console.log(summary);
  const dir = join(HERE, 'reports');
  mkdirSync(dir, { recursive: true });
  const file = join(dir, `${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
  writeFileSync(file, `${JSON.stringify({ api, cases, results }, null, 2)}\n`);
  console.error(`Report: ${file}`);
  if (results.some((result) => !result.pass)) process.exitCode = 1;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
}
