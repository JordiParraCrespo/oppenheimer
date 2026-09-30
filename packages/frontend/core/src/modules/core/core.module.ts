import { applyApiClientConfig } from '@oppenheimer/api-client';
import { ContainerModule } from 'inversify';
import { TOKENS } from '../../di/tokens';
import type { IAnalyticsClient } from '../analytics/analytics.client';
import { NoopAnalyticsClient } from '../analytics/noop-analytics.client';
import type { IAuthClient } from '../auth/auth.client';
import type { FeatureFlagsClientContext } from '../feature-flags/feature-flags.client';
import type { IStorageService } from './storage.service';

export interface CoreModuleConfig {
  apiBaseUrl: string;
  storage: IStorageService;
  authClient: IAuthClient;
  analytics?: IAnalyticsClient;
  /**
   * The platform and build this app reports when it asks for its flags. The
   * API targets on both; identity comes from the session, not from here.
   */
  featureFlags?: FeatureFlagsClientContext;
}

export function createCoreModule(config: CoreModuleConfig): ContainerModule {
  return new ContainerModule(({ bind }) => {
    applyApiClientConfig({
      baseUrl: config.apiBaseUrl,
      credentials: 'include',
      headers: () => config.authClient.getAuthHeaders(),
    });

    bind<string>(TOKENS.ApiBaseUrl).toConstantValue(config.apiBaseUrl);
    bind<IStorageService>(TOKENS.StorageService).toConstantValue(config.storage);
    bind<IAuthClient>(TOKENS.AuthClient).toConstantValue(config.authClient);
    bind<IAnalyticsClient>(TOKENS.AnalyticsClient).toConstantValue(
      config.analytics ?? new NoopAnalyticsClient(),
    );
    bind<FeatureFlagsClientContext>(TOKENS.FeatureFlagsClientContext).toConstantValue(
      config.featureFlags ?? {},
    );
  });
}
