import type { ConfigManager } from '@oppenheimer/frontend-core/config';
import {
  type ConfigPath,
  type ConfigPathValue,
  getAttribute,
} from '@oppenheimer/frontend-core/config';
import { createContext, useCallback, useContext, useSyncExternalStore } from 'react';
import type { AppConfig } from '../lib/app-config';
import { configManager } from '../lib/config-manager';

export const ConfigManagerContext = createContext(configManager);

export function useConfigManager(): ConfigManager<AppConfig> {
  return useContext(ConfigManagerContext);
}

export function useConfig(): AppConfig;
export function useConfig<P extends ConfigPath<AppConfig>>(path: P): ConfigPathValue<AppConfig, P>;
export function useConfig(path?: ConfigPath<AppConfig>): unknown {
  const manager = useConfigManager();
  const subscribe = useCallback((listener: () => void) => manager.subscribe(listener), [manager]);
  const getSnapshot = useCallback(
    () => (path === undefined ? manager.getAll() : getAttribute(manager.getAll(), path)),
    [manager, path],
  );
  return useSyncExternalStore(subscribe, getSnapshot);
}
