import { MigrationInterface, QueryRunner } from 'typeorm';

export class ItemPayments1730000000000 implements MigrationInterface {
  name = 'ItemPayments1730000000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "payment_items" (
        "id" SERIAL NOT NULL,
        "amount" numeric(10,2) NOT NULL,
        "paymentId" integer NOT NULL,
        "orderItemId" integer NOT NULL,
        CONSTRAINT "PK_payment_items_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_payment_items_order_item" UNIQUE ("orderItemId"),
        CONSTRAINT "FK_payment_items_payment" FOREIGN KEY ("paymentId") REFERENCES "payments"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_payment_items_order_item" FOREIGN KEY ("orderItemId") REFERENCES "order_items"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_payment_items_payment" ON "payment_items" ("paymentId")`);

    await queryRunner.query(`
      WITH single_payments AS (
        SELECT p."orderId", MAX(p.id) AS "paymentId"
        FROM "payments" p
        GROUP BY p."orderId"
        HAVING COUNT(*) = 1
      ),
      allocation AS (
        SELECT oi.id AS "orderItemId", sp."paymentId",
          FLOOR((o."totalAmount" * 100) * (oi."unitPrice" * oi.quantity) /
            NULLIF(SUM(oi."unitPrice" * oi.quantity) OVER (PARTITION BY o.id), 0))::integer AS base_cents,
          ((o."totalAmount" * 100) * (oi."unitPrice" * oi.quantity) /
            NULLIF(SUM(oi."unitPrice" * oi.quantity) OVER (PARTITION BY o.id), 0)) % 1 AS fraction,
          o.id AS "orderId",
          ROUND(o."totalAmount" * 100)::integer AS total_cents
        FROM "order_items" oi
        INNER JOIN "orders" o ON o.id = oi."orderId" AND o.status = 'paid'
        INNER JOIN single_payments sp ON sp."orderId" = o.id
      ),
      ranked AS (
        SELECT *,
          ROW_NUMBER() OVER (PARTITION BY "orderId" ORDER BY fraction DESC, "orderItemId") AS remainder_rank,
          total_cents - SUM(base_cents) OVER (PARTITION BY "orderId") AS remainder_cents
        FROM allocation
      )
      INSERT INTO "payment_items" ("paymentId", "orderItemId", "amount")
      SELECT "paymentId", "orderItemId",
        (base_cents + CASE WHEN remainder_rank <= remainder_cents THEN 1 ELSE 0 END) / 100.0
      FROM ranked
      ON CONFLICT ("orderItemId") DO NOTHING
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "payment_items"`);
  }
}