import 'reflect-metadata';
import * as assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import {
  createDatabaseOptionsFromConfig,
} from '../src/database/database.config';

const DATABASE_OPTIONS = Symbol('DATABASE_OPTIONS');

test('loads database options after a fixture .env file is initialized', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'jima-database-config-'));
  const envFilePath = join(directory, '.env');
  const fixtureUrl =
    'postgresql://fixture-host:5432/fixture-database?sslmode=require';
  const previousUrl = process.env.DATABASE_URL;

  await writeFile(envFilePath, `DATABASE_URL=${fixtureUrl}\n`, 'utf8');
  delete process.env.DATABASE_URL;

  @Module({
    imports: [ConfigModule.forRoot({ envFilePath, isGlobal: true })],
    providers: [
      {
        provide: DATABASE_OPTIONS,
        inject: [ConfigService],
        useFactory: createDatabaseOptionsFromConfig,
      },
    ],
  })
  class FixtureConfigModule {}

  const app = await NestFactory.createApplicationContext(FixtureConfigModule, {
    logger: false,
  });

  try {
    const options = app.get(DATABASE_OPTIONS);
    assert.equal(options.url, fixtureUrl);
    assert.equal(options.synchronize, true);
    assert.deepEqual(options.ssl, { rejectUnauthorized: false });
    assert.equal(Array.isArray(options.entities) ? options.entities.length : 0, 18);
  } finally {
    await app.close();
    await rm(directory, { recursive: true, force: true });
    if (previousUrl === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = previousUrl;
  }
});