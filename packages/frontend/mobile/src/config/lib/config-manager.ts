import {
  type ConfigDocument,
  ConfigManager,
  type IConfigProvider,
  type IConfigStorage,
} from '@oppenheimer/frontend-core/config';
import { storage } from '../../platform';
import { type AppConfig, staticConfig } from './app-config';

const CACHE_KEY = 'oppenheimer.remote-config';

const mmkvStorage: IConfigStorage<AppConfig> = {
  read() {
    return storage.getItem<ConfigDocument<AppConfig>>(CACHE_KEY) ?? undefined;
  },
  write(document) {
    storage.setItem(CACHE_KEY, document);
  },
};

const urlProvider: IConfigProvider<AppConfig> | undefined = staticConfig.remote.url
  ? {
      async fetch() {
        const response = await fetch(staticConfig.remote.url as string);
        if (!response.ok) return undefined;
        return (await response.json()) as ConfigDocument<AppConfig>;
      },
    }
  : undefined;

export const configManager = new ConfigManager<AppConfig>({
  staticConfig,
  storage: mmkvStorage,
  provider: urlProvider,
});
