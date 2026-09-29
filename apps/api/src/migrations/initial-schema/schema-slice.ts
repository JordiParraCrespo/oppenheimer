/**
 * One module's part of the baseline: its tables, each with its keys, checks
 * and indexes, and the foreign keys those tables declare. The foreign keys run
 * once every table exists, so a slice may reference a table from another.
 */
export interface SchemaSlice {
  tables: Record<string, string[]>;
  foreignKeys: string[];
}
