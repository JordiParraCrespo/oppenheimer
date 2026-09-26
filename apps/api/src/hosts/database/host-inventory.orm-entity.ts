import { TIMESTAMP_COLUMN_TYPE } from '@oppenheimer/backend-ddd';
import type { HostPlatform, HostToolDto } from '@oppenheimer/shared';
import { Check, Column, CreateDateColumn, Entity, PrimaryColumn, UpdateDateColumn } from 'typeorm';

/**
 * Persistence model for `host_inventory`: what the machine is, one row per
 * host, rewritten only when the static facts change (`factsHash`).
 *
 * The fields a screen shows or a rollout counts are columns; the whole report
 * stays in `facts`, so a field a newer runner sends is kept before anything
 * promotes it. See `1789700000000-AddHostInventoryAndPresence.ts`.
 */
@Entity('host_inventory')
@Check('CHK_host_inventory_facts_hash', `"factsHash" ~ '^[0-9a-f]{64}$'`)
@Check(
  'CHK_host_inventory_platform',
  `"platform" IN ('macos', 'debian', 'ubuntu', 'linux', 'unsupported')`,
)
@Check('CHK_host_inventory_cpu_count', `"cpuCount" IS NULL OR "cpuCount" > 0`)
@Check('CHK_host_inventory_memory', `"memoryTotalBytes" IS NULL OR "memoryTotalBytes" > 0`)
@Check('CHK_host_inventory_disk', `"diskTotalBytes" IS NULL OR "diskTotalBytes" > 0`)
@Check('CHK_host_inventory_tools_array', `jsonb_typeof("tools") = 'array'`)
export class HostInventoryOrmEntity {
  @PrimaryColumn({ type: 'uuid', primaryKeyConstraintName: 'PK_host_inventory' })
  hostId!: string;

  /** SHA-256, hex, of the canonical static facts — live numbers excluded. */
  @Column({ type: 'varchar', length: 64 })
  factsHash!: string;

  @Column({ type: 'varchar', length: 16 })
  platform!: HostPlatform;

  /** The distribution's own name, e.g. `Ubuntu 24.04.1 LTS`. */
  @Column({ type: 'varchar', length: 80, nullable: true })
  osName!: string | null;

  @Column({ type: 'varchar', length: 40, nullable: true })
  osVersion!: string | null;

  @Column({ type: 'varchar', length: 64, nullable: true })
  kernelVersion!: string | null;

  @Column({ type: 'varchar', length: 16 })
  arch!: string;

  @Column({ type: 'varchar', length: 255 })
  hostname!: string;

  @Column({ type: 'varchar', length: 128, nullable: true })
  cpuModel!: string | null;

  @Column({ type: 'smallint', nullable: true })
  cpuCount!: number | null;

  /** `bigint` comes back from `pg` as a string. */
  @Column({ type: 'bigint', nullable: true })
  memoryTotalBytes!: string | null;

  @Column({ type: 'bigint', nullable: true })
  diskTotalBytes!: string | null;

  /** `none`, `vm`, `container`, … — the runner's word, deliberately unchecked. */
  @Column({ type: 'varchar', length: 24, nullable: true })
  virtualization!: string | null;

  /** Read from local DMI data, never a metadata call. Unchecked, like `virtualization`. */
  @Column({ type: 'varchar', length: 24, nullable: true })
  cloudProvider!: string | null;

  /** IANA zone, e.g. `Europe/Madrid`. */
  @Column({ type: 'varchar', length: 64, nullable: true })
  timezone!: string | null;

  @Column({ type: TIMESTAMP_COLUMN_TYPE, nullable: true })
  bootedAt!: Date | null;

  @Column({ type: 'varchar', length: 40 })
  runnerVersion!: string;

  @Column({ type: 'varchar', length: 16, nullable: true })
  channel!: string | null;

  /** `launchd` or `systemd`. */
  @Column({ type: 'varchar', length: 16, nullable: true })
  serviceManager!: string | null;

  @Column({ type: 'jsonb', default: () => "'[]'" })
  tools!: HostToolDto[];

  /** The static report as it arrived, for the fields nothing has promoted yet. */
  @Column({ type: 'jsonb' })
  facts!: Record<string, unknown>;

  /** When `factsHash` last changed — not when the host last reported. */
  @Column({ type: TIMESTAMP_COLUMN_TYPE, default: () => 'now()' })
  changedAt!: Date;

  @CreateDateColumn({ type: TIMESTAMP_COLUMN_TYPE })
  createdAt!: Date;

  @UpdateDateColumn({ type: TIMESTAMP_COLUMN_TYPE })
  updatedAt!: Date;
}
