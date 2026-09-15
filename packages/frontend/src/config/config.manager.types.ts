export type VersionedConfig = {
  /** Build-time schema version. Remote documents with a higher minRequiredVersion are refused. */
  version: number;
};

export type ConfigDocument<T extends VersionedConfig> = Partial<T> & {
  minRequiredVersion?: number;
};

export interface IConfigProvider<T extends VersionedConfig> {
  fetch(): Promise<ConfigDocument<T> | undefined>;
}

export interface IConfigStorage<T extends VersionedConfig> {
  read(): ConfigDocument<T> | undefined;
  write(document: ConfigDocument<T>): void;
}

export type ConfigManagerOptions<T extends VersionedConfig> = {
  staticConfig: T;
  provider?: IConfigProvider<T>;
  storage?: IConfigStorage<T>;
};
