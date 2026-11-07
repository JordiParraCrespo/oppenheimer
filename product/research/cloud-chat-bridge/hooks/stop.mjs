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
// It waits up to OPPENHEIMER_REPLY_WAIT seconds (default 30, at most 120) for a reply, so
// one typed just after the turn ends still lands; with none it lets the agent
// stop. The hook's own `timeout` in settings must be longer than the wait.
// It never fails the session: whatever happens it exits 0.
import { readFileSync } from 'node:fs';
import { sessionKey } from './session-key.mjs';

async function main() {
  const { OPPENHEIMER_URL: url, OPPENHEIMER_CLOUD_KEY: key } = process.env;
  if (!url || !key) return;
  const input = JSON.parse(readFileSync(0, 'utf8') || '{}');
  const wait = Math.max(0, Math.min(Number(process.env.OPPENHEIMER_REPLY_WAIT ?? 30), 120));

  const response = await fetch(`${url}/api/v1/sessions/cloud-replies/take`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${key}` },
    body: JSON.stringify({ cloudSessionId: sessionKey(input), wait }),
    signal: AbortSignal.timeout((wait + 10) * 1000),
  });
  if (!response.ok) return;
  const { text } = await response.json();
  if (!text) return;

  process.stdout.write(
    JSON.stringify({
      decision: 'block',
      // The console reads a "Stop hook feedback" line carrying this first line
      // as the person's message (CLOUD_REPLY_PREAMBLE in @oppenheimer/shared).
      reason: `The person following this session in Oppenheimer replied:\n\n${text}`,
    }),
  );
}

main()
  .catch(() => {})
  .finally(() => process.exit(0));
