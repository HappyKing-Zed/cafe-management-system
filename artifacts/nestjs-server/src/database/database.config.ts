import type { ConfigService } from '@nestjs/config';
import type { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { DATABASE_ENTITIES } from './database.entities';
import { OrderLifecycle1710000000000 } from './migrations/1710000000000-OrderLifecycle';

export function createDatabaseOptions(databaseUrl?: string, nodeEnv = process.env.NODE_ENV, allowSynchronize = process.env.DATABASE_SYNCHRONIZE === 'true'): TypeOrmModuleOptions {
  const isProduction = nodeEnv === 'production';
  return {
    type: 'postgres',
    url: databaseUrl,
    entities: DATABASE_ENTITIES,
    // synchronize is only for explicitly disposable development databases.
    synchronize: !isProduction && nodeEnv === 'development' && allowSynchronize,
    migrations: [OrderLifecycle1710000000000],
    migrationsRun: isProduction,
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