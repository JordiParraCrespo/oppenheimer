import { Callout } from '@oppenheimer/design-system-web';
import { useTranslation } from 'react-i18next';

/** Where ChatGPT keeps the newer Codex Cloud environments, the ones the CLI cannot reach. */
const CODEX_CLOUD_SETTINGS = 'https://chatgpt.com/settings/codex-cloud';

/**
 * Why a Codex cloud start found no environment (`SESS_010`): the host's
 * `codex cloud exec` resolves only the environments `codex cloud` lists, and
 * the ones made in ChatGPT's Settings → Codex Cloud are not among them yet
 * (`product/next-steps/cloud-agents.md`). Said in the reader's language, with
 * the settings page a link away, in place of the CLI's "not found".
 */
export function CodexEnvironmentHelp({ className }: { className?: string }) {
  const { t } = useTranslation();
  return (
    <Callout className={className}>
      {t('sessions.provisioning.codexEnvironment.body')}{' '}
      <a
        href={CODEX_CLOUD_SETTINGS}
        target="_blank"
        rel="noreferrer"
        className="text-link hover:underline"
      >
        {t('sessions.provisioning.codexEnvironment.link')}
      </a>
    </Callout>
  );
}
