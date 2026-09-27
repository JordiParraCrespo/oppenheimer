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
  HostInstallInstruction,
  HostPairingStatus,
  HostPairingToken,
} from '@oppenheimer/frontend-web';
import { Link, useNavigate } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';

/**
 * Settings → Hosts → Add a host: a page inside the Settings frame
 * (`design/version1/Settings.dc.html`). Back, Hosts / Add a host, Cancel
 * and Done all return to the list, and one fact sits under the title —
 * nothing on the host is exposed to the internet. Then two numbered steps:
 * Install is the instruction (`HostInstallInstruction`) and the token line
 * under it; Connect is the status row that resolves in place when a runner
 * spends the token. Both tick themselves done on the same event, because
 * installing is what connects.
 *
 * The console pairs a machine in a dialog instead, over New session
 * (`features/sessions/dialogs/add-host.tsx`); the instruction panel, the
 * token line and the status row are the kit's, so the two surfaces show the
 * same pairing from one set of parts.
 *
 * Done arms on a **registered** host rather than an online one, as the
 * dialog's Use this host does: the runner may still be coming up, and the
 * list it returns to shows it either way.
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
        <PageHeaderCrumbs>
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
              <Button type="button" size="sm" disabled={!host} onClick={() => navigate(back)}>
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
            <HostInstallInstruction instruction={pairing} />
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
          <div className="rounded-md border border-border-subtle bg-card px-3.5">
            <HostPairingStatus host={host} />
          </div>
        </RoutineStep>
      </RoutineSteps>
    </>
  );
}
