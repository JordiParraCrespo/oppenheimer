import { ChipSelectItem, ChipSelectList } from '@oppenheimer/design-system-web';
import { Check, Cloud } from '@oppenheimer/design-system-web/icons';
import {
  useHostCodexEnvironments,
  useInstallationRepositoriesFor,
  useInstallations,
} from '@oppenheimer/frontend-consumer/react';
import { ErrorAlert } from '@oppenheimer/frontend-web';
import { useController, useWatch } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { useNewSessionDraft } from '../hooks/use-new-session-form';
import { parseRepositoryKey, pickedEnvironment } from '../lib/session-options';

/**
 * The place chip's Environments pane for Codex's cloud, as
 * `NewSessionComposer.dc.html` draws a cloud account's: the environments of
 * the ChatGPT account the host's `codex` is signed in to, each with what the
 * host knows of it on the right, and the line that says where they live
 * (`product/next-steps/cloud-agents.md`, "Which Codex environment"). Auto is
 * the host's own pick, the environment linked to the repository, and leads.
 * Under the list, one line: whose environments these are, or, when the host
 * could only read its recent tasks, that these are those.
 *
 * Mounted only while the pane shows, so the host is asked then and not
 * before. The repository's name comes off the list the repository chip
 * already read; with none picked yet, the account's environments are listed
 * with none marked as linked. A pick is kept with the host it was made on.
 */
export function NewSessionCodexEnvironments({
  hostId,
  query,
  onDone,
}: {
  hostId: string;
  /** The pane's search, settled by the chip. */
  query: string;
  onDone: () => void;
}) {
  const { t } = useTranslation();
  const { control } = useNewSessionDraft();
  const scope = useWatch({ control, name: 'scope' });
  const { field } = useController({ control, name: 'codexEnvironment' });

  const ref = scope.length === 1 && scope[0] ? parseRepositoryKey(scope[0].id) : null;
  const installations = useInstallations();
  const repositories = useInstallationRepositoriesFor(
    ref ? (installations.data ?? []).map((installation) => installation.id) : [],
  );
  const repository = ref
    ? (repositories.repositories.find(
        (row) =>
          row.installationId === ref.installationId &&
          row.repository.githubRepoId === ref.githubRepoId,
      )?.repository.fullName ?? null)
    : null;
  const listing = useHostCodexEnvironments(hostId, repository);

  const picked = pickedEnvironment(field.value, hostId);
  const term = query.trim().toLowerCase();
  const name = (env: { id: string; label: string | null }) => env.label ?? env.id;
  const environments = (listing.data?.environments ?? []).filter(
    (env) => !term || `${name(env)} ${env.id}`.toLowerCase().includes(term),
  );
  const recommended = listing.data?.environments.find(
    (env) => env.id === listing.data?.recommended,
  );
  const auto = t('sessions.new.codexEnvironment.auto');
  const showAuto = !term || auto.toLowerCase().includes(term);

  /** A row's right side: what the host knows of it, then the check. */
  function meta(text: string | null, selected: boolean) {
    return (
      <span className="flex min-w-0 shrink items-center gap-1.5 text-xs text-fg-subtle">
        <span className="truncate">{text}</span>
        <span className="flex w-3.5 shrink-0 items-center justify-center text-link">
          {selected ? <Check className="size-3.5" strokeWidth={2.5} /> : null}
        </span>
      </span>
    );
  }

  function pick(next: { id: string; label: string } | null) {
    field.onChange(next ? { hostId, ...next } : null);
    onDone();
  }

  return (
    <ChipSelectList
      role="listbox"
      aria-label={t('sessions.new.codexEnvironment.label')}
      loading={listing.isPending}
      loadingText={t('sessions.new.codexEnvironment.loading')}
      empty={!listing.isPending && !showAuto && environments.length === 0}
      emptyText={t('sessions.new.codexEnvironment.empty')}
    >
      {showAuto ? (
        <ChipSelectItem
          selected={!picked}
          leading={<Cloud />}
          trailing={meta(
            recommended
              ? t('sessions.new.codexEnvironment.autoLinked', { name: name(recommended) })
              : t('sessions.new.codexEnvironment.autoByName'),
            !picked,
          )}
          onClick={() => pick(null)}
        >
          {auto}
        </ChipSelectItem>
      ) : null}
      {environments.map((env) => (
        <ChipSelectItem
          key={env.id}
          selected={picked?.id === env.id}
          leading={<Cloud />}
          trailing={meta(
            env.repository
              ? t('sessions.new.codexEnvironment.linked')
              : env.pinned
                ? t('sessions.new.codexEnvironment.pinned')
                : null,
            picked?.id === env.id,
          )}
          onClick={() => pick({ id: env.id, label: name(env) })}
        >
          {name(env)}
        </ChipSelectItem>
      ))}
      {listing.isPending ? null : (
        <div className="px-2.5 pt-2 pb-1 text-xs text-fg-subtle">
          {listing.isError ? (
            // In full, on lines of its own: the refusal ends with what to do
            // about it, which a row's one truncated line would cut off.
            <ErrorAlert
              error={listing.error}
              fallback={t('sessions.new.codexEnvironment.failed')}
            />
          ) : (
            <p>
              {listing.data?.source === 'tasks'
                ? t('sessions.new.codexEnvironment.recent')
                : t('sessions.new.codexEnvironment.lives')}
            </p>
          )}
        </div>
      )}
    </ChipSelectList>
  );
}
