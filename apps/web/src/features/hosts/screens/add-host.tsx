import { Callout, EditorPageBack, Skeleton } from '@oppenheimer/design-system-web';
import { Link } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { useHostsAvailability } from '../hooks/use-hosts-availability';
import { AddHostHeader } from '../sections/add-host-header';
import { AddHostSteps } from '../sections/add-host-steps';

/**
 * Settings → Hosts → Add a host (`design/version1/Settings.dc.html`,
 * `product/versions/mvp/05-screens.md`), a page so the Settings frame stays
 * around it; the console pairs in a dialog instead (`hosts/dialogs/add-host.tsx`).
 *
 * It asks the deployment first: where it can pair, the steps mint and wait
 * (`AddHostSteps`); where it cannot (`hosts` off), nothing is minted and the
 * page says why instead of showing `HOSTS_004` over steps that cannot finish.
 */
export function AddHostScreen() {
  const { t } = useTranslation();
  const availability = useHostsAvailability();

  return (
    <>
      <EditorPageBack render={<Link to="/settings/hosts" />}>{t('hosts.add.back')}</EditorPageBack>

      {availability === 'available' ? (
        <AddHostSteps />
      ) : (
        <>
          <AddHostHeader />
          {availability === 'unavailable' ? (
            <Callout>{t('hosts.pairing.unavailable')}</Callout>
          ) : (
            <Skeleton className="h-40 w-full" />
          )}
        </>
      )}
    </>
  );
}
