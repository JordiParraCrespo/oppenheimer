import type {
  SessionTranscriptEntry,
  SessionTranscriptPage,
  SessionTranscriptPart,
  SessionTranscriptReason,
  SessionTranscriptRole,
  SessionTranscriptStatus,
} from '@oppenheimer/shared';
import type { HostTranscriptPage } from './application/session-transcript.port';

type Loose = Record<string, unknown>;

function recordOf(value: unknown): Loose {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Loose)
    : {};
}

function textOf(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

/** A timestamp the transcript carried, if it is one; never a guess. */
function timeOf(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const at = new Date(value);
  return Number.isNaN(at.getTime()) ? null : at.toISOString();
}

/**
 * A session's conversation as the runner sends it, in the shape a reader
 * outside the console gets (`SessionTranscriptEntry`). The runner's entries
 * are Claude Code's transcript lines, compacted on the host and already in
 * that one shape for every agent (`attachment.chat`); this narrows each one
 * once, and drops what is not a message (a malformed line, the status line
 * the chat view also reads).
 */
export class SessionTranscriptMapper {
  /** A page read off the host, its entries already narrowed and redacted. */
  static toPage(
    page: HostTranscriptPage,
    read: {
      entries: SessionTranscriptEntry[];
      status: SessionTranscriptStatus;
      redactions: number;
      nextCursor: string | null;
    },
  ): SessionTranscriptPage {
    return {
      status: read.status,
      reason: null,
      detail: null,
      vendorUrl: null,
      entries: read.entries,
      nextCursor: read.nextCursor,
      atEnd: page.atEnd,
      restarted: page.restarted ?? false,
      dropped: page.dropped ?? 0,
      redactions: read.redactions,
    };
  }

  /** An answer with nothing read, and why. */
  static unread(
    status: SessionTranscriptStatus,
    reason: SessionTranscriptReason,
    extra: { detail?: string | null; vendorUrl?: string | null } = {},
  ): SessionTranscriptPage {
    return {
      status,
      reason,
      detail: extra.detail ?? null,
      vendorUrl: extra.vendorUrl ?? null,
      entries: [],
      nextCursor: null,
      atEnd: false,
      restarted: false,
      dropped: 0,
      redactions: 0,
    };
  }

  /** The entries a page carried, oldest first; one that is not a message is left out. */
  static toEntries(raw: readonly string[]): SessionTranscriptEntry[] {
    return raw.flatMap((line) => {
      const entry = SessionTranscriptMapper.toEntry(line);
      return entry ? [entry] : [];
    });
  }

  static toEntry(line: string): SessionTranscriptEntry | null {
    let parsed: unknown;
    try {
      parsed = JSON.parse(line);
    } catch {
      return null;
    }
    const entry = recordOf(parsed);
    const message = recordOf(entry.message);
    if (!entry.message) return null;
    const parts = SessionTranscriptMapper.toParts(message.content);
    if (parts.length === 0) return null;
    return {
      id: textOf(entry.uuid),
      at: timeOf(entry.timestamp),
      role: SessionTranscriptMapper.roleOf(message.role, entry.type),
      parts,
    };
  }

  private static roleOf(role: unknown, type: unknown): SessionTranscriptRole {
    if (role === 'user' || role === 'assistant') return role;
    if (type === 'user' || type === 'assistant') return type;
    return 'system';
  }

  private static toParts(content: unknown): SessionTranscriptPart[] {
    if (typeof content === 'string') {
      return content ? [SessionTranscriptMapper.part('text', content)] : [];
    }
    if (!Array.isArray(content)) return [];
    return content.flatMap((value): SessionTranscriptPart[] => {
      const block = recordOf(value);
      const truncated = block.truncated === true;
      switch (block.type) {
        case 'text': {
          const text = textOf(block.text);
          return text ? [SessionTranscriptMapper.part('text', text, { truncated })] : [];
        }
        case 'thinking': {
          const text = textOf(block.thinking);
          return text ? [SessionTranscriptMapper.part('thinking', text, { truncated })] : [];
        }
        case 'tool_use':
          return [
            SessionTranscriptMapper.part('tool_call', SessionTranscriptMapper.json(block.input), {
              tool: textOf(block.name),
              truncated,
            }),
          ];
        case 'tool_result':
          return [
            SessionTranscriptMapper.part('tool_result', textOf(block.content) ?? '', {
              isError: block.is_error === true,
              truncated,
            }),
          ];
        case 'image':
          return [SessionTranscriptMapper.part('image', null)];
        default:
          return [];
      }
    });
  }

  private static part(
    kind: SessionTranscriptPart['kind'],
    text: string | null,
    extra: Partial<Pick<SessionTranscriptPart, 'tool' | 'isError' | 'truncated'>> = {},
  ): SessionTranscriptPart {
    return {
      kind,
      text,
      tool: extra.tool ?? null,
      isError: extra.isError ?? false,
      truncated: extra.truncated ?? false,
    };
  }

  private static json(value: unknown): string {
    if (value === undefined) return '{}';
    try {
      return JSON.stringify(value);
    } catch {
      return '{}';
    }
  }
}
