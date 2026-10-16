import type { BotMessageEntity, BotToolStep } from '@oppenheimer/frontend-consumer';
import type { TFunction } from 'i18next';
import { toolAction } from './tool-activity';

/**
 * Export (Settings → Profile): a bot's whole chat as a Markdown file. The
 * bot's name, then each message under who wrote it (you, the bot, or
 * Oppenheimer for an event line) and when, the bot's tool activity condensed
 * to one line per call in the words the chat uses. Every word is the
 * caller's `t`, and every time its `formatTime`, so the file reads in the
 * reader's language and time zone.
 */
export interface ChatExport {
  botName: string;
  messages: readonly BotMessageEntity[];
  exportedAt: Date;
  formatTime: (date: Date) => string;
  t: TFunction;
}

/** One call, as the chat's trace says it, marked when it failed. */
function stepLine(step: BotToolStep, t: TFunction): string {
  const action = toolAction(step);
  const said =
    action.kind === 'search'
      ? action.query
        ? t('bots.chat.activity.searchedFor', { query: action.query })
        : t('bots.chat.activity.searched')
      : action.kind === 'plan'
        ? t('bots.chat.activity.planned')
        : action.target
          ? `${action.label} ${action.target}`
          : action.label;
  return `- ${said}${step.isError ? ` (${t('bots.chat.activity.stepFailed')})` : ''}`;
}

function author(message: BotMessageEntity, botName: string, t: TFunction): string {
  if (message.role === 'user') return t('bots.settings.profile.you');
  if (message.role === 'event') return t('bots.settings.profile.oppenheimer');
  return botName;
}

function body(message: BotMessageEntity, t: TFunction): string {
  if (message.role === 'activity') return message.steps.map((step) => stepLine(step, t)).join('\n');
  if (message.role === 'event' && message.event) {
    return t(`bots.chat.event.${message.event.outcome}`, { summary: message.event.summary });
  }
  return message.content.trim();
}

export function chatExportMarkdown({
  botName,
  messages,
  exportedAt,
  formatTime,
  t,
}: ChatExport): string {
  const blocks = [
    `# ${botName}`,
    `_${t('bots.settings.profile.exportedAt', { date: formatTime(exportedAt) })}_`,
  ];
  for (const message of messages) {
    const text = body(message, t);
    if (!text) continue;
    blocks.push(`**${author(message, botName, t)}** · ${formatTime(message.createdAt)}\n\n${text}`);
  }
  return `${blocks.join('\n\n')}\n`;
}

/** `<bot-name>-chat-<yyyy-mm-dd>.md`: the name as a slug, the day in the reader's time zone. */
export function chatExportFilename(botName: string, day: Date): string {
  const slug =
    botName
      .normalize('NFKD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'bot';
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${slug}-chat-${day.getFullYear()}-${pad(day.getMonth() + 1)}-${pad(day.getDate())}.md`;
}
