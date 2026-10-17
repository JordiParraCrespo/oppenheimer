import { VoiceRecorderBar } from '@oppenheimer/design-system-web';
import { useSyncExternalStore } from 'react';
import { useTranslation } from 'react-i18next';
import { type DictationMeter, formatElapsed } from '../lib/dictation-meter';

/**
 * The recorder in the composer's foot while dictating. It alone subscribes to
 * the meter, so the levels arriving twelve times a second redraw this bar and
 * nothing around it.
 */
export function DictationBar({
  meter,
  state,
  onStop,
  onCancel,
}: {
  meter: DictationMeter;
  state: 'waiting' | 'recording' | 'transcribing';
  onStop: () => void;
  onCancel: () => void;
}) {
  const { t } = useTranslation();
  const reading = useSyncExternalStore(meter.subscribe, meter.read);
  return (
    <VoiceRecorderBar
      state={state}
      levels={reading.levels}
      elapsed={formatElapsed(reading.elapsedMs)}
      onStop={onStop}
      onCancel={onCancel}
      labels={{
        waiting: t('sessions.new.dictation.waiting'),
        transcribing: t('sessions.new.dictation.transcribing'),
        stop: t('sessions.new.dictation.stop'),
        cancel: t('sessions.new.dictation.cancel'),
      }}
    />
  );
}
