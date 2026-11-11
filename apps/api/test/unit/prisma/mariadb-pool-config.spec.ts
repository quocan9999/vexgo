import { describe, expect, it } from 'vitest';
import {
  parseMariaDbPoolConfig,
  resolvePrismaDatasourceUrls,
} from '../../../src/prisma/mariadb-pool-config.js';
// @ts-expect-error -- ESM helper for Prisma seed scripts
import { databaseConfig } from '../../../../../prisma/lib/db-config.mjs';

describe('parseMariaDbPoolConfig', () => {
  it('parses standard local mysql URL without SSL', () => {
    const config = parseMariaDbPoolConfig(
      'mysql://vexgo_app:vexgo_dev_password@127.0.0.1:3306/vexgo',
    );
    expect(config).toEqual({
      host: '127.0.0.1',
      port: 3306,
      user: 'vexgo_app',
      password: 'vexgo_dev_password',
      database: 'vexgo',
      allowPublicKeyRetrieval: true,
    });
  });

  it('enables SSL when Aiven ssl-mode=REQUIRED, sslaccept=accept_invalid_certs, or ssl=true is present and decodes credentials', () => {
    const aivenConfig = parseMariaDbPoolConfig(
      'mysql://avnadmin:p%40ss%3A1@mysql-vexgo.aivencloud.com:25060/defaultdb?ssl-mode=REQUIRED',
    );
    expect(aivenConfig).toEqual({
      host: 'mysql-vexgo.aivencloud.com',
      port: 25060,
      user: 'avnadmin',
      password: 'p@ss:1',
      database: 'defaultdb',
      allowPublicKeyRetrieval: true,
      ssl: { rejectUnauthorized: false },
    });

    const prismaSslAcceptConfig = parseMariaDbPoolConfig(
      'mysql://avnadmin:secret@mysql-vexgo.aivencloud.com:25060/defaultdb?sslaccept=accept_invalid_certs',
    );
    expect(prismaSslAcceptConfig.ssl).toEqual({ rejectUnauthorized: false });

    const sslBoolConfig = parseMariaDbPoolConfig(
      'mysql://avnadmin:secret@mysql-vexgo.aivencloud.com:25060/defaultdb?ssl=true',
    );
    expect(sslBoolConfig.ssl).toEqual({ rejectUnauthorized: false });
  });

  it('rejects non-mysql protocols', () => {
    expect(() =>
      parseMariaDbPoolConfig('postgresql://user:pass@localhost:5432/db'),
    ).toThrow('DATABASE_URL must use the mysql: protocol');
  });
});

describe('resolvePrismaDatasourceUrls', () => {
  it('falls back to DATABASE_URL and injects sslaccept=accept_invalid_certs for Aiven ssl-mode=REQUIRED URLs', () => {
    const result = resolvePrismaDatasourceUrls({
      DATABASE_URL:
        'mysql://avnadmin:pass@mysql-vexgo.aivencloud.com:25060/defaultdb?ssl-mode=REQUIRED',
    });
    expect(result).toEqual({
      url: 'mysql://avnadmin:pass@mysql-vexgo.aivencloud.com:25060/defaultdb?ssl-mode=REQUIRED&sslaccept=accept_invalid_certs',
      shadowDatabaseUrl: undefined,
    });
  });

  it('throws when SHADOW_DATABASE_URL targets the same database as DATABASE_URL or MIGRATION_URL', () => {
    expect(() =>
      resolvePrismaDatasourceUrls({
        DATABASE_URL: 'mysql://root:pass@127.0.0.1:3306/vexgo',
        MIGRATION_URL: 'mysql://root:pass@127.0.0.1:3306/vexgo',
        SHADOW_DATABASE_URL: 'mysql://root:pass@127.0.0.1:3306/vexgo',
      }),
    ).toThrow(
      'SHADOW_DATABASE_URL must target a database separate from DATABASE_URL and MIGRATION_URL.',
    );
  });
});

describe('prisma/lib/db-config.mjs', () => {
  it('parses SSL and credentials in prisma/lib/db-config.mjs for seed scripts', () => {
    expect(
      databaseConfig('mysql://vexgo_app:vexgo_dev_password@127.0.0.1:3306/vexgo'),
    ).toEqual({
      host: '127.0.0.1',
      port: 3306,
      user: 'vexgo_app',
      password: 'vexgo_dev_password',
      database: 'vexgo',
      allowPublicKeyRetrieval: true,
    });

    expect(
      databaseConfig(
        'mysql://avnadmin:p%40ss%3A1@mysql-vexgo.aivencloud.com:25060/defaultdb?ssl-mode=REQUIRED',
      ),
    ).toEqual({
      host: 'mysql-vexgo.aivencloud.com',
      port: 25060,
      user: 'avnadmin',
      password: 'p@ss:1',
      database: 'defaultdb',
      allowPublicKeyRetrieval: true,
      ssl: { rejectUnauthorized: false },
    });

    expect(
      databaseConfig(
        'mysql://avnadmin:p%40ss%3A1@mysql-vexgo.aivencloud.com:25060/defaultdb?sslaccept=accept_invalid_certs',
      ).ssl,
    ).toEqual({ rejectUnauthorized: false });
  });
});
