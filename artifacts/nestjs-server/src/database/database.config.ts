import type { ConfigService } from '@nestjs/config';
import type { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { DATABASE_ENTITIES } from './database.entities';
import { OrderLifecycle1710000000000 } from './migrations/1710000000000-OrderLifecycle';
import { ItemKitchenAssignments1720000000000 } from './migrations/1720000000000-ItemKitchenAssignments';
import { ItemPayments1730000000000 } from './migrations/1730000000000-ItemPayments';
import { ReconcileItemPayments1740000000000 } from './migrations/1740000000000-ReconcileItemPayments';

export function createDatabaseOptions(databaseUrl?: string, nodeEnv = process.env.NODE_ENV, allowSynchronize = process.env.DATABASE_SYNCHRONIZE === 'true'): TypeOrmModuleOptions {
  const isProduction = nodeEnv === 'production';
  // Disposable local schemas may use synchronize, but persistent development
  // databases must receive the same durable migrations as production.
  const synchronize = !isProduction && nodeEnv === 'development' && allowSynchronize;
  return {
    type: 'postgres',
    url: databaseUrl,
    entities: DATABASE_ENTITIES,
    // synchronize is only for explicitly disposable development databases.
    synchronize,
    migrations: [OrderLifecycle1710000000000, ItemKitchenAssignments1720000000000, ItemPayments1730000000000, ReconcileItemPayments1740000000000],
    // Never combine schema synchronization and migrations in one startup.
    migrationsRun: !synchronize,
    ssl: databaseUrl?.includes('sslmode=require')
      ? { rejectUnauthorized: false }
      : false,
  };
}

export function createDatabaseOptionsFromConfig(
  config: Pick<ConfigService, 'get'>,
): TypeOrmModuleOptions {
  return createDatabaseOptions(
    config.get<string>('DATABASE_URL'),
    config.get<string>('NODE_ENV'),
    config.get<string>('DATABASE_SYNCHRONIZE') === 'true',
  );
}