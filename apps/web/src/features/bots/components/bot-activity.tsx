import { ToolCallGroup, ToolCallRow } from '@oppenheimer/design-system-web';
import { Wrench } from '@oppenheimer/design-system-web/icons';
import type { BotToolStep } from '@oppenheimer/frontend-consumer';
import { useTranslation } from 'react-i18next';
import { toolTarget } from '@/features/bots/lib/chat-turns';

/**
 * A run of tool calls between two of the bot's replies, folded into one line
 * ("Used 3 tools, 1 failed"); open, a row per call whose output folds under
 * it. A call still running says so in place of its output.
 */
export function BotActivity({ steps }: { steps: readonly BotToolStep[] }) {
  const { t } = useTranslation();
  const failed = steps.filter((step) => step.isError).length;
  return (
    <ToolCallGroup
      summary={t('bots.chat.activity.summary', { count: steps.length })}
      failed={failed > 0 ? t('bots.chat.activity.failed', { count: failed }) : undefined}
    >
      {steps.map((step) => (
        <ToolCallRow
          key={step.callId}
          icon={<Wrench />}
          verb={step.name}
          target={toolTarget(step.input)}
          meta={step.output === null ? t('bots.chat.activity.running') : undefined}
          tone={step.isError ? 'danger' : 'default'}
          output={step.output || undefined}
        />
      ))}
    </ToolCallGroup>
  );
}
