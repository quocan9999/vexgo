import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import { config as loadDotenv } from 'dotenv';
import { afterEach, describe, expect, it } from 'vitest';
import { PrismaClient } from '../../../src/generated/prisma/client.js';

loadDotenv({ path: resolve(process.cwd(), '../../.env') });
loadDotenv({ path: resolve(process.cwd(), '.env') });

function createMigrationTestClient(): PrismaClient {
  const configuredDatabaseUrl = process.env.DATABASE_URL;
  if (!configuredDatabaseUrl) {
    throw new Error(
      'DATABASE_URL is required for the migration integration test',
    );
  }
  const databaseUrl = new URL(configuredDatabaseUrl);
  if (databaseUrl.protocol !== 'mysql:') {
    throw new Error('DATABASE_URL must use the mysql: protocol');
  }

  return new PrismaClient({
    adapter: new PrismaMariaDb({
      host: databaseUrl.hostname,
      port: Number(databaseUrl.port || 3306),
      user: decodeURIComponent(databaseUrl.username),
      password: decodeURIComponent(databaseUrl.password),
      database: decodeURIComponent(databaseUrl.pathname.replace(/^\/+/, '')),
      allowPublicKeyRetrieval: true,
    }),
  });
}

const migrationSqlUrl = new URL(
  '../../../../../prisma/migrations/20261001001000_add_tenant_rbac_management_permissions/migration.sql',
  import.meta.url,
);

const LEGACY_NHA_XE_ADMIN_PERMISSIONS = [
  'vehicle-type:read',
  'vehicle-type:create',
  'vehicle-type:update',
  'vehicle:read',
  'vehicle:create',
  'vehicle:update',
  'seat:read',
  'seat:create',
  'seat:update',
  'seat:delete',
  'route:read',
  'route:create',
  'route:update',
  'fare-price:read',
  'fare-price:create',
  'fare-price:update',
] as const;

const NEW_RBAC_PERMISSIONS = ['role:read', 'permission:assign'] as const;

const CUSTOM_PERMISSION = 'custom:permission';

type MigrationCase = {
  name: string;
  assignedPermissionKeys: readonly string[];
  shouldBootstrap: boolean;
};

const migrationCases: MigrationCase[] = [
  {
    name: 'adds defaults when the legacy canonical mapping is intact',
    assignedPermissionKeys: LEGACY_NHA_XE_ADMIN_PERMISSIONS,
    shouldBootstrap: true,
  },
  {
    name: 'preserves a customized partial mapping',
    assignedPermissionKeys: LEGACY_NHA_XE_ADMIN_PERMISSIONS.slice(0, 15),
    shouldBootstrap: false,
  },
  {
    name: 'preserves a customized empty mapping',
    assignedPermissionKeys: [],
    shouldBootstrap: false,
  },
  {
    name: 'preserves a customized superset mapping',
    assignedPermissionKeys: [
      ...LEGACY_NHA_XE_ADMIN_PERMISSIONS,
      'admin-account:read',
    ],
    shouldBootstrap: false,
  },
  {
    name: 'preserves a same-size mapping with a replacement permission',
    assignedPermissionKeys: [
      ...LEGACY_NHA_XE_ADMIN_PERMISSIONS.slice(0, 15),
      CUSTOM_PERMISSION,
    ],
    shouldBootstrap: false,
  },
];

describe('Admin RBAC management permission migration', () => {
  let prisma: PrismaClient | undefined;

  afterEach(async () => {
    await prisma?.$disconnect();
    prisma = undefined;
  });

  it.each(migrationCases)(
    '$name',
    async ({ assignedPermissionKeys, shouldBootstrap }) => {
      const db = createMigrationTestClient();
      prisma = db;
      await db.$connect();

      const suffix = randomUUID()
        .replaceAll('-', '')
        .slice(0, 24)
        .toUpperCase();
      const tableNames = {
        role: `RBACMig${suffix}_VaiTro`,
        permission: `RBACMig${suffix}_Quyen`,
        assignments: `RBACMig${suffix}_VaiTroQuyen`,
      };
      const quoted = (name: string) => `\`${name}\``;
      const createdTables: string[] = [];

      try {
        await db.$executeRawUnsafe(
          `CREATE TABLE ${quoted(tableNames.role)} (\`vaiTroId\` INT NOT NULL AUTO_INCREMENT, \`tenVaiTro\` VARCHAR(50) NOT NULL, \`moTa\` VARCHAR(255) NULL, PRIMARY KEY (\`vaiTroId\`), UNIQUE KEY (\`tenVaiTro\`)) ENGINE=InnoDB`,
        );
        createdTables.push(tableNames.role);
        await db.$executeRawUnsafe(
          `CREATE TABLE ${quoted(tableNames.permission)} (\`quyenId\` INT NOT NULL AUTO_INCREMENT, \`tenQuyen\` VARCHAR(100) NOT NULL, \`moTa\` VARCHAR(255) NULL, PRIMARY KEY (\`quyenId\`), UNIQUE KEY (\`tenQuyen\`)) ENGINE=InnoDB`,
        );
        createdTables.push(tableNames.permission);
        await db.$executeRawUnsafe(
          `CREATE TABLE ${quoted(tableNames.assignments)} (\`vaiTroId\` INT NOT NULL, \`quyenId\` INT NOT NULL, PRIMARY KEY (\`vaiTroId\`, \`quyenId\`)) ENGINE=InnoDB`,
        );
        createdTables.push(tableNames.assignments);

        await db.$executeRawUnsafe(
          `INSERT INTO ${quoted(tableNames.role)} (\`tenVaiTro\`, \`moTa\`) VALUES ('NHA_XE_ADMIN', 'Quản trị nhà xe')`,
        );
        const permissionFixtures = [
          ...LEGACY_NHA_XE_ADMIN_PERMISSIONS,
          'admin-account:read',
          CUSTOM_PERMISSION,
        ];
        const permissionValues = permissionFixtures
          .map((key) => `('${key}', 'test fixture')`)
          .join(', ');
        await db.$executeRawUnsafe(
          `INSERT INTO ${quoted(tableNames.permission)} (\`tenQuyen\`, \`moTa\`) VALUES ${permissionValues}`,
        );

        if (assignedPermissionKeys.length > 0) {
          const assignedKeys = assignedPermissionKeys
            .map((key) => `'${key}'`)
            .join(', ');
          await db.$executeRawUnsafe(
            `INSERT INTO ${quoted(tableNames.assignments)} (\`vaiTroId\`, \`quyenId\`) SELECT 1, \`quyenId\` FROM ${quoted(tableNames.permission)} WHERE \`tenQuyen\` IN (${assignedKeys})`,
          );
        }

        const migrationSql = await readFile(migrationSqlUrl, 'utf8');
        const statements = migrationSql
          .replace(/^\s*START TRANSACTION\s*;\s*/i, '')
          .replace(/\s*COMMIT\s*;\s*$/i, '')
          .replaceAll('`VaiTroQuyen`', quoted(tableNames.assignments))
          .replaceAll('`VaiTro`', quoted(tableNames.role))
          .replaceAll('`Quyen`', quoted(tableNames.permission))
          .split(';')
          .map((statement) => statement.trim())
          .filter(Boolean);

        await db.$transaction(async (tx) => {
          for (const statement of statements) {
            await tx.$executeRawUnsafe(statement);
          }
        });

        const rolePermissions = await db.$queryRawUnsafe<
          Array<{ tenQuyen: string }>
        >(
          `SELECT ${quoted(tableNames.permission)}.\`tenQuyen\` FROM ${quoted(tableNames.assignments)} AS \`assignment\` JOIN ${quoted(tableNames.permission)} ON ${quoted(tableNames.permission)}.\`quyenId\` = \`assignment\`.\`quyenId\` JOIN ${quoted(tableNames.role)} AS \`role\` ON \`role\`.\`vaiTroId\` = \`assignment\`.\`vaiTroId\` WHERE \`role\`.\`tenVaiTro\` = 'NHA_XE_ADMIN' ORDER BY ${quoted(tableNames.permission)}.\`tenQuyen\``,
        );
        const catalogRows = await db.$queryRawUnsafe<
          Array<{ tenQuyen: string }>
        >(
          `SELECT \`tenQuyen\` FROM ${quoted(tableNames.permission)} WHERE \`tenQuyen\` IN ('role:read', 'permission:assign') ORDER BY \`tenQuyen\``,
        );

        const expectedPermissionKeys = shouldBootstrap
          ? [...assignedPermissionKeys, ...NEW_RBAC_PERMISSIONS]
          : [...assignedPermissionKeys];
        expect(rolePermissions.map(({ tenQuyen }) => tenQuyen).sort()).toEqual(
          expectedPermissionKeys.sort(),
        );
        expect(catalogRows.map(({ tenQuyen }) => tenQuyen).sort()).toEqual(
          [...NEW_RBAC_PERMISSIONS].sort(),
        );
      } finally {
        for (const tableName of createdTables.reverse()) {
          await db.$executeRawUnsafe(
            `DROP TABLE IF EXISTS ${quoted(tableName)}`,
          );
        }
      }
    },
  );
});
