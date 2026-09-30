import {
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
import {
  ErrorAlert,
  PairingInstruction,
  PairingStatus,
  PairingToken,
} from '@oppenheimer/frontend-web';
import { Link, useNavigate } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { usePairing } from '../hooks/use-pairing';

/**
 * Settings → Hosts → Add a host (`design/version1/Settings.dc.html`,
 * `product/versions/mvp/05-screens.md`), a page so the Settings frame stays
 * around it; the console pairs in a dialog instead (`hosts/dialogs/add-host.tsx`).
 * The Install and Connect steps tick done on the same event, because
 * installing is what connects. Both finish on a registered host
 * (`usePairing`'s rules).
 */
export function AddHostScreen() {
  const { t } = useTranslation();
  const back = { to: '/settings/hosts' as const };
  const navigate = useNavigate();
  const { pairing, expiresAt, expired, host, isPending, error, regenerate, done } = usePairing(
    t('hosts.add.defaultName'),
    'registered',
  );

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
              <Button type="button" size="sm" disabled={!done} onClick={() => navigate(back)}>
                {t('hosts.add.done')}
              </Button>
            </>
          }
        />
        <PageHeaderMeta>
          <span>{t('hosts.add.meta')}</span>
        </PageHeaderMeta>
      </PageHeader>

      <ErrorAlert error={error} fallback={t('hosts.pairing.mintFailed')} className="mb-6" />

      <RoutineSteps>
        <RoutineStep
          number={1}
          title={t('hosts.add.install.title')}
          subtitle={t('hosts.add.install.subtitle')}
          done={done}
          summary={t('hosts.add.install.done')}
        >
          <div className="flex flex-col gap-2">
            <PairingInstruction pairing={pairing ?? null} layout="panel" />

            <PairingToken
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
          done={done}
          summary={host ? [host.name, host.os].filter(Boolean).join(' · ') : undefined}
          last
        >
          <div className="rounded-md border border-border-subtle bg-card px-3.5">
            <PairingStatus host={host} />
          </div>
        </RoutineStep>
      </RoutineSteps>
    </>
  );
}
