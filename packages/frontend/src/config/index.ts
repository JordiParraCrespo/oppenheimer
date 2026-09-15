export { ConfigManager } from './config.manager';
export type {
  ConfigDocument,
  ConfigManagerOptions,
  IConfigProvider,
  IConfigStorage,
  VersionedConfig,
} from './config.manager.types';
export { type DeepPartial, deepMerge, isPlainObject } from './deep-merge';
export { type ConfigPath, type ConfigPathValue, getAttribute } from './get-attribute';
