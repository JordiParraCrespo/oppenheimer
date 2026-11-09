import { AgentMark, Badge } from '@oppenheimer/design-system-web';
import { BOT_PROVIDER_CATALOG, type BotProvider } from '@oppenheimer/shared/schemas/bot';
import { useTranslation } from 'react-i18next';
import { botProviderMark } from '../lib/bot-engine';

/**
 * A Model providers row's name: the provider's mark, its name, and a Default
 * badge on the one new bots start on.
 */
export function ModelProviderName({
  provider,
  isDefault = false,
}: {
  provider: BotProvider;
  isDefault?: boolean;
}) {
  const { t } = useTranslation();
  return (
    <span className="inline-flex items-center gap-2">
      <AgentMark agent={botProviderMark(provider)} className="size-4" />
      <span className="font-medium">{BOT_PROVIDER_CATALOG[provider].label}</span>
      {isDefault ? <Badge variant="soft">{t('settings.modelProviders.default')}</Badge> : null}
    </span>
  );
}
