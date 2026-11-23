import { Button, useCopy } from '@oppenheimer/design-system-web';
import { CheckIcon, CopyIcon } from '@oppenheimer/design-system-web/icons';
import { useTranslation } from 'react-i18next';

/** A line to copy, in a field's frame, with Copy beside it that says when it took. */
export function CopyLine({ text, label }: { text: string; label: string }) {
  const { t } = useTranslation();
  const { copied, copy } = useCopy(text);
  return (
    <div className="flex items-center gap-2 rounded-sm border border-border-subtle bg-field py-1.25 pr-1.25 pl-3.5">
      <code className="min-w-0 flex-1 truncate font-mono text-xs text-fg" title={text}>
        {text}
      </code>
      <Button type="button" variant="secondary" size="sm" aria-label={label} onClick={copy}>
        {copied ? <CheckIcon /> : <CopyIcon />}
        {copied ? t('bots.settings.slack.copied') : t('bots.settings.slack.copy')}
      </Button>
    </div>
  );
}
