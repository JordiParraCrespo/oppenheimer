import { IconButton, useCopy } from '@oppenheimer/design-system-web';
import { CheckIcon, CopyIcon } from '@oppenheimer/design-system-web/icons';
import { useTranslation } from 'react-i18next';

/** A small copy button for a message: the text to the clipboard, then a check for a moment. */
export function CopyTextButton({ text, label }: { text: string; label: string }) {
  const { t } = useTranslation();
  const { copied, copy } = useCopy(text);
  return (
    <IconButton
      size="xs"
      shape="square"
      aria-label={copied ? t('common.copied') : label}
      title={copied ? t('common.copied') : label}
      onClick={copy}
    >
      {copied ? <CheckIcon aria-hidden /> : <CopyIcon aria-hidden />}
    </IconButton>
  );
}
