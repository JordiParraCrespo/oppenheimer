import {
  Callout,
  Disclosure,
  DisclosurePanel,
  DisclosureTrigger,
  JsonTree,
} from '@oppenheimer/design-system-web';
import type { BotApprovalDetails } from '@oppenheimer/frontend-consumer';
import { useTranslation } from 'react-i18next';

/**
 * What a Needs input card says past its line (`25-bots.md` §5): why a rule
 * paused the call, that it sends something out of Oppenheimer, and the call
 * exactly as it will run, folded.
 */
export function ApprovalRequestDetails({ details }: { details: BotApprovalDetails }) {
  const { t } = useTranslation();
  return (
    <>
      {details.reviewNote ? <Callout>{details.reviewNote}</Callout> : null}
      {details.sharesOutside ? (
        <p className="m-0 text-xs text-fg-muted">{t('bots.chat.approval.sharesOutside')}</p>
      ) : null}
      <Disclosure>
        <DisclosureTrigger tone="muted">{t('bots.chat.approval.fullRequest')}</DisclosureTrigger>
        <DisclosurePanel>
          <JsonTree value={details.input} />
        </DisclosurePanel>
      </Disclosure>
    </>
  );
}
