import { useTranslation } from 'react-i18next';

/**
 * The locale to format numbers and dates in.
 *
 * `resolvedLanguage` rather than `language`: the two differ the moment i18next
 * falls back, and what the reader is looking at is the resolved one. One
 * source for every screen keeps a fallback from putting two date orders on
 * one page.
 */
export function useLocale(): string {
  const { i18n } = useTranslation();
  return i18n.resolvedLanguage ?? i18n.language;
}
