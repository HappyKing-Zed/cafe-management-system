import type { ConfigService } from '@nestjs/config';
import type { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { DATABASE_ENTITIES } from './database.entities';

export function createDatabaseOptions(databaseUrl?: string): TypeOrmModuleOptions {
  return {
    type: 'postgres',
    url: databaseUrl,
    entities: DATABASE_ENTITIES,
    synchronize: true,
    ssl: databaseUrl?.includes('sslmode=require')
      ? { rejectUnauthorized: false }
      : false,
  };
}

export function createDatabaseOptionsFromConfig(
  config: Pick<ConfigService, 'get'>,
): TypeOrmModuleOptions {
  return createDatabaseOptions(config.get<string>('DATABASE_URL'));
}