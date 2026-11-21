import { WelcomeScreen } from '../../features/auth/screens/welcome';
import { webUrl } from '../../lib/auth-client';

export default function WelcomeRoute() {
  return <WelcomeScreen webUrl={webUrl} />;
}
