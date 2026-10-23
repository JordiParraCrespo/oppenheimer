import { DictationButton } from '@oppenheimer/design-system-web';
import { useTranslation } from 'react-i18next';

/** The mic, named in the reader's language. */
export function DictationMic({ recording, onClick }: { recording: boolean; onClick: () => void }) {
  const { t } = useTranslation();
  return (
    <DictationButton
      recording={recording}
      onClick={onClick}
      labels={{ dictate: t('common.dictation.dictate'), stop: t('common.dictation.stop') }}
    />
  );
}
