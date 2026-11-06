#!/usr/bin/env node
// Stop hook: when the agent finishes a turn, collect the next reply the person
// typed in Oppenheimer's chat and hand it back, so the agent carries on with
// it instead of stopping.
//
// The reply goes back as a Stop hook's block decision, `{"decision":"block",
// "reason": …}`: Claude Code does not stop, and gives the agent the reason as
// what to do next. That is the documented way a hook steers a session, and it
// needs nothing from claude.ai.
//
// It waits up to OPPENHEIMER_REPLY_WAIT seconds (default 30) for a reply, so
// one typed just after the turn ends still lands; with none it lets the agent
// stop. The hook's own `timeout` in settings must be longer than the wait.
// It never fails the session: whatever happens it exits 0.
import { readFileSync } from 'node:fs';
import { sessionKey } from './session-key.mjs';

async function main() {
  const { OPPENHEIMER_URL: url, OPPENHEIMER_CLOUD_KEY: key } = process.env;
  if (!url || !key) return;
  const input = JSON.parse(readFileSync(0, 'utf8') || '{}');
  const wait = Math.max(0, Math.min(Number(process.env.OPPENHEIMER_REPLY_WAIT ?? 30), 600));

  const response = await fetch(
    `${url}/api/sessions/${sessionKey(input)}/replies/next?wait=${wait}`,
    {
      headers: { authorization: `Bearer ${key}` },
      signal: AbortSignal.timeout((wait + 10) * 1000),
    },
  );
  if (response.status !== 200) return;
  const { text } = await response.json();
  if (!text) return;

  process.stdout.write(
    JSON.stringify({
      decision: 'block',
      reason: `The person following this session in Oppenheimer replied:\n\n${text}`,
    }),
  );
}

main()
  .catch(() => {})
  .finally(() => process.exit(0));
