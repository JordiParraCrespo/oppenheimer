import {
  Alert,
  AlertDescription,
  Button,
  CodeBlock,
  EditorPageBack,
  PageHeader,
  PageHeaderCrumbs,
  PageHeaderHere,
  PageHeaderMeta,
  PageHeaderRow,
  RoutineStep,
  RoutineSteps,
  SegmentedControl,
  SegmentedControlItem,
  Skeleton,
} from '@oppenheimer/design-system-web';
import { Server } from '@oppenheimer/design-system-web/icons';
import { useHostPairing } from '@oppenheimer/frontend-consumer/react';
import { useErrorMessage } from '@oppenheimer/frontend-core/react';
import { HostPairingStatus, HostPairingToken } from '@oppenheimer/frontend-web';
import { Link, useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

/**
 * How much of the block is shown before it scrolls; the rest is one copy away.
 * The agent prompt the server composes runs to thirty-odd lines.
 */
const CODE_MAX_LINES = 8;

/** The two ways to read one instruction, and the key each reads its label by. */
const FORMATS = ['command', 'agentPrompt'] as const;
type Format = (typeof FORMATS)[number];

const isFormat = (value: string): value is Format => (FORMATS as readonly string[]).includes(value);

/**
 * Add a host — pairing a machine without leaving the console
 * (`product/versions/mvp/05-screens.md`).
 *
 * The 2026-09-26 evening export made it a page over the main column rather
 * than a dialog, built like the automation editor: a page header with
 * Cancel and Use this host on its right and one fact under the title —
 * nothing on the host is exposed to the internet — then two numbered steps.
 * Install is the instruction in two forms behind a Command / Agent prompt
 * switch, the copyable panel and the token line; Connect is the status row
 * that resolves in place when a runner spends the token. Both steps tick
 * themselves done on the same event, because installing is what connects.
 *
 * The frame around it — the scrolling column and the body — is the `_editor`
 * layout route's; this is what fills it.
 *
 * The footer's primary arms on a **registered** host rather than an online
 * one, unlike onboarding's Continue: a session may be started on a machine
 * whose runner is still coming up — the control plane records it and owes
 * it to that host the moment it connects. Using the host lands on New session
 * with it picked (`?host=`), the way a new project lands there picked.
 *
 * Both forms of the instruction come from the API with the secret already in
 * them: it is shown once, the server is the only place that knows it, so
 * neither string is assembled here.
 */
export function AddHostScreen({ from = 'new-session' }: { from?: 'new-session' | 'settings' }) {
  const { t } = useTranslation();
  // Settings' Hosts page draws the same page with Hosts as its parent crumb
  // and Done as its primary: nothing there is picking a machine for a session.
  const settings = from === 'settings';
  const back = settings ? { to: '/settings/hosts' as const } : { to: '/sessions/new' as const };
  const navigate = useNavigate();
  const resolveError = useErrorMessage();
  const { pairing, expiresAt, expired, host, isPending, error, regenerate } = useHostPairing(
    t('hosts.add.defaultName'),
  );
  // Which way the same instruction is being read. The page is the lowest
  // component that reads it, and the switch changes nothing else on screen.
  const [format, setFormat] = useState<Format>('command');
  const connected = host !== null;

  return (
    <>
      <EditorPageBack render={<Link {...back} />}>{t('hosts.add.back')}</EditorPageBack>

      <PageHeader className="mb-7">
        <PageHeaderCrumbs>
          <Link to="/sessions/new">{t('hosts.add.crumbNewSession')}</Link>
          <span>/</span>
          <PageHeaderHere>{t('hosts.add.title')}</PageHeaderHere>
        </PageHeaderCrumbs>
        <PageHeaderRow
          icon={<Server />}
          title={t('hosts.add.title')}
          actions={
            <>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                render={<Link to="/sessions/new" />}
              >
                {t('common.cancel')}
              </Button>
              <Button
                type="button"
                size="sm"
                disabled={!host}
                onClick={() => host && navigate({ to: '/sessions/new', search: { host: host.id } })}
              >
                {t('hosts.add.use')}
              </Button>
            </>
          }
        />
        <PageHeaderMeta>
          <span>{t('hosts.add.meta')}</span>
        </PageHeaderMeta>
      </PageHeader>

      {error ? (
        <Alert variant="destructive" className="mb-6">
          <AlertDescription>
            {resolveError(error, t('hosts.pairing.mintFailed')).message}
          </AlertDescription>
        </Alert>
      ) : null}

      <RoutineSteps>
        <RoutineStep
          number={1}
          title={t('hosts.add.install.title')}
          subtitle={t('hosts.add.install.subtitle')}
          done={connected}
          summary={t('hosts.add.install.done')}
        >
          <div className="flex flex-col gap-2">
            <SegmentedControl
              value={format}
              onValueChange={(next) => {
                // `SegmentedControl` speaks strings; the guard is what keeps
                // that at the boundary instead of casting it away.
                if (isFormat(next)) setFormat(next);
              }}
              aria-label={t('hosts.add.install.format')}
              className="self-start"
            >
              {FORMATS.map((option) => (
                <SegmentedControlItem key={option} value={option}>
                  {t(`hosts.add.install.${option}` as const)}
                </SegmentedControlItem>
              ))}
            </SegmentedControl>

            {pairing ? (
              <CodeBlock
                layout="panel"
                code={format === 'command' ? pairing.installCommand : pairing.agentPrompt}
                maxLines={CODE_MAX_LINES}
                note={
                  format === 'command' && pairing.installScriptSha256
                    ? t('hosts.pairing.installerDigest', { digest: pairing.installScriptSha256 })
                    : undefined
                }
                copyLabel={t('common.copy')}
                copiedLabel={t('common.copied')}
              />
            ) : (
              <Skeleton className="h-19 w-full" />
            )}

            <HostPairingToken
              expiresAt={expiresAt}
              expired={expired}
              onRegenerate={regenerate}
              busy={isPending}
            />
          </div>
        </RoutineStep>

        <RoutineStep
          number={2}
          title={t('hosts.add.connect.title')}
          subtitle={t('hosts.add.connect.subtitle')}
          done={connected}
          summary={host ? [host.name, host.os].filter(Boolean).join(' · ') : undefined}
          last
        >
          <div className="rounded-2xl border border-border-subtle bg-card px-3.5">
            <HostPairingStatus host={host} />
          </div>
        </RoutineStep>
      </RoutineSteps>
    </>
  );
}
