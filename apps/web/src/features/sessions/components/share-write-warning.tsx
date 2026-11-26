import { Checkbox } from '@oppenheimer/design-system-web';
import { TriangleAlertIcon } from '@oppenheimer/design-system-web/icons';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

/**
 * Write access is a shell on the host as the person sharing it. While it is
 * picked, this says so, by name, and asks to be understood before it is
 * given; `children` are the buttons that give it, when a live share is
 * being changed.
 */
export function ShareWriteWarning({
  who,
  host,
  ack,
  onAck,
  children,
}: {
  /** The one address, or "2 people"; empty while nobody is named yet. */
  who: string;
  host: string;
  ack: boolean;
  onAck: (ack: boolean) => void;
  children?: ReactNode;
}) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col gap-2.5 rounded-md border border-danger/30 bg-danger/5 px-3 py-2.5">
      <div className="flex items-start gap-2">
        <TriangleAlertIcon className="mt-0.5 size-3.5 shrink-0 text-danger" />
        <p className="text-[12.5px] leading-normal text-pretty text-fg">
          <span className="font-medium text-danger">
            {who
              ? t('sessions.share.writeWarningTitle', { who, host })
              : t('sessions.share.writeWarningAnyone', { host })}
          </span>{' '}
          {t('sessions.share.writeWarningBody')}
        </p>
      </div>
      <div className="flex items-center gap-2">
        {/* biome-ignore lint/a11y/noLabelWithoutControl: the control is the checkbox inside it. */}
        <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-2 pl-5.5 text-[12.5px] text-fg">
          <Checkbox checked={ack} onCheckedChange={(next) => onAck(next)} />
          {t('sessions.share.writeAck')}
        </label>
        {children}
      </div>
    </div>
  );
}
