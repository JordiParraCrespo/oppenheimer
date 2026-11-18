import { ChipSelect, dotVariants } from '@oppenheimer/design-system-web';
import type { DeviceChoice, DeviceInfo } from '@oppenheimer/frontend-consumer';
import { useTranslation } from 'react-i18next';

/**
 * The Simulator's device line as a picker: the device the session has, live,
 * and the host's others, each free one a move away. One another session holds
 * is listed, and cannot be picked.
 */
export function DevicePicker({
  device,
  choices,
  onSelect,
}: {
  device: DeviceInfo;
  choices: DeviceChoice[];
  onSelect: (serial: string) => void;
}) {
  const { t } = useTranslation();
  const options = choices.map((choice) => ({
    value: choice.serial,
    label: choice.name,
    description: choice.free
      ? t(`sessions.preview.platform.${choice.platform}`)
      : t('sessions.preview.deviceTaken'),
    keywords: choice.serial,
    disabled: !choice.free,
  }));

  return (
    <ChipSelect
      value={device.serial}
      onValueChange={(serial) => {
        if (serial !== device.serial) onSelect(serial);
      }}
      options={options}
      icon={<span className={dotVariants({ state: 'running' })} aria-hidden />}
      aria-label={t('sessions.preview.device')}
      searchPlaceholder={t('sessions.preview.deviceSearch')}
      emptyText={t('sessions.preview.deviceEmpty')}
      className="min-w-0"
    />
  );
}
