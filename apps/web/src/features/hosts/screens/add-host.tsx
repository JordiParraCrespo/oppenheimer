import {
  Alert,
  AlertDescription,
  Button,
  EditorPageBack,
  PageHeader,
  PageHeaderCrumbs,
  PageHeaderHere,
  PageHeaderMeta,
  PageHeaderRow,
  RoutineStep,
  RoutineSteps,
} from '@oppenheimer/design-system-web';
import { Cpu } from '@oppenheimer/design-system-web/icons';
import { useHostPairing } from '@oppenheimer/frontend-consumer/react';
import { useErrorMessage } from '@oppenheimer/frontend-core/react';
import {
  HostPairingInstruction,
  HostPairingStatus,
  HostPairingToken,
} from '@oppenheimer/frontend-web';
import { Link, useNavigate } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';

/**
 * Settings → Hosts → Add a host: pairing a machine from Settings
 * (`design/version1/Settings.dc.html`, `product/versions/mvp/05-screens.md`).
 *
 * A page inside the Settings frame, built like the automation editor once
 * was: a page header with Cancel and Done on its right and one fact under
 * the title — nothing on the host is exposed to the internet — then two
 * numbered steps. Install is the kit's instruction panel shown outright,
 * the Command / Agent prompt pills in its band beside Copy, then the token
 * line; Connect is the status row that resolves in place when a runner
 * spends the token. Both steps tick themselves done on the same event,
 * because installing is what connects. Back, the crumb, Cancel and Done all
 * return to the list.
 *
 * The console pairs a machine in a dialog instead
 * (`sessions/dialogs/add-host.tsx`, the 2026-09-27 export); this page is
 * Settings' own, because its frame keeps Settings around it.
 *
 * Both forms of the instruction come from the API with the secret already in
 * them: it is shown once, the server is the only place that knows it, so
 * neither string is assembled here.
 */
export function AddHostScreen() {
  const { t } = useTranslation();
  const back = { to: '/settings/hosts' as const };
  const navigate = useNavigate();
  const resolveError = useErrorMessage();
  const { pairing, expiresAt, expired, host, isPending, error, regenerate } = useHostPairing(
    t('hosts.add.defaultName'),
  );
  const connected = host !== null;

  return (
    <>
      <EditorPageBack render={<Link {...back} />}>{t('hosts.add.back')}</EditorPageBack>

      <PageHeader className="mb-7">
        <PageHeaderCrumbs aria-label={t('common.breadcrumb')}>
          <Link {...back}>{t('hosts.add.crumbHosts')}</Link>
          <span>/</span>
          <PageHeaderHere>{t('hosts.add.title')}</PageHeaderHere>
        </PageHeaderCrumbs>
        <PageHeaderRow
          icon={<Cpu />}
          title={t('hosts.add.title')}
          actions={
            <>
              <Button type="button" variant="secondary" size="sm" render={<Link {...back} />}>
                {t('common.cancel')}
              </Button>
              <Button
                type="button"
                size="sm"
                disabled={!host}
                onClick={() => host && navigate(back)}
              >
                {t('hosts.add.done')}
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
            <HostPairingInstruction pairing={pairing ?? null} layout="panel" />

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
          <div className="rounded-[14px] border border-border-subtle bg-card px-3.5">
            <HostPairingStatus host={host} />
          </div>
        </RoutineStep>
      </RoutineSteps>
    </>
  );
}
