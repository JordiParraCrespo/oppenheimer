import { Button, DialogBody, DialogFooter } from '@oppenheimer/design-system-web';
import type { SessionShare } from '@oppenheimer/frontend-consumer';
import { ErrorAlert, useZodResolver } from '@oppenheimer/frontend-web';
import type { SessionShareAccess } from '@oppenheimer/shared/schemas/session-share';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { ShareAccessField } from '../components/share-access-field';
import { ShareAudienceField } from '../components/share-audience-field';
import { ShareLifetimeField } from '../components/share-lifetime-field';
import { ShareSubmitButton } from '../components/share-submit-button';
import { ShareWriteWarning } from '../components/share-write-warning';
import {
  lifetimeAllowed,
  type ShareSessionValues,
  shareInput,
  shareSessionFormSchema,
} from '../lib/share-session';

type ShareSubmission = ReturnType<typeof shareInput>;

/**
 * Share session (`ShareSession.dc.html`): who, permission, for how long. It
 * fills the dialog's body and footer; each field watches what it needs of
 * the others, so a pick re-renders that field and not the form. Adding
 * people to a share keeps its expiry until another length is picked, and
 * then hands back only the people.
 */
export function ShareSessionForm({
  defaults,
  share,
  host,
  pending,
  error,
  onSubmit,
  onCancel,
}: {
  defaults: ShareSessionValues;
  /** The share people are being added to, or `null` for a first share. */
  share: SessionShare | null;
  /** The host the session runs on, for the write warning. */
  host: string;
  pending: boolean;
  error: unknown;
  onSubmit: (submission: ShareSubmission) => void;
  onCancel: () => void;
}) {
  const { t } = useTranslation();
  const { control, handleSubmit, setValue, getValues, formState } = useForm<ShareSessionValues>({
    resolver: useZodResolver(
      shareSessionFormSchema(
        {
          people: t('sessions.share.peopleRequired'),
          ack: t('sessions.share.ackRequired'),
          lifetime: t('sessions.share.lifetimeRequired'),
        },
        share,
      ),
    ),
    defaultValues: defaults,
  });

  /**
   * A new permission asks again to be understood; write starts on its
   * shortest lifetime, and a kept expiry no longer fits a new permission.
   */
  function pickAccess(access: SessionShareAccess) {
    const previous = getValues('access');
    const lifetime = getValues('lifetime');
    setValue('access', access);
    setValue('ack', false);
    if (access === 'write' && (previous !== 'write' || !lifetimeAllowed('write', lifetime))) {
      setValue('lifetime', '1h');
    } else if (access !== previous && lifetime === 'keep') {
      setValue('lifetime', '24h');
    }
  }

  return (
    <form
      onSubmit={handleSubmit((values) => onSubmit(shareInput(values)))}
      noValidate
      className="flex min-h-0 flex-col"
    >
      <DialogBody>
        <div className="flex flex-col gap-5.5">
          <ErrorAlert error={error} fallback={t('sessions.share.failed')} />
          <ShareAudienceField
            control={control}
            error={formState.errors.people}
            disabled={pending}
          />
          <ShareAccessField control={control} disabled={pending} onPick={pickAccess} />
          <ShareWriteWarning control={control} host={host} error={formState.errors.ack} />
          <ShareLifetimeField
            control={control}
            keptUntil={share?.expiresAt ?? null}
            error={formState.errors.lifetime}
            disabled={pending}
          />
        </div>
      </DialogBody>
      <DialogFooter>
        <Button type="button" variant="secondary" onClick={onCancel} disabled={pending}>
          {t('common.cancel')}
        </Button>
        <ShareSubmitButton control={control} pending={pending} />
      </DialogFooter>
    </form>
  );
}
