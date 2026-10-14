import { Button } from '@oppenheimer/design-system-web';
import { type Control, useWatch } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { effectiveAccess, namedPeople, type ShareSessionValues } from '../lib/share-session';

/**
 * The Share dialog's one action, named for what it does: Share, Create link,
 * or, in red, Give write access. Off until there is someone to share with
 * and, for write access, until it is understood.
 */
export function ShareSubmitButton({
  control,
  pending,
}: {
  control: Control<ShareSessionValues>;
  pending: boolean;
}) {
  const { t } = useTranslation();
  const [audience, access, people, typed, ack] = useWatch({
    control,
    name: ['audience', 'access', 'people', 'typed', 'ack'],
  });
  const writing = effectiveAccess(audience, access) === 'write';
  const blocked =
    (audience === 'people' && namedPeople({ people, typed }).length === 0) || (writing && !ack);
  const label = writing ? 'write' : audience;

  return (
    <Button
      type="submit"
      variant={writing ? 'destructive' : 'primary'}
      disabled={blocked}
      pending={pending}
      pendingLabel={t('sessions.share.submitting')}
    >
      {t(`sessions.share.submit.${label}`)}
    </Button>
  );
}
