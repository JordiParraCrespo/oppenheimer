import { FieldError } from '@oppenheimer/design-system-web';
import { useTranslation } from 'react-i18next';
import type { DictationProblem } from '../hooks/use-dictation';

/** What went wrong with the last dictation, under the field it was for. */
export function DictationError({
  problem,
  className,
}: {
  problem: DictationProblem | null;
  className?: string;
}) {
  const { t } = useTranslation();
  if (!problem) return null;
  return <FieldError className={className}>{t(`common.dictation.${problem}`)}</FieldError>;
}
