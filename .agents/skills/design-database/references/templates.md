# Templates

A migration and an ORM entity in house style. Replace the names; keep the
shape. The SQL spells `timestamptz` as `TIMESTAMP WITH TIME ZONE`, which is how
TypeORM writes it. The migration is the source of truth and the entity
mirrors every column, unique, check and index in it.

## Migration

```ts
import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * <What these tables are for, in a sentence or two.>
 *
 * <The design decisions a reviewer would ask about, each with its reason:
 * why this is its own table, why this ON DELETE, why a column is nullable,
 * why there is (or isn't) soft delete, why a reference has no foreign key.>
 *
 * Access patterns and the index that serves each:
 *   Q1 <the org's open invoices, newest first>  → IDX_invoice_org_status_created
 *   Q2 <an invoice by number within the org>    → UQ_invoice_org_number
 *
 * <Growth and retention, when the table is unbounded: how long rows live and
 * what removes them.>
 */
export class AddInvoices1789000000000 implements MigrationInterface {
  name = 'AddInvoices1789000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "invoice" (
        "id"             uuid NOT NULL DEFAULT gen_random_uuid(),
        "organizationId" uuid NOT NULL,
        "number"         character varying(32) NOT NULL,
        "status"         character varying(16) NOT NULL DEFAULT 'draft',
        "currency"       character(3) NOT NULL,
        "totalAmount"    bigint NOT NULL DEFAULT 0,
        "dueOn"          date,
        "issuedAt"       TIMESTAMP WITH TIME ZONE,
        "createdAt"      TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updatedAt"      TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_invoice" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_invoice_org_number" UNIQUE ("organizationId", "number"),
        CONSTRAINT "CHK_invoice_status"
          CHECK ("status" IN ('draft', 'open', 'paid', 'void')),
        CONSTRAINT "CHK_invoice_currency" CHECK ("currency" ~ '^[A-Z]{3}$'),
        CONSTRAINT "CHK_invoice_total_non_negative" CHECK ("totalAmount" >= 0),
        CONSTRAINT "FK_invoice_organization"
          FOREIGN KEY ("organizationId") REFERENCES "organization"("id")
          ON DELETE CASCADE ON UPDATE NO ACTION
      )
    `);
    // Q1: the org's invoices by status, newest first (keyset on createdAt, id;
    // the index is scanned backwards, so no DESC is needed).
    await queryRunner.query(
      `CREATE INDEX "IDX_invoice_org_status_created" ON "invoice" ("organizationId", "status", "createdAt", "id")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_invoice_org_status_created"`);
    await queryRunner.query(`DROP TABLE "invoice"`);
  }
}
```

## ORM entity

```ts
import { TIMESTAMP_COLUMN_TYPE } from '@oppenheimer/backend-ddd';
import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';

export type InvoiceStatus = 'draft' | 'open' | 'paid' | 'void';

/**
 * Persistence model for the app-owned `invoice` table. The domain aggregate
 * is `InvoiceEntity`; `InvoiceMapper` converts between the two.
 */
@Entity('invoice')
@Unique('UQ_invoice_org_number', ['organizationId', 'number'])
@Check('CHK_invoice_status', `"status" IN ('draft', 'open', 'paid', 'void')`)
@Check('CHK_invoice_currency', `"currency" ~ '^[A-Z]{3}$'`)
@Check('CHK_invoice_total_non_negative', `"totalAmount" >= 0`)
@Index('IDX_invoice_org_status_created', ['organizationId', 'status', 'createdAt', 'id'])
export class InvoiceOrmEntity {
  @PrimaryGeneratedColumn('uuid', { primaryKeyConstraintName: 'PK_invoice' })
  id!: string;

  @Column({ type: 'uuid' })
  organizationId!: string;

  @Column({ type: 'varchar', length: 32 })
  number!: string;

  @Column({ type: 'varchar', length: 16, default: 'draft' })
  status!: InvoiceStatus;

  @Column({ type: 'char', length: 3 })
  currency!: string;

  /** Minor units (cents). `bigint` comes back from `pg` as a string. */
  @Column({ type: 'bigint', default: 0 })
  totalAmount!: string;

  @Column({ type: 'date', nullable: true })
  dueOn!: string | null;

  @Column({ type: TIMESTAMP_COLUMN_TYPE, nullable: true })
  issuedAt!: Date | null;

  @CreateDateColumn({ type: TIMESTAMP_COLUMN_TYPE })
  createdAt!: Date;

  @UpdateDateColumn({ type: TIMESTAMP_COLUMN_TYPE })
  updatedAt!: Date;
}
```

Notes:

- `bigint` and `numeric` are returned by `pg` as strings; type the property
  as `string` and convert in the mapper, never with `Number()` on a value that
  can pass 2^53.
- `date` columns are returned as `'YYYY-MM-DD'` strings; keep them strings
  in the ORM model.
- The ORM model does not declare relations (`@ManyToOne`), like every entity
  here: the aggregate boundary is the module's, and foreign keys live in the
  migration only.
- The primary key carries its name (`primaryKeyConstraintName`, on
  `@PrimaryGeneratedColumn` or `@PrimaryColumn`) so it matches `PK_<table>`.
- Partial indexes carry their predicate
  (`@Index('IDX_x', ['a', 'b'], { where: '"deletedAt" IS NULL' })`);
  expression, GIN, BRIN and mixed-direction indexes are declared with
  `synchronize: false` so TypeORM never tries to rebuild them.
- Register the entity in `apps/api/src/config/data-source.ts` and in the
  module's `TypeOrmModule.forFeature([...])`.
