import { VoiceRecorderBar } from '@oppenheimer/design-system-web';
import { useSyncExternalStore } from 'react';
import { useTranslation } from 'react-i18next';
import type { Dictation } from '../hooks/use-dictation';
import { formatElapsed } from '../lib/dictation-meter';

/**
 * The recorder while a field is dictating, nothing otherwise. It alone
 * subscribes to the meter, so the levels arriving twelve times a second
 * redraw this bar and nothing around it.
 */
export function DictationBar({ dictation }: { dictation: Dictation }) {
  const { t } = useTranslation();
  const reading = useSyncExternalStore(dictation.meter.subscribe, dictation.meter.read);
  if (!dictation.phase) return null;
  return (
    <VoiceRecorderBar
      state={dictation.phase}
      levels={reading.levels}
      elapsed={formatElapsed(reading.elapsedMs)}
      onStop={dictation.stop}
      onCancel={dictation.cancel}
      labels={{
        waiting: t('common.dictation.waiting'),
        transcribing: t('common.dictation.transcribing'),
        stop: t('common.dictation.stop'),
        cancel: t('common.dictation.cancel'),
      }}
    />
  );
}
