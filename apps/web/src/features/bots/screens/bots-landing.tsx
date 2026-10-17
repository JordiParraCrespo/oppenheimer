import { PageBar } from '@oppenheimer/frontend-web';
import { BotsLanding } from '@/features/bots/sections/bots-landing';

/** `/bots`: the first bot's chat when there is one, else the greeting that makes it. */
export function BotsLandingScreen() {
  return (
    <>
      <PageBar />
      <BotsLanding />
    </>
  );
}
