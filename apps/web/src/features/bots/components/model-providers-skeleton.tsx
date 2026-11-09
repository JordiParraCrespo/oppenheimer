import {
  SettingsGroup,
  SettingsHeading,
  SettingsListRow,
  Skeleton,
} from '@oppenheimer/design-system-web';
import { LoadingStatus } from '@oppenheimer/frontend-web';
import { BOT_PROVIDERS } from '@oppenheimer/shared/schemas/bot';
import { useTranslation } from 'react-i18next';
import { ModelProviderName } from './model-provider-name';

/**
 * Model providers before the workspace's keys answer. The API lists every
 * provider in catalog order, so the rows are known: each mark, name and what
 * it serves written, in one card under one heading, a bar, since only the
 * read splits them into connected and not; the key's tag and the row's
 * buttons as bars on the row's own frame, since only the read says whether
 * there is a key.
 */
export function ModelProvidersSkeleton() {
  const { t } = useTranslation();
  return (
    <section aria-busy className="flex flex-col gap-2.5">
      <SettingsHeading aria-hidden>
        <Skeleton shape="sm" className="inline-block h-2.5 w-24 align-middle" />
      </SettingsHeading>
      <SettingsGroup>
        {BOT_PROVIDERS.map((provider) => (
          <SettingsListRow
            key={provider}
            align="center"
            aria-hidden
            kind={<Skeleton shape="sm" className="h-2 w-16" />}
            meta={t(`settings.modelProviders.providers.${provider}`)}
            actions={<Skeleton shape="pill" className="h-7 w-18" />}
          >
            <ModelProviderName provider={provider} />
          </SettingsListRow>
        ))}
      </SettingsGroup>
      <LoadingStatus />
    </section>
  );
}
