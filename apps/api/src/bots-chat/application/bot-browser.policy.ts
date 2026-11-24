import { createHash } from 'node:crypto';
import type { BrowserAction } from '@oppenheimer/shared/protocol';
import type {
  HostBrowserOutcome,
  HostBrowserPage,
} from '../../sessions/application/host-browser.port';
import { promptText } from '../domain/bot-prompt-text.policy';
import { cut, fenceUntrusted } from '../domain/bot-tool-text.policy';

/** A `use_browser` call as its words are drawn from: the action and what it carries. */
export interface BrowserCall {
  action: BrowserAction;
  url?: string;
  ref?: string;
  x?: number;
  y?: number;
  scroll_y?: number;
  text?: string;
  keys?: readonly string[];
  seconds?: number;
}

type Field = keyof Omit<BrowserCall, 'action'>;

/** One action of `use_browser`: what a call of it must carry, and how a card says it. */
interface BrowserActionSpec {
  /** Whether the call has what the action needs. */
  whole: (call: BrowserCall) => boolean;
  /** The fields it sends to the host when given. */
  carries: readonly Field[];
  /** What to tell the model when a part is missing. */
  missing: string;
  /** The card's words, up to the browser they act in: "Open https://… in". */
  says: (call: BrowserCall) => string;
}

const always = () => true;
const target = (call: BrowserCall) => (call.ref ? call.ref : `(${call.x}, ${call.y})`);

/**
 * The actions, once: the tool's checks, its card and the request it sends
 * are all read from this table, so a new action is a row here (and its case
 * in the runner's browser adapter, which the link's schema names).
 */
export const BROWSER_ACTION_SPECS: Readonly<Record<BrowserAction, BrowserActionSpec>> = {
  open: {
    whole: (call) => Boolean(call.url),
    carries: ['url'],
    missing: 'open needs url.',
    says: (call) => `Open ${cut(call.url ?? '', 200)} in`,
  },
  read: { whole: always, carries: [], missing: '', says: () => 'Read the page in' },
  screenshot: { whole: always, carries: [], missing: '', says: () => 'Look at the page in' },
  click: {
    whole: (call) => Boolean(call.ref) || (call.x !== undefined && call.y !== undefined),
    carries: ['ref', 'x', 'y'],
    missing: promptText('browser/tools.click-needs'),
    says: (call) => `Click ${target(call)} in`,
  },
  type: {
    whole: (call) => Boolean(call.text),
    carries: ['ref', 'text'],
    missing: 'type needs text.',
    says: (call) =>
      `Type \`${cut(call.text ?? '', 200)}\`${call.ref ? ` into ${call.ref}` : ''} in`,
  },
  key: {
    whole: (call) => Boolean(call.keys?.length),
    carries: ['keys'],
    missing: 'key needs keys.',
    says: (call) => `Press ${(call.keys ?? []).join(', ')} in`,
  },
  scroll: {
    whole: (call) => Boolean(call.scroll_y),
    carries: ['scroll_y'],
    missing: 'scroll needs scroll_y.',
    says: () => 'Scroll the page in',
  },
  back: { whole: always, carries: [], missing: '', says: () => 'Go back a page in' },
  wait: {
    whole: always,
    carries: ['seconds'],
    missing: '',
    says: (call) => promptText('browser/tools.card-wait', { seconds: String(call.seconds ?? 0) }),
  },
  close: { whole: always, carries: [], missing: '', says: () => 'Close' },
};

/** What the action is missing, in words the model can fix it from; null when it is whole. */
export function browserCallProblem(call: BrowserCall): string | null {
  const spec = BROWSER_ACTION_SPECS[call.action];
  return spec.whole(call) ? null : spec.missing;
}

/** The fields a call of its action sends to the host. */
export function browserCallFields(call: BrowserCall): readonly Field[] {
  return BROWSER_ACTION_SPECS[call.action].carries;
}

/** The Needs input card's line: "Open https://example.com in your browser on build-02". */
export function browserSummary(call: BrowserCall, host: string): string {
  return `${BROWSER_ACTION_SPECS[call.action].says(call)} its browser on ${host}`;
}

/**
 * Each refusal the runner makes: what it means, said plainly, and what to
 * tell the person when only they can change it.
 */
const REFUSALS: Readonly<Record<string, { meaning: string; advice?: string }>> = {
  BROWSER_001: {
    meaning: promptText('browser/tools.refusals-browser-001'),
    advice: promptText('browser/tools.refusals-browser-001-advice'),
  },
  BROWSER_002: {
    meaning: promptText('browser/tools.refusals-browser-002'),
    advice: promptText('browser/tools.refusals-browser-002-advice'),
  },
  BROWSER_003: { meaning: promptText('browser/tools.refusals-browser-003') },
  BROWSER_005: {
    meaning: promptText('browser/tools.refusals-browser-005'),
    advice: promptText('browser/tools.refusals-browser-005-advice'),
  },
};

/** The page as the model reads it: where it is, what can be acted on, what it says. */
function pageText(page: HostBrowserPage): string {
  const lines = [`Page: ${page.title || '(no title)'}`, `Address: ${page.url}`];
  const elements = page.elements ?? [];
  if (elements.length > 0) {
    lines.push('', promptText('browser/tools.page-elements'));
    for (const element of elements) {
      const value = element.value ? ` = ${JSON.stringify(element.value)}` : '';
      lines.push(`${element.ref} ${element.role} ${JSON.stringify(element.name)}${value}`);
    }
    if (page.moreElements) lines.push(promptText('browser/tools.page-more-elements'));
  } else {
    lines.push('', promptText('browser/tools.page-no-elements'));
  }
  if (page.text) {
    lines.push('', `Text of the page${page.textTruncated ? ' (its first part)' : ''}:`, page.text);
  }
  return lines.join('\n');
}

/**
 * What a `use_browser` call came to, in words the model reads. `pictured`
 * says a picture of the page rides the answer. Everything a page says is
 * outside content: it is fenced, and the words say it is never an instruction.
 */
export function describeBrowser(
  outcome: HostBrowserOutcome,
  host: string,
  pictured: boolean,
): string {
  switch (outcome.kind) {
    case 'page': {
      if (outcome.page.closed) return `Closed your browser on ${host}.`;
      const picture = pictured ? ` ${promptText('browser/tools.pictured')}` : '';
      const done = promptText('browser/tools.done', { host, picture });
      return `${done}\n${fenceUntrusted('browser_page', pageText(outcome.page))}`;
    }
    case 'host_offline':
      return promptText('browser/tools.host-offline', { host });
    case 'not_supported':
      return promptText('browser/tools.runner-too-old', { host });
    case 'timed_out':
      return promptText('browser/tools.timed-out', { host });
    case 'failed': {
      const known = REFUSALS[outcome.code];
      const code = known ? `${outcome.code}: ${known.meaning}` : outcome.code;
      return [
        `${host} refused (${code}): ${outcome.detail ?? 'no reason given'}.`,
        known ? 'Nothing was done.' : promptText('browser/tools.may-have-happened'),
        known?.advice,
      ]
        .filter(Boolean)
        .join(' ');
    }
  }
}

/**
 * The `browser.act` command id of an approved call: the same for every retry
 * of that approval's job, so a worker that crashed after the host clicked
 * gets that action's page back instead of clicking a second time with no
 * second approval. UUID-shaped, as the link's command ids are.
 */
export function browserCommandIdOf(approvalId: string): string {
  const hex = createHash('sha256').update(`browser.act:${approvalId}`).digest('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-8${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}
