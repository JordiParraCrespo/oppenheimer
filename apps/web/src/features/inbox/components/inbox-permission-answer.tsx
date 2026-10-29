import { ApprovalCommand, Button, InboxMessageChoices } from '@oppenheimer/design-system-web';
import type { SessionPermissionDecision } from '@oppenheimer/shared/schemas/session-decision';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

/** The first option is the one the agent offers first (Yes); the last, its way out (No), is the quiet hairline. */
function variantOf(index: number, count: number) {
  if (index === 0) return 'primary';
  return index === count - 1 ? 'outline' : 'secondary';
}

/**
 * A permission dialog answered on the card: what it asks about (the command)
 * in mono, then its options in the order the dialog draws them, one button
 * each. The one pressed shows the answer in flight; the rest wait.
 */
export function InboxPermissionAnswer({
  decision,
  pending,
  onChoose,
}: {
  decision: SessionPermissionDecision;
  pending: boolean;
  onChoose: (option: number) => void;
}) {
  const { t } = useTranslation();
  const [chosen, setChosen] = useState<number | null>(null);
  const count = decision.options.length;

  return (
    <>
      {decision.detail ? <ApprovalCommand>{decision.detail}</ApprovalCommand> : null}
      <InboxMessageChoices>
        {decision.options.map((option, index) => (
          <Button
            // biome-ignore lint/suspicious/noArrayIndexKey: an option is answered by its place.
            key={index}
            variant={variantOf(index, count)}
            title={option.label}
            pending={pending && chosen === index}
            pendingLabel={t('inbox.session.sending')}
            disabled={pending && chosen !== index}
            onClick={() => {
              setChosen(index);
              onChoose(index);
            }}
          >
            <span className="truncate">{option.label}</span>
          </Button>
        ))}
      </InboxMessageChoices>
    </>
  );
}
