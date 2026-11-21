import { AgentMark, Badge } from '@oppenheimer/design-system-web';
import { AudioLines } from '@oppenheimer/design-system-web/icons';
import {
  isBotProvider,
  MODEL_PROVIDER_CATALOG,
  type ModelProvider,
} from '@oppenheimer/shared/schemas/model-provider';
import { useTranslation } from 'react-i18next';
import { botProviderMark } from '../lib/bot-engine';

/**
 * A Model providers row's name: the provider's mark, its name, and a Default
 * badge on the one new bots start on. A provider that only hears and speaks
 * (Groq, ElevenLabs) has no agent mark, and is drawn with a sound wave.
 */
export function ModelProviderName({
  provider,
  isDefault = false,
}: {
  provider: ModelProvider;
  isDefault?: boolean;
}) {
  const { t } = useTranslation();
  return (
    <span className="inline-flex items-center gap-2">
      {isBotProvider(provider) ? (
        <AgentMark agent={botProviderMark(provider)} className="size-4" />
      ) : (
        <AudioLines aria-hidden className="size-4 text-fg-subtle" />
      )}
      <span className="font-medium">{MODEL_PROVIDER_CATALOG[provider].label}</span>
      {isDefault ? <Badge variant="soft">{t('settings.modelProviders.default')}</Badge> : null}
    </span>
  );
}
