import { Column, type ColumnOptions, CreateDateColumn, UpdateDateColumn } from 'typeorm';

/**
 * The one column type a point in time is stored as.
 *
 * `timestamp without time zone` is TypeORM's default for a date column, and it
 * is the wrong one: the value goes out without an offset, the browser reads it
 * as local time, and every date the console renders is out by the reader's
 * offset. A `timestamptz` column states the instant, so it survives every hop.
 *
 * Every date column is declared through the decorators below, which fix the
 * type, so leaving it out cannot pick the default. `pnpm check:api-structure`
 * fails an ORM entity that reaches for TypeORM's date decorators or spells a
 * timestamp type itself.
 */
export const TIMESTAMP_COLUMN_TYPE = 'timestamptz';

type TimestampOptions = Omit<ColumnOptions, 'type'>;

/** A point in time the application sets: `expiresAt`, `stoppedAt`, … */
export function TimestampColumn(options: TimestampOptions = {}): PropertyDecorator {
  return Column({ ...options, type: TIMESTAMP_COLUMN_TYPE });
}

/** When the row was inserted, set by the database. */
export function CreatedAtColumn(options: TimestampOptions = {}): PropertyDecorator {
  return CreateDateColumn({ ...options, type: TIMESTAMP_COLUMN_TYPE });
}

/** When the row last changed, set by TypeORM on every save. */
export function UpdatedAtColumn(options: TimestampOptions = {}): PropertyDecorator {
  return UpdateDateColumn({ ...options, type: TIMESTAMP_COLUMN_TYPE });
}
