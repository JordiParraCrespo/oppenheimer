import { test as setup } from '@playwright/test';
import { buildFleet } from '../../support/fleet';

// Builds the runner and starts the git server every host clones from: in the
// host image on its own network by default, or on this machine with
// `FLEET_HOSTS=local` (`support/fleet-local.ts`).
setup('build the fleet', () => {
  setup.setTimeout(600_000);
  buildFleet();
});
