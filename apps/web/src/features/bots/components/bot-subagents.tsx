import { Trace, TraceNote, TraceStep } from '@oppenheimer/design-system-web';
import { Bot } from '@oppenheimer/design-system-web/icons';
import type { BotSubagentRun } from '@oppenheimer/shared/schemas/bot';
import { useTranslation } from 'react-i18next';
import { humaniseToolName } from '@/features/bots/lib/tool-activity';

/**
 * The subagents a `delegate` call ran (`25-bots.md` §4.7), under its line: a
 * line per child with its task, how it ended and how long it took, a child
 * that did not complete in red, each opening to what it answered (or why it
 * failed), then the tools it called and the tokens it spent on one line. They are the bot's
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
        const tokens = t('bots.chat.activity.subagentTokens', {
          tokens: run.inputTokens + run.outputTokens,
        });
        const usage = [...run.toolCalls.map(humaniseToolName), tokens].join(', ');
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
            {run.result ? <TraceNote>{run.result}</TraceNote> : null}
            <TraceNote className="text-fg-subtle">{usage}</TraceNote>
          </TraceStep>
        );
      })}
    </Trace>
  );
}
