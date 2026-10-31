import { Trace, TraceNote, TraceStep } from '@oppenheimer/design-system-web';
import { Bot, Clock, LoaderCircle } from '@oppenheimer/design-system-web/icons';
import { humaniseToolName } from '@oppenheimer/frontend-consumer';
import type { BotSubagentProgress } from '@oppenheimer/shared/schemas/bot';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { BotTurnClock } from '@/features/bots/components/bot-turn-clock';

/** A child's glyph: waiting, at work, or ended (a bot, as its stored line draws it). */
const GLYPH: Record<BotSubagentProgress['state'], ReactNode> = {
  queued: <Clock />,
  running: <LoaderCircle className="motion-safe:animate-spin" />,
  completed: <Bot />,
  failed: <Bot />,
  cancelled: <Bot />,
  timed_out: <Bot />,
};

/**
 * The children of the `delegate` call running now, under the turn's live
 * line, hung from a hairline like a group's steps: a line per child with its
 * task, whether it waits, runs (its clock beside it) or ended (how, and how
 * long it took), each opening to the tools it has called so far. Once the
 * call ends its stored line draws them instead (`BotSubagents`).
 */
export function BotSubagentsLive({ runs }: { runs: readonly BotSubagentProgress[] }) {
  const { t } = useTranslation();
  return (
    <div className="ml-1.75 border-l border-border-subtle pl-4.5">
      <Trace>
        {runs.map((run, index) => {
          const ended = run.state !== 'queued' && run.state !== 'running';
          const state = t(`bots.chat.activity.subagent.${run.state}`);
          const meta =
            run.state === 'running' && run.startedAt ? (
              <BotTurnClock since={new Date(run.startedAt)} />
            ) : ended && run.durationMs !== null ? (
              `${state} · ${t('bots.chat.activity.seconds', {
                count: Math.max(1, Math.round(run.durationMs / 1_000)),
              })}`
            ) : (
              state
            );
          return (
            <TraceStep
              // A call's children keep their order for its whole run.
              // biome-ignore lint/suspicious/noArrayIndexKey: two tasks may read the same
              key={index}
              icon={GLYPH[run.state]}
              title={run.task}
              meta={meta}
              tone={ended && run.state !== 'completed' ? 'danger' : 'default'}
            >
              <TraceNote>
                {run.toolCalls.length > 0
                  ? t('bots.chat.activity.subagentCalled', {
                      tools: run.toolCalls.map(humaniseToolName).join(', '),
                    })
                  : t('bots.chat.activity.subagentNoCalls')}
              </TraceNote>
            </TraceStep>
          );
        })}
      </Trace>
    </div>
  );
}
