import { useHostCodexEnvironments } from '@oppenheimer/frontend-consumer/react';
import { useErrorMessage } from '@oppenheimer/frontend-core/react';
import { useController } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { CodexEnvironmentSelect } from '../components/codex-environment-select';
import { useNewSessionDraft } from '../hooks/use-new-session-form';
import { pickedEnvironment, toCodexEnvironmentOptions } from '../lib/session-options';

/**
 * The Codex environment chip, bound to the draft: the host's ChatGPT account's
 * environments for `repository`, read by its runner when the chip shows. A
 * pick is kept with the host and repository row it was made for
 * (`codexEnvironment`), so it holds only while they are the ones picked; Auto
 * is the host's own pick, the environment linked to the repository.
 */
export function NewSessionCodexEnvironmentPicker({
  hostId,
  repositoryId,
  repository,
}: {
  hostId: string;
  repositoryId: string;
  repository: string;
}) {
  const { t } = useTranslation();
  const { control } = useNewSessionDraft();
  const { field } = useController({ control, name: 'codexEnvironment' });
  const resolveError = useErrorMessage();
  const listing = useHostCodexEnvironments(hostId, repository);

  const picked = pickedEnvironment(field.value, hostId, repositoryId) ?? '';
  return (
    <CodexEnvironmentSelect
      options={toCodexEnvironmentOptions(listing.data, {
        auto: t('sessions.new.codexEnvironment.auto'),
        autoLinked: (name) => t('sessions.new.codexEnvironment.autoLinked', { name }),
        autoByName: t('sessions.new.codexEnvironment.autoByName'),
        linked: t('sessions.new.codexEnvironment.linked'),
        pinned: t('sessions.new.codexEnvironment.pinned'),
        failure: listing.isError
          ? resolveError(listing.error, t('sessions.new.codexEnvironment.failed')).message
          : undefined,
      })}
      value={picked}
      onValueChange={(id) => field.onChange(id ? { hostId, repository: repositoryId, id } : null)}
      loading={listing.isPending}
      variant="tab"
    />
  );
}
