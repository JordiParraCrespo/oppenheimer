import type { SessionTranscriptEntry, SessionTranscriptPage } from '@oppenheimer/shared';
import { promptText } from './bot-prompt-text.policy';
import { cut, fenceUntrusted, formatToolTime, RUNNER_TOO_OLD_ADVICE } from './bot-tool-text.policy';

/**
 * A page of a session's conversation, as `read_session_transcript` words it
 * for the model: what Oppenheimer
 * says about the page in its own words, the conversation fenced as the
 * session's output, and how to read on. Pure.
 */

/** The longest one part is quoted: a bot reads the gist, and the next page for more. */
const PART_QUOTE_MAX = 1_500;

/** Why there is nothing to read, in words the model can act on. */
const REASON_PHRASES = {
  cloud_vendor: promptText('sessions/tools-transcript.unreadable-cloud-vendor'),
  agent_keeps_none: promptText('sessions/tools-transcript.unreadable-agent-keeps-none'),
  runner_too_old: promptText('sessions/tools-transcript.unreadable-runner-too-old', {
    runnerTooOldAdvice: RUNNER_TOO_OLD_ADVICE,
  }),
  host_offline: 'its host is offline',
  timed_out: promptText('sessions/tools-transcript.unreadable-timed-out'),
  host_refused: promptText('sessions/tools-transcript.unreadable-host-refused'),
} as const satisfies Record<NonNullable<SessionTranscriptPage['reason']>, string>;

function describePart(part: SessionTranscriptEntry['parts'][number]): string {
  const text = part.text === null ? '' : cut(part.text, PART_QUOTE_MAX);
  const truncated = part.truncated ? ' (cut on the host)' : '';
  switch (part.kind) {
    case 'text':
      return `${text}${truncated}`;
    case 'thinking':
      return `(thinking) ${text}${truncated}`;
    case 'tool_call':
      return `(calls ${part.tool ?? 'a tool'}) ${text}${truncated}`;
    case 'tool_result':
      return `(${part.isError ? 'tool error' : 'tool result'}) ${text}${truncated}`;
    case 'image':
      return '(an image)';
  }
}

function describeEntry(entry: SessionTranscriptEntry, timeZone: string): string {
  const at = entry.at ? `[${formatToolTime(entry.at, timeZone)}] ` : '';
  return `${at}${entry.role}: ${entry.parts.map(describePart).join('\n  ')}`;
}

/** The tool's answer for one page of a session's conversation. */
export function describeTranscriptPage(
  session: { id: string; name: string },
  page: SessionTranscriptPage,
  timeZone: string,
): string {
  const head = `Session ${session.id} "${session.name.replace(/[\r\n"]+/g, ' ')}"`;
  if (page.status === 'unsupported' || page.status === 'unavailable') {
    const why = page.reason ? REASON_PHRASES[page.reason] : 'it could not be read';
    const where = page.vendorUrl ? ` Read it at ${page.vendorUrl}.` : '';
    const again =
      page.status === 'unavailable'
        ? ` ${promptText('sessions/tools-transcript.page-try-again')}`
        : '';
    return promptText('sessions/tools-transcript.page-unreadable', { head, why, where, again });
  }
  const lines = [
    page.entries.length
      ? promptText('sessions/tools-transcript.page-header', {
          head,
          entriesCount: String(page.entries.length),
        })
      : `${head}: nothing ${page.restarted ? 'in its current conversation' : 'new'} yet.`,
  ];
  if (page.restarted) {
    lines.push(promptText('sessions/tools-transcript.page-started-over'));
  }
  if (page.entries.length) {
    lines.push(
      fenceUntrusted(
        'session_transcript',
        page.entries.map((entry) => describeEntry(entry, timeZone)).join('\n'),
      ),
    );
  }
  if (page.hasEarlier) {
    lines.push(promptText('sessions/tools-transcript.page-earlier-turns'));
  }
  if (page.status === 'partial') {
    const left = page.dropped
      ? ` ${promptText('sessions/tools-transcript.page-entries-dropped', { dropped: String(page.dropped) })}`
      : '';
    lines.push(promptText('sessions/tools-transcript.page-partial', { left }));
  }
  if (page.redactions)
    lines.push(
      promptText('sessions/tools-transcript.page-redacted', {
        redactions: String(page.redactions),
      }),
    );
  if (page.nextCursor) {
    lines.push(
      page.atEnd
        ? promptText('sessions/tools-transcript.page-end', {
            nextCursor: page.nextCursor,
          })
        : promptText('sessions/tools-transcript.page-more', {
            nextCursor: page.nextCursor,
          }),
    );
  }
  return lines.join('\n');
}
