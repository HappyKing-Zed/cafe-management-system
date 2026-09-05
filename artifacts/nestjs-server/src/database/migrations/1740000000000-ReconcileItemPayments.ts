import { MigrationInterface, QueryRunner } from 'typeorm';

export class ReconcileItemPayments1740000000000 implements MigrationInterface {
  name = 'ReconcileItemPayments1740000000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    // Remove only ambiguous legacy mappings. Valid partial-payment mappings have
    // one link per item and reconcile exactly to the parent order total.
    await queryRunner.query(`
      DELETE FROM "payment_items" pi
      USING "order_items" oi, "orders" o
      WHERE pi."orderItemId" = oi.id
        AND oi."orderId" = o.id
        AND o.status = 'paid'
        AND (SELECT COUNT(*) FROM "payments" p WHERE p."orderId" = o.id) > 1
        AND (
          (SELECT COUNT(*) FROM "payment_items" x
            INNER JOIN "order_items" xi ON xi.id = x."orderItemId"
            WHERE xi."orderId" = o.id) <> (SELECT COUNT(*) FROM "order_items" y WHERE y."orderId" = o.id)
          OR
          (SELECT COALESCE(SUM(x.amount), 0) FROM "payment_items" x
            INNER JOIN "order_items" xi ON xi.id = x."orderItemId"
            WHERE xi."orderId" = o.id) <> o."totalAmount"
        )
    `);

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
      ON CONFLICT ("orderItemId") DO UPDATE
        SET "paymentId" = EXCLUDED."paymentId", "amount" = EXCLUDED.amount
    `);
  }

  async down(): Promise<void> {
    // Reconciliation is intentionally not reversed.
  }
}