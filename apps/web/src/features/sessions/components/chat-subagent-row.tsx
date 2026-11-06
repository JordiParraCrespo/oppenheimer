import { SubagentRow } from '@oppenheimer/design-system-web';
import type { ChatToolCall } from '@oppenheimer/frontend-consumer';
import { formatTokens, useLocale } from '@oppenheimer/frontend-web';
import type { ComponentType } from 'react';
import { useTranslation } from 'react-i18next';
import {
  blocksOf,
  type ChatBlock,
  formatChatElapsed,
  groupKindOf,
  modelName,
} from '../lib/chat-blocks';
import {
  subagentActivityOf,
  subagentOutcomeOf,
  subagentSpanOf,
  subagentStateOf,
  subagentTurnOf,
} from '../lib/chat-subagents';
import { ElapsedClock } from './elapsed-clock';

/** How the row draws one block of the subagent's own work: the turn's own block. */
export type SubagentBlock = ComponentType<{ block: ChatBlock; live: boolean; last: boolean }>;

/**
 * One subagent a call started, on one line as the terminal lists them under
 * its prompt: how it stands, its kind, its task, what it is doing now while
 * it runs (or, with no work to open, how it ended), and its clock and the
 * tokens it holds. When the host sent its work, the line opens to it: the
 * model and the calls it made, then its steps, drawn as a turn's blocks are.
 */
export function ChatSubagentRow({ call, Block }: { call: ChatToolCall; Block: SubagentBlock }) {
  const { t } = useTranslation();
  const locale = useLocale();
  const subagent = call.subagent;
  const state = subagentStateOf(call);
  const running = state === 'running';
  const name = call.description ?? call.target ?? t('sessions.chat.subagents.untitled');
  const kind = subagent?.type ?? (call.target !== name ? call.target : null);
  const role = [subagent?.name, kind].filter(Boolean).join(' · ') || undefined;
  const { from, to } = subagentSpanOf(call);
  const activity = running ? subagentActivityOf(subagent) : null;
  const blocks =
    subagent && subagent.steps.length > 0 ? blocksOf(subagentTurnOf(subagent, running)) : [];
  const facts = [
    modelName(subagent?.model ?? null),
    subagent && subagent.calls > 0
      ? t('sessions.chat.subagents.calls', { count: subagent.calls })
      : null,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <SubagentRow
      name={name}
      role={role}
      state={state === 'stopped' ? 'failed' : state}
      stateLabel={t(`sessions.chat.subagents.state.${state}`)}
      elapsed={
        running && from ? (
          <ElapsedClock since={from} ticking format={formatChatElapsed} />
        ) : from && to ? (
          formatChatElapsed(to.getTime() - from.getTime())
        ) : undefined
      }
      activity={
        activity ? (
          <>
            {t(`sessions.chat.verbLive.${groupKindOf(activity.kind)}`)} {nameOf(activity.target)}
          </>
        ) : undefined
      }
      outcome={blocks.length > 0 ? undefined : (subagentOutcomeOf(call) ?? undefined)}
      note={
        subagent?.tokens
          ? t('sessions.chat.subagents.tokens', { tokens: formatTokens(subagent.tokens, locale) })
          : undefined
      }
    >
      {blocks.length > 0 ? (
        <>
          {facts ? <p className="m-0 text-[12px] text-fg-subtle">{facts}</p> : null}
          {blocks.map((block, index) => (
            <Block key={block.id} block={block} live={running} last={index === blocks.length - 1} />
          ))}
        </>
      ) : undefined}
    </SubagentRow>
  );
}

/** What a call acted on, short: a path's last part, a command's first line. */
function nameOf(target: string | null): string {
  const line = target?.split('\n')[0]?.trim() ?? '';
  return /^[^\s]+\/[^\s/]+$/.test(line) ? (line.split('/').at(-1) ?? line) : line;
}
