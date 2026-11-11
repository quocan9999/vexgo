import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { assertFeature07TestDatabase } = require(
  '../../../../prisma/test-support/feature07-test-database.cjs',
) as {
  assertFeature07TestDatabase(options: {
    testDatabaseUrl: string;
    protectedDatabaseUrls: Array<{ name: string; value: string | undefined }>;
    ci?: string;
  }): URL;
};

type TestEnvironment = {
  CI?: string;
  GITHUB_ACTIONS?: string;
  FEATURE07_TEST_DATABASE_URL?: string;
  FEATURE07_RUNTIME_DATABASE_URL?: string;
  MIGRATION_URL?: string;
  SHADOW_DATABASE_URL?: string;
};

export function promotionTestDatabaseUrl(
  raw: string | undefined,
  environment: TestEnvironment = process.env,
): URL {
  if (!raw) throw new Error('DATABASE_URL is required for promotion integration tests.');
  const url = new URL(raw);
  const database = decodeURIComponent(url.pathname.replace(/^\/+/, ''));
  const username = decodeURIComponent(url.username);
  const local = database === 'vexgo_promotion' && username === 'vexgo_promotion_app';
  const ci = environment.CI === 'true' && environment.GITHUB_ACTIONS === 'true' &&
    database === 'vexgo_ci' && username === 'root';
  const feature07 = environment.FEATURE07_TEST_DATABASE_URL === raw;
  if (feature07) {
    return assertFeature07TestDatabase({
      testDatabaseUrl: raw,
      ci: environment.CI,
      protectedDatabaseUrls: [
        {
          name: 'runtime',
          value: environment.FEATURE07_RUNTIME_DATABASE_URL ?? environment.MIGRATION_URL,
        },
        { name: 'migration', value: environment.MIGRATION_URL },
        { name: 'shadow', value: environment.SHADOW_DATABASE_URL },
      ],
    });
  }
  if (url.protocol !== 'mysql:' || url.hostname !== '127.0.0.1' ||
      Number(url.port || 3306) !== 3306 || (!local && !ci)) {
    throw new Error('Promotion tests require the scoped local feature database or the isolated GitHub Actions CI database at 127.0.0.1:3306.');
  }
  return url;
}
