import { Checkbox, FieldError } from '@oppenheimer/design-system-web';
import { TriangleAlertIcon } from '@oppenheimer/design-system-web/icons';
import { type Control, Controller, useWatch } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { effectiveAccess, namedPeople, type ShareSessionValues } from '../lib/share-session';

/**
 * Write access is a shell on the host as the person sharing it. While it is
 * picked, this says so in red, by name, and asks to be understood before the
 * button gives it.
 */
export function ShareWriteWarning({
  control,
  host,
  error,
}: {
  control: Control<ShareSessionValues>;
  host: string;
  error: { message?: string } | undefined;
}) {
  const { t } = useTranslation();
  const [audience, access, listed, typed] = useWatch({
    control,
    name: ['audience', 'access', 'people', 'typed'],
  });
  const people = namedPeople({ people: listed, typed });
  if (effectiveAccess(audience, access) !== 'write') return null;
  const who =
    people.length === 1
      ? people[0]
      : t('sessions.share.writeWarningCount', { count: people.length });

  return (
    <div className="flex flex-col gap-3.5 rounded-lg border border-danger/40 bg-danger/6 px-4 py-3.5">
      <div className="flex items-start gap-2.5">
        <TriangleAlertIcon className="mt-0.5 size-4 shrink-0 text-danger" />
        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-semibold text-danger">
            {t('sessions.share.writeWarningTitle', { who, host })}
          </span>
          <span className="text-sm leading-normal text-pretty text-fg">
            {t('sessions.share.writeWarningBody')}
          </span>
        </div>
      </div>
      <Controller
        control={control}
        name="ack"
        render={({ field }) => (
          // biome-ignore lint/a11y/noLabelWithoutControl: the control is the checkbox inside it.
          <label className="flex cursor-pointer items-center gap-2.5 text-sm text-fg">
            <Checkbox checked={field.value} onCheckedChange={(next) => field.onChange(next)} />
            {t('sessions.share.writeAck')}
          </label>
        )}
      />
      <FieldError errors={[error]} />
    </div>
  );
}
