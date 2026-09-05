import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Adds specialist kitchen roles and item-level assignments without changing
 * the existing order/payment model. Every operation tolerates a database
 * which was partially updated by synchronize.
 */
export class ItemKitchenAssignments1720000000000 implements MigrationInterface {
  name = 'ItemKitchenAssignments1720000000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TYPE "users_role_enum" ADD VALUE IF NOT EXISTS 'chef_main_kitchen'`);
    await queryRunner.query(`ALTER TYPE "users_role_enum" ADD VALUE IF NOT EXISTS 'bar_man'`);
    await queryRunner.query(`ALTER TYPE "users_role_enum" ADD VALUE IF NOT EXISTS 'juice_maker'`);
    await queryRunner.query(`ALTER TYPE "users_role_enum" ADD VALUE IF NOT EXISTS 'coffee_lady'`);

    await queryRunner.query(`ALTER TABLE "order_items" ADD COLUMN IF NOT EXISTS "assignedKitchenWorkerId" integer`);
    await queryRunner.query(`
      UPDATE "order_items" item
      SET "assignedKitchenWorkerId" = o."chefId"
      FROM "orders" o
      WHERE item."orderId" = o."id"
        AND item."assignedKitchenWorkerId" IS NULL
        AND o."chefId" IS NOT NULL
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_order_items_assignedKitchenWorkerId"
      ON "order_items" ("assignedKitchenWorkerId")
    `);
    await queryRunner.query(`
      DO $$ BEGIN
        IF NOT EXISTS (
          SELECT 1
          FROM pg_constraint c
          WHERE c.conrelid = '"order_items"'::regclass
            AND c.contype = 'f'
            AND (
              SELECT a.attnum
              FROM pg_attribute a
              WHERE a.attrelid = c.conrelid
                AND a.attname = 'assignedKitchenWorkerId'
            ) = ANY(c.conkey)
        ) THEN
          ALTER TABLE "order_items"
            ADD CONSTRAINT "FK_order_items_assignedKitchenWorkerId"
            FOREIGN KEY ("assignedKitchenWorkerId") REFERENCES "users"("id")
            ON DELETE SET NULL;
        END IF;
      END $$;
    `);
  }

  async down(): Promise<void> {
    // Deliberately retain assignments and enum values on production rollback.
  }
}