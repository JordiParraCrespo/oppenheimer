import {
  ChipSelect,
  type ChipSelectOption,
  type ChipSelectTriggerVariant,
} from '@oppenheimer/design-system-web';
import { GitBranch } from '@oppenheimer/design-system-web/icons';
import { useTranslation } from 'react-i18next';

/**
 * The branch chip, which the artboard shows **only while exactly one
 * repository is selected**.
 *
 * That condition is the whole reason this is a separate component from the
 * repository picker's own branch pane: with two repositories checked out there
 * are two base branches, and a single chip reading one of them would be a
 * sentence that is not true. The section above decides when to render it; this
 * file only knows how a branch reads.
 */
export function BranchSelect({
  branches,
  value,
  onValueChange,
  loading,
  disabled,
  variant,
}: {
  branches: ChipSelectOption[];
  value: string | null;
  onValueChange: (value: string) => void;
  loading?: boolean;
  disabled?: boolean;
  /** `tab` inside the composer's scope band; `chip` on its own. */
  variant?: ChipSelectTriggerVariant;
}) {
  const { t } = useTranslation();

  return (
    <ChipSelect
      value={value ?? ''}
      onValueChange={onValueChange}
      options={branches}
      icon={<GitBranch />}
      loading={loading}
      loadingText={t('sessions.new.branch.loading')}
      disabled={disabled}
      variant={variant}
      aria-label={t('sessions.new.branch.label')}
      placeholder={t('sessions.new.branch.placeholder')}
      searchPlaceholder={t('sessions.new.branch.search')}
      emptyText={t('sessions.new.branch.empty')}
    />
  );
}
