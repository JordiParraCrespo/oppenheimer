import {
  ComposerContextMeter,
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@oppenheimer/design-system-web';
import { useTranslation } from 'react-i18next';
import { type ChatUsageContext, type ChatUsageLimit, contextPercent } from '../lib/chat-usage';
import { ChatUsageDetails } from './chat-usage-details';

/**
 * How much room an agent has, beside the model on a chat's composer: the
 * context meter, which opens to the context in tokens and the plan's usage
 * limits, the 5-hour and the weekly window, each with when it resets. Each
 * part shows when the caller has it: an agent on an API key has no plan
 * windows, and one whose window is unknown shows its context in tokens
 * alone. The meter reads the context's share, or, with no window, the
 * 5-hour window's. With nothing to read, it draws nothing. `onCompact`, when
 * the agent can be asked to, adds Compact to the context.
 */
export function ChatUsage({
  context,
  fiveHour,
  sevenDay,
  onCompact,
}: {
  context: ChatUsageContext | null;
  fiveHour: ChatUsageLimit | null;
  sevenDay: ChatUsageLimit | null;
  onCompact?: () => void;
}) {
  const { t } = useTranslation();
  const percent = contextPercent(context);
  const shown = percent ?? fiveHour?.usedPercent ?? sevenDay?.usedPercent;
  if (shown === undefined) return null;

  return (
    <Popover>
      <PopoverTrigger
        render={
          <ComposerContextMeter
            value={shown}
            label={t(percent === null ? 'common.chat.usage.openPlan' : 'common.chat.usage.open', {
              percent: Math.round(shown),
            })}
          />
        }
      />
      <PopoverContent side="top" align="end" className="gap-4">
        <ChatUsageDetails
          context={context}
          fiveHour={fiveHour}
          sevenDay={sevenDay}
          onCompact={onCompact}
        />
      </PopoverContent>
    </Popover>
  );
}
