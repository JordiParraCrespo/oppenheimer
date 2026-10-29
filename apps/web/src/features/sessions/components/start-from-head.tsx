import { AgentMark, ChipSelectBack, ChipSelectHeading } from '@oppenheimer/design-system-web';
import type { HostCloudAgentId } from '@oppenheimer/shared/agents';
import { useTranslation } from 'react-i18next';
import { hostCloudCopy } from '../lib/session-options';

/**
 * The head of a host cloud's Start from pane: the way back to the clouds,
 * naming whose cloud it is with its mark, and the pane's heading
 * (`product/versions/mvp/24-session-places.md` §7).
 */
export function StartFromHead({ agent, onBack }: { agent: HostCloudAgentId; onBack: () => void }) {
  const { t } = useTranslation();
  const copy = hostCloudCopy(agent).where;
  return (
    <>
      <ChipSelectBack onClick={onBack}>
        <span className="flex items-center gap-2">
          <AgentMark agent={agent} />
          {t(copy.label)}
        </span>
      </ChipSelectBack>
      <ChipSelectHeading>{t(copy.startFrom)}</ChipSelectHeading>
    </>
  );
}
