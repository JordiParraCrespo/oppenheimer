import type {
  ConfigDocument,
  ConfigManagerOptions,
  IConfigProvider,
  IConfigStorage,
  VersionedConfig,
} from './config.manager.types';
import { type DeepPartial, deepMerge } from './deep-merge';

type Listener = () => void;

/**
 * Merges three layers — static, cached, remote — each deep-merged over the one
 * before, and publishes the result.
 *
 * No React, no native imports. The app injects provider and storage.
 */
export class ConfigManager<T extends VersionedConfig> {
  private readonly staticConfig: T;
  private readonly provider: IConfigProvider<T> | undefined;
  private readonly storage: IConfigStorage<T> | undefined;
  private readonly listeners = new Set<Listener>();

  private current: T;
  private loadPromise: Promise<void> | undefined;

  constructor({ staticConfig, provider, storage }: ConfigManagerOptions<T>) {
    this.staticConfig = staticConfig;
    this.provider = provider;
    this.storage = storage;
    this.current = this.merge(storage?.read());
  }

  getAll(): T {
    return this.current;
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * Fetches the remote layer once. Never rejects: a provider that throws or a
   * document written for a newer build leaves the current config in place.
   */
  load(): Promise<void> {
    this.loadPromise ??= this.fetchRemote();
    return this.loadPromise;
  }

  private async fetchRemote(): Promise<void> {
    if (this.provider === undefined) return;

    let document: ConfigDocument<T> | undefined;
    try {
      document = await this.provider.fetch();
    } catch {
      return;
    }

    if (document === undefined || !this.accepts(document)) return;

    this.storage?.write(document);
    this.current = this.merge(document);
    for (const listener of this.listeners) listener();
  }

  accepts(document: ConfigDocument<T>): boolean {
    return (document.minRequiredVersion ?? 0) <= this.staticConfig.version;
  }

  private merge(document: ConfigDocument<T> | undefined): T {
    if (document === undefined || !this.accepts(document)) return this.staticConfig;

    const { minRequiredVersion: _ignored, ...values } = document;
    return {
      ...deepMerge(this.staticConfig, values as DeepPartial<T>),
      version: this.staticConfig.version,
    };
  }
}
