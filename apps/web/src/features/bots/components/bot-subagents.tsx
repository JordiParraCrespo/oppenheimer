import { Trace, TraceNote, TraceStep } from '@oppenheimer/design-system-web';
import { Bot } from '@oppenheimer/design-system-web/icons';
import type { BotSubagentRun } from '@oppenheimer/shared/schemas/bot';
import { useTranslation } from 'react-i18next';
import { humaniseToolName } from '@/features/bots/lib/tool-activity';

/**
 * The subagents a `delegate` call ran (`25-bots.md` §4.7), under its line: a
 * line per child with its task, how it ended and how long it took, a child
 * that did not complete in red, each opening to what it answered (or why it
 * failed), the tools it called and the tokens it spent. They are the bot's
 * helpers inside one turn, not bots or sessions: nothing here links away.
 */
export function BotSubagents({ runs }: { runs: readonly BotSubagentRun[] }) {
  const { t } = useTranslation();
  return (
    <Trace className="pb-1">
      {runs.map((run, index) => {
        const seconds = t('bots.chat.activity.seconds', {
          count: Math.max(1, Math.round(run.durationMs / 1_000)),
        });
        const ok = run.status === 'completed';
        const tools = run.toolCalls.map(humaniseToolName).join(', ');
        return (
          <TraceStep
            // A call's runs keep their order and never change once stored.
            // biome-ignore lint/suspicious/noArrayIndexKey: two tasks may read the same
            key={index}
            icon={<Bot />}
            title={run.task}
            meta={ok ? seconds : `${t(`bots.chat.activity.subagent.${run.status}`)} · ${seconds}`}
            tone={ok ? 'default' : 'danger'}
          >
            <TraceNote>{run.result || t('bots.chat.activity.subagentSilent')}</TraceNote>
            <TraceNote className="text-fg-subtle">
              {t('bots.chat.activity.subagentUsage', {
                tools: tools || t('bots.chat.activity.subagentNoTools'),
                tokens: run.inputTokens + run.outputTokens,
              })}
            </TraceNote>
          </TraceStep>
        );
      })}
    </Trace>
  );
}
