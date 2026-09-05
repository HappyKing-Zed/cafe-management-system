import { MigrationInterface, QueryRunner } from 'typeorm';

export class StoreKeeperRoles1750000000000 implements MigrationInterface {
  name = 'StoreKeeperRoles1750000000000';
  transaction = false;

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TYPE "users_role_enum" ADD VALUE IF NOT EXISTS 'branch_store_keeper'`);
    await queryRunner.query(`ALTER TYPE "users_role_enum" ADD VALUE IF NOT EXISTS 'main_store_keeper'`);
    await queryRunner.query(`
      UPDATE "users"
      SET "role" = CASE
        WHEN "branchId" IS NULL THEN 'main_store_keeper'::"users_role_enum"
        ELSE 'branch_store_keeper'::"users_role_enum"
      END
      WHERE "role" = 'storekeeper'::"users_role_enum"
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      UPDATE "users"
      SET "role" = 'storekeeper'::"users_role_enum"
      WHERE "role" IN (
        'branch_store_keeper'::"users_role_enum",
        'main_store_keeper'::"users_role_enum"
      )
    `);
  }
}