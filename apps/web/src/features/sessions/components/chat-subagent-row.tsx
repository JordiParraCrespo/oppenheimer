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
import { ChatToolTarget } from './chat-tool-target';
import { ElapsedClock } from './elapsed-clock';

/** How the row draws one block of the subagent's own work: the turn's own block. */
export type SubagentBlock = ComponentType<{ block: ChatBlock; live: boolean; last: boolean }>;

/**
 * One subagent a call started, the way the terminal's footer lists them: its
 * task, its kind and model, how it stands with its clock, what it is doing
 * now or how it ended, and the calls it made and the tokens it holds. When
 * the host sent its work, the task opens to it, drawn as a turn's blocks are.
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
  const activity = subagentActivityOf(subagent);
  const note = [
    subagent && subagent.calls > 0
      ? t('sessions.chat.subagents.calls', { count: subagent.calls })
      : null,
    subagent?.tokens
      ? t('sessions.chat.subagents.tokens', { tokens: formatTokens(subagent.tokens, locale) })
      : null,
  ]
    .filter(Boolean)
    .join(' · ');
  const blocks =
    subagent && subagent.steps.length > 0 ? blocksOf(subagentTurnOf(subagent, running)) : [];

  return (
    <SubagentRow
      name={name}
      role={role}
      model={modelName(subagent?.model ?? null) ?? undefined}
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
            {t(`sessions.chat.verbLive.${groupKindOf(activity.kind)}`)}{' '}
            <ChatToolTarget call={activity} />
          </>
        ) : undefined
      }
      outcome={running ? undefined : (subagentOutcomeOf(call) ?? undefined)}
      note={note || undefined}
    >
      {blocks.length > 0
        ? blocks.map((block, index) => (
            <Block key={block.id} block={block} live={running} last={index === blocks.length - 1} />
          ))
        : undefined}
    </SubagentRow>
  );
}
