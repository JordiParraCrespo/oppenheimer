import { IconButton } from '@oppenheimer/design-system-web';
import { ChevronDown } from '@oppenheimer/design-system-web/icons';
import { useTranslation } from 'react-i18next';

/**
 * The chevron on a provider's row that shows or hides its keys' rows, for a
 * provider with several keys; it turns over while they are shown. Props in,
 * choice out.
 */
export function ModelProviderKeysToggle({
  label,
  expanded,
  controls,
  onExpandedChange,
}: {
  label: string;
  expanded: boolean;
  /** The ids of the key rows it shows and hides. */
  controls: string;
  onExpandedChange: (expanded: boolean) => void;
}) {
  const { t } = useTranslation();
  const name = t(
    expanded ? 'settings.modelProviders.hideKeys' : 'settings.modelProviders.showKeys',
    { provider: label },
  );
  return (
    <IconButton
      size="sm"
      aria-label={name}
      title={name}
      aria-expanded={expanded}
      aria-controls={expanded ? controls : undefined}
      onClick={() => onExpandedChange(!expanded)}
    >
      <ChevronDown
        className={`transition-transform duration-fast ease-standard ${expanded ? 'rotate-180' : ''}`}
      />
    </IconButton>
  );
}
