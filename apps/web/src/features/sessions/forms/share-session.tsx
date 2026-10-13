import { Button, DialogBody, DialogFooter } from '@oppenheimer/design-system-web';
import { ErrorAlert, useZodResolver } from '@oppenheimer/frontend-web';
import type {
  PutSessionShareDto,
  SessionShareAccess,
} from '@oppenheimer/shared/schemas/session-share';
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

/**
 * Share session (`ShareSession.dc.html`): who, permission, for how long. It
 * fills the dialog's body and footer; each field watches what it needs of
 * the others, so a pick re-renders that field and not the form.
 */
export function ShareSessionForm({
  defaults,
  host,
  pending,
  error,
  onSubmit,
  onCancel,
}: {
  defaults: ShareSessionValues;
  /** The host the session runs on, for the write warning. */
  host: string;
  pending: boolean;
  error: unknown;
  onSubmit: (input: PutSessionShareDto) => void;
  onCancel: () => void;
}) {
  const { t } = useTranslation();
  const { control, handleSubmit, setValue, getValues, formState } = useForm<ShareSessionValues>({
    resolver: useZodResolver(
      shareSessionFormSchema({
        people: t('sessions.share.peopleRequired'),
        ack: t('sessions.share.ackRequired'),
      }),
    ),
    defaultValues: defaults,
  });

  /** A new permission asks again to be understood; write starts on its shortest lifetime. */
  function pickAccess(access: SessionShareAccess) {
    const previous = getValues('access');
    setValue('access', access);
    setValue('ack', false);
    if (
      access === 'write' &&
      (previous !== 'write' || !lifetimeAllowed('write', getValues('lifetime')))
    ) {
      setValue('lifetime', '1h');
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
          <ShareLifetimeField control={control} disabled={pending} />
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
