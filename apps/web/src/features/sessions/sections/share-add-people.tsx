import {
  Button,
  DialogBody,
  DialogFooter,
  Field,
  FieldDescription,
  FieldLabel,
} from '@oppenheimer/design-system-web';
import type { SessionShare } from '@oppenheimer/frontend-consumer';
import { useSetSessionSharePeople } from '@oppenheimer/frontend-consumer/react';
import { ErrorAlert } from '@oppenheimer/frontend-web';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { SharePeoplePicker } from '../components/share-people-picker';
import { namedPeople } from '../lib/share-session';

/**
 * Add people to a share for specific people: only the new addresses, sent
 * as the share's people plus them, so what they may do and until when stay
 * the share's own. Changing those is sharing again, from Share session.
 */
export function ShareAddPeople({
  sessionId,
  share,
  onBack,
}: {
  sessionId: string;
  share: SessionShare;
  onBack: () => void;
}) {
  const { t } = useTranslation();
  const add = useSetSessionSharePeople();
  const [added, setAdded] = useState<string[]>([]);
  const [typed, setTyped] = useState('');
  const adding = namedPeople({ people: added, typed }).filter(
    (email) => !share.people.includes(email),
  );

  return (
    <form
      noValidate
      className="flex min-h-0 flex-col"
      onSubmit={(event) => {
        event.preventDefault();
        add.mutate({ sessionId, people: [...share.people, ...adding] }, { onSuccess: onBack });
      }}
    >
      <DialogBody>
        <div className="flex flex-col gap-5.5">
          <ErrorAlert error={add.error} fallback={t('sessions.share.updateFailed')} />
          <Field>
            <FieldLabel>{t('sessions.share.who')}</FieldLabel>
            <SharePeoplePicker
              value={added}
              exclude={share.people}
              onChange={setAdded}
              onTyped={setTyped}
            />
            <FieldDescription>
              {t('sessions.share.addHint', { role: t(`sessions.share.roles.${share.access}`) })}
            </FieldDescription>
          </Field>
        </div>
      </DialogBody>
      <DialogFooter>
        <Button type="button" variant="secondary" onClick={onBack} disabled={add.isPending}>
          {t('common.cancel')}
        </Button>
        <Button
          type="submit"
          disabled={adding.length === 0}
          pending={add.isPending}
          pendingLabel={t('sessions.share.submitting')}
        >
          {t('sessions.share.addSubmit')}
        </Button>
      </DialogFooter>
    </form>
  );
}
