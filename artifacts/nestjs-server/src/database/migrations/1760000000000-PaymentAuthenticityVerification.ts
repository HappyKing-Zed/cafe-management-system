import { MigrationInterface, QueryRunner } from 'typeorm';

export class PaymentAuthenticityVerification1760000000000 implements MigrationInterface {
  name = 'PaymentAuthenticityVerification1760000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "authenticityVerified" boolean NOT NULL DEFAULT false`);
    await queryRunner.query(`ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "verificationProvider" character varying`);
    await queryRunner.query(`ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "verificationStatus" character varying`);
    await queryRunner.query(`ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "verificationMode" character varying`);
    await queryRunner.query(`ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "verificationRequestId" character varying`);
    await queryRunner.query(`ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "verificationReferenceId" character varying`);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "IDX_payments_verified_reference"
      ON "payments" ("reference")
      WHERE "authenticityVerified" = true AND "reference" IS NOT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_payments_verified_reference"`);
    await queryRunner.query(`ALTER TABLE "payments" DROP COLUMN IF EXISTS "verificationReferenceId"`);
    await queryRunner.query(`ALTER TABLE "payments" DROP COLUMN IF EXISTS "verificationRequestId"`);
    await queryRunner.query(`ALTER TABLE "payments" DROP COLUMN IF EXISTS "verificationMode"`);
    await queryRunner.query(`ALTER TABLE "payments" DROP COLUMN IF EXISTS "verificationStatus"`);
    await queryRunner.query(`ALTER TABLE "payments" DROP COLUMN IF EXISTS "verificationProvider"`);
    await queryRunner.query(`ALTER TABLE "payments" DROP COLUMN IF EXISTS "authenticityVerified"`);
  }
}