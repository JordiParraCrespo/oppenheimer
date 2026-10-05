import { Button, CommandRow, CommandRowList, Link, useCopy } from '@oppenheimer/design-system-web';
import { Bot, Check } from '@oppenheimer/design-system-web/icons';
import { Link as RouterLink } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';

/**
 * What to do when a host's runner does not come back by itself, in the drawer
 * `HostLinkChrome` opens from How to fix. Nothing here runs from the console —
 * the console cannot reach a runner that is offline — so each command is a
 * line to copy and run on the host itself, in the order a person would: ask
 * the runner what is wrong, read its log, and only then reinstall and start
 * it. The prompt is the same steps for an agent (Claude Code, Codex) already
 * running on that machine, as Add host offers one for pairing.
 *
 * The commands are the runner's own: the installer links the binary at
 * `~/.local/bin/oppenheimer-runner` (on the PATH or not), `status` and
 * `install` are its subcommands, and the service unit appends its log to
 * `~/.oppenheimer/log/runner.log`.
 */
export function HostLinkFix({ host }: { host: string }) {
  const { t } = useTranslation();
  const prompt = useCopy(t('sessions.session.hostLink.prompt', { host }));
  const copy = {
    copyLabel: t('sessions.session.hostLink.copy'),
    copiedLabel: t('sessions.session.hostLink.copied'),
  };
  return (
    <>
      <CommandRowList>
        {
          // oppenheimer:begin runner
          <>
            <CommandRow
              surface="terminal"
              lead={t('sessions.session.hostLink.statusCommand')}
              command="~/.local/bin/oppenheimer-runner status"
              {...copy}
            />
            <CommandRow
              surface="terminal"
              lead={t('sessions.session.hostLink.logCommand')}
              command="tail -n 50 ~/.oppenheimer/log/runner.log"
              {...copy}
            />
            <CommandRow
              surface="terminal"
              lead={t('sessions.session.hostLink.install')}
              command="~/.local/bin/oppenheimer-runner install"
              {...copy}
            />
          </>
          // oppenheimer:end runner
        }
      </CommandRowList>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[13px]">
        <Button type="button" variant="secondary" size="sm" onClick={prompt.copy}>
          {prompt.copied ? <Check /> : <Bot />}
          {prompt.copied ? copy.copiedLabel : t('sessions.session.hostLink.copyPrompt')}
        </Button>
        <Link render={<RouterLink to="/settings/hosts" />}>
          {t('sessions.session.hostLink.hosts')}
        </Link>
      </div>
    </>
  );
}
