#!/usr/bin/env node
/**
 * Uploads a packaged version to the extension's Chrome Web Store item and
 * submits it for review, through the Web Store API v2:
 *
 *   node scripts/publish.mjs release/oppenheimer-extension-<version>.zip
 *
 * Once Google approves it, Chrome updates every install on its own, within
 * hours. The item keeps the visibility its listing has (unlisted).
 *
 * Reads, from the environment (the release workflow's secrets):
 *   CWS_PUBLISHER_ID, CWS_EXTENSION_ID   which item
 *   CWS_CLIENT_ID, CWS_CLIENT_SECRET,
 *   CWS_REFRESH_TOKEN                    an OAuth grant for the publisher's
 *                                        account, scope `chromewebstore`
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const API = 'https://chromewebstore.googleapis.com';
const ENV = [
  'CWS_PUBLISHER_ID',
  'CWS_EXTENSION_ID',
  'CWS_CLIENT_ID',
  'CWS_CLIENT_SECRET',
  'CWS_REFRESH_TOKEN',
];
const POLL_MS = 5_000;
const POLL_TRIES = 60;

/** The settings, or an error naming every one that is missing. */
export function readConfig(env) {
  const missing = ENV.filter((name) => !env[name]);
  if (missing.length > 0) throw new Error(`missing ${missing.join(', ')}`);
  return Object.fromEntries(ENV.map((name) => [name, env[name]]));
}

/** `publishers/<publisher>/items/<item>`, as the API names an item. */
export function itemName(config) {
  return `publishers/${config.CWS_PUBLISHER_ID}/items/${config.CWS_EXTENSION_ID}`;
}

/**
 * What an upload's answer means: `done` with the version the store now
 * holds, `wait` while it is still being processed, or an error.
 */
export function uploadOutcome(body) {
  switch (body?.uploadState) {
    case 'SUCCEEDED':
      return { done: true, version: body.crxVersion };
    case 'IN_PROGRESS':
      return { done: false };
    default:
      throw new Error(`upload ${body?.uploadState ?? 'failed'}: ${JSON.stringify(body)}`);
  }
}

/** A publish's answer, as the line the workflow prints; a refusal throws. */
export function publishOutcome(body) {
  const state = body?.state;
  if (!['PENDING_REVIEW', 'PUBLISHED', 'STAGED', 'PUBLISHED_TO_TESTERS'].includes(state)) {
    throw new Error(`publish ${state ?? 'failed'}: ${JSON.stringify(body)}`);
  }
  const warnings = (body.warningInfo?.warnings ?? []).map((w) => `${w.reason}: ${w.description}`);
  return [`state ${state}`, ...warnings.map((w) => `warning ${w}`)].join('\n');
}

async function call(url, init, what) {
  const response = await fetch(url, init);
  const text = await response.text();
  if (!response.ok) throw new Error(`${what}: ${response.status} ${text}`);
  return text ? JSON.parse(text) : {};
}

async function accessToken(config) {
  const body = new URLSearchParams({
    client_id: config.CWS_CLIENT_ID,
    client_secret: config.CWS_CLIENT_SECRET,
    refresh_token: config.CWS_REFRESH_TOKEN,
    grant_type: 'refresh_token',
  });
  const { access_token: token } = await call(
    'https://oauth2.googleapis.com/token',
    { method: 'POST', body },
    'token',
  );
  return token;
}

async function main(zipPath) {
  if (!zipPath) throw new Error('usage: publish.mjs <package.zip>');
  const config = readConfig(process.env);
  const item = itemName(config);
  const auth = { Authorization: `Bearer ${await accessToken(config)}` };

  let outcome = uploadOutcome(
    await call(
      `${API}/upload/v2/${item}:upload`,
      { method: 'POST', headers: auth, body: readFileSync(zipPath) },
      'upload',
    ),
  );
  for (let tries = 0; !outcome.done; tries++) {
    if (tries >= POLL_TRIES) throw new Error('upload still in progress after 5 minutes');
    await new Promise((resolve) => setTimeout(resolve, POLL_MS));
    const status = await call(`${API}/v2/${item}:fetchStatus`, { headers: auth }, 'status');
    outcome = uploadOutcome({ uploadState: status.lastAsyncUploadState, crxVersion: '' });
  }
  console.log(`uploaded ${outcome.version || zipPath}`);

  const published = await call(
    `${API}/v2/${item}:publish`,
    {
      method: 'POST',
      headers: { ...auth, 'Content-Type': 'application/json' },
      body: JSON.stringify({ publishType: 'DEFAULT_PUBLISH' }),
    },
    'publish',
  );
  console.log(publishOutcome(published));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main(process.argv[2]).catch((error) => {
    console.error(`publish: ${error.message}`);
    process.exit(1);
  });
}
