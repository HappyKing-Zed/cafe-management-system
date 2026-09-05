import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Safe for databases which were previously managed with synchronize: every
 * DDL operation is guarded, and existing rows are explicitly backfilled.
 */
export class OrderLifecycle1710000000000 implements MigrationInterface {
  name = 'OrderLifecycle1710000000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "order_items_status_enum" AS ENUM
          ('pending', 'confirmed', 'accepted', 'preparing', 'ready', 'served');
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$;
    `);
    await queryRunner.query(`ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "customerPhone" varchar`);
    await queryRunner.query(`ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "orderNumber" integer`);
    await queryRunner.query(`CREATE SEQUENCE IF NOT EXISTS "orders_orderNumber_seq"`);
    await queryRunner.query(`ALTER SEQUENCE "orders_orderNumber_seq" OWNED BY "orders"."orderNumber"`);

    // Re-number deterministically. This also repairs any partially-created
    // synchronize column before the unique constraint is installed.
    // Move existing values out of the target range first. This avoids a
    // transient unique-constraint conflict on dev databases where synchronize
    // already created a unique orderNumber column.
    await queryRunner.query(`
      WITH bounds AS (
        SELECT COALESCE(MAX("orderNumber"), 0) + COUNT(*) + 1 AS offset FROM "orders"
      )
      UPDATE "orders" o SET "orderNumber" = o."orderNumber" + bounds.offset
      FROM bounds WHERE o."orderNumber" IS NOT NULL
    `);
    await queryRunner.query(`
      WITH numbered AS (
        SELECT "id", row_number() OVER (ORDER BY "id")::integer AS number FROM "orders"
      )
      UPDATE "orders" AS o SET "orderNumber" = numbered.number
      FROM numbered WHERE o."id" = numbered."id"
    `);
    await queryRunner.query(`
      SELECT setval(
        '"orders_orderNumber_seq"',
        GREATEST(COALESCE((SELECT MAX("orderNumber") FROM "orders"), 0), 1),
        (SELECT COUNT(*) > 0 FROM "orders")
      )
    `);
    await queryRunner.query(`ALTER TABLE "orders" ALTER COLUMN "orderNumber" SET DEFAULT nextval('"orders_orderNumber_seq"')`);
    await queryRunner.query(`ALTER TABLE "orders" ALTER COLUMN "orderNumber" SET NOT NULL`);
    // synchronize may already have created the unique backing index with this
    // name. IF NOT EXISTS handles both that case and a fresh database without
    // relying on PostgreSQL exception classes for different relation types.
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_orders_orderNumber"
      ON "orders" ("orderNumber")
    `);

    await queryRunner.query(`ALTER TABLE "order_items" ADD COLUMN IF NOT EXISTS "status" "order_items_status_enum"`);
    // Legacy items inherit their aggregate order state, rather than becoming
    // pending and blocking payment/kitchen workflows after deployment.
    await queryRunner.query(`
      UPDATE "order_items" item SET "status" = CASE o."status"::text
        WHEN 'confirmed' THEN 'confirmed'::"order_items_status_enum"
        WHEN 'preparing' THEN 'preparing'::"order_items_status_enum"
        WHEN 'ready' THEN 'ready'::"order_items_status_enum"
        WHEN 'served' THEN 'served'::"order_items_status_enum"
        WHEN 'paid' THEN 'served'::"order_items_status_enum"
        ELSE 'pending'::"order_items_status_enum"
      END
      FROM "orders" o
      WHERE item."orderId" = o."id" AND item."status" IS NULL
    `);
    await queryRunner.query(`ALTER TABLE "order_items" ALTER COLUMN "status" SET DEFAULT 'pending'`);
    await queryRunner.query(`ALTER TABLE "order_items" ALTER COLUMN "status" SET NOT NULL`);
  }

  async down(): Promise<void> {
    // Deliberately retain populated data on rollback.
  }
}