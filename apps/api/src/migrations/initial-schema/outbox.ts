import type { SchemaSlice } from './schema-slice';

/** `outbox_message`. Its shape is `OutboxMessageSchema` in `@oppenheimer/backend-ddd`. */
export const outbox: SchemaSlice = {
  tables: {
    outbox_message: [
      `CREATE TABLE outbox_message (
        id uuid DEFAULT gen_random_uuid() NOT NULL,
        channel character varying(16) DEFAULT 'event'::character varying NOT NULL,
        topic character varying,
        "eventName" character varying NOT NULL,
        "aggregateId" character varying,
        payload jsonb NOT NULL,
        reason text NOT NULL,
        status character varying(16) DEFAULT 'pending'::character varying NOT NULL,
        attempts integer DEFAULT 0 NOT NULL,
        "availableAt" timestamp with time zone DEFAULT now() NOT NULL,
        "lockedBy" character varying,
        "lockedUntil" timestamp with time zone,
        "lastError" text,
        "correlationId" character varying,
        "createdAt" timestamp with time zone DEFAULT now() NOT NULL,
        "processedAt" timestamp with time zone
      )`,
      `ALTER TABLE outbox_message ADD CONSTRAINT "PK_outbox_message" PRIMARY KEY (id)`,
      `CREATE INDEX "IDX_outbox_message_created_brin" ON outbox_message USING brin ("createdAt")`,
      `CREATE INDEX "IDX_outbox_message_pending" ON outbox_message USING btree ("createdAt") WHERE ((status)::text = 'pending'::text)`,
    ],
  },
  foreignKeys: [],
};
