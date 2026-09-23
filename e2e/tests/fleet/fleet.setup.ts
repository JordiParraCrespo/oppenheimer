import { test as setup } from '@playwright/test';
import { buildFleet } from '../../support/fleet';

// Builds the runner for the Docker daemon's architecture, bakes it into the
// host image, and starts the network and the git server every host clones from.
setup('build the fleet', () => {
  setup.setTimeout(600_000);
  buildFleet();
});
