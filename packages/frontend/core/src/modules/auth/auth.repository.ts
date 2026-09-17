import { inject, injectable } from 'inversify';
import { TOKENS } from '../../di/tokens';
import type {
  AuthSession,
  IAuthClient,
  SignUpParams,
  SocialAuthIntent,
  SocialProvider,
} from './auth.client';

/**
 * Thin adapter over the platform {@link IAuthClient}. Keeps the service layer
 * decoupled from the concrete Better Auth client implementation.
 */
@injectable()
export class AuthRepository {
  constructor(@inject(TOKENS.AuthClient) private readonly client: IAuthClient) {}

  login(email: string, password: string): Promise<void> {
    return this.client.signIn(email, password);
  }

  register(params: SignUpParams): Promise<void> {
    return this.client.signUp(params);
  }

  socialLogin(provider: SocialProvider, intent?: SocialAuthIntent): Promise<void> {
    return this.client.signInSocial(provider, intent);
  }

  getSession(): Promise<AuthSession | null> {
    return this.client.getSession();
  }

  forgotPassword(email: string): Promise<void> {
    return this.client.forgotPassword(email);
  }

  resetPassword(token: string, password: string): Promise<void> {
    return this.client.resetPassword(token, password);
  }

  changePassword(currentPassword: string, newPassword: string): Promise<void> {
    return this.client.changePassword(currentPassword, newPassword);
  }

  logout(): Promise<void> {
    return this.client.signOut();
  }
}
