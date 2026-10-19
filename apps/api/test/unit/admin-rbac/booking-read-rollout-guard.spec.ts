import { describe, expect, it } from 'vitest';

const rolloutModuleUrl = new URL(
  '../../../../../prisma/rollouts/add-booking-read-permission.mjs',
  import.meta.url,
).href;
const { assertSafeTargets } = (await import(rolloutModuleUrl)) as {
  assertSafeTargets(environment: Record<string, string>): {
    database: string;
    host: string;
    port: number;
    url: URL;
  };
};

const testDatabaseUrl =
  'mysql://vexgo_feature07_test:test@127.0.0.1:3010/vexgo_feature07_test';
const runtimeDatabaseUrl =
  'mysql://vexgo_f07_app:test@127.0.0.1:3010/vexgo_feature07';
const shadowDatabaseUrl =
  'mysql://root:test@127.0.0.1:3010/vexgo_feature07_shadow';

function operatorEnvironment(overrides = {}) {
  return {
    DATABASE_URL:
      'mysql://operator:test@127.0.0.1:3010/vexgo_feature07',
    MIGRATION_URL:
      'mysql://migrator:test@127.0.0.1:3010/vexgo_feature07',
    SHADOW_DATABASE_URL: shadowDatabaseUrl,
    BOOKING_READ_PERMISSION_ROLLOUT_CONFIRM_DATABASE: 'vexgo_feature07',
    ...overrides,
  };
}

function testEnvironment(overrides = {}) {
  return {
    DATABASE_URL: testDatabaseUrl,
    MIGRATION_URL: testDatabaseUrl,
    SHADOW_DATABASE_URL: shadowDatabaseUrl,
    FEATURE07_TEST_DATABASE_URL: testDatabaseUrl,
    FEATURE07_RUNTIME_DATABASE_URL: runtimeDatabaseUrl,
    BOOKING_READ_PERMISSION_ROLLOUT_TEST_MODE: 'true',
    BOOKING_READ_PERMISSION_ROLLOUT_CONFIRM_DATABASE:
      'vexgo_feature07_test',
    ...overrides,
  };
}

describe('booking:read rollout target guard', () => {
  it('allows an operator-confirmed rollout to a valid local runtime database', () => {
    const target = assertSafeTargets(operatorEnvironment());

    expect(target.database).toBe('vexgo_feature07');
    expect(target.port).toBe(3010);
  });

  it('keeps operator connection hosts unchanged while matching loopback aliases', () => {
    const target = assertSafeTargets(
      operatorEnvironment({
        DATABASE_URL:
          'mysql://operator:test@localhost:3010/vexgo_feature07',
        MIGRATION_URL:
          'mysql://migrator:test@127.0.0.1:3010/vexgo_feature07',
        SHADOW_DATABASE_URL:
          'mysql://root:test@[::1]:3010/vexgo_feature07_shadow',
      }),
    );

    expect(target.database).toBe('vexgo_feature07');
    expect(target.host).toBe('localhost');
    expect(target.url.hostname).toBe('localhost');
  });

  it('preserves explicitly confirmed operator rollouts to a remote database', () => {
    const target = assertSafeTargets(
      operatorEnvironment({
        DATABASE_URL:
          'mysql://operator:test@db.example.test:3306/vexgo_production',
        MIGRATION_URL:
          'mysql://migrator:test@db.example.test:3306/vexgo_production',
        SHADOW_DATABASE_URL:
          'mysql://root:test@db.example.test:3306/vexgo_production_shadow',
        BOOKING_READ_PERMISSION_ROLLOUT_CONFIRM_DATABASE:
          'vexgo_production',
      }),
    );

    expect(target.database).toBe('vexgo_production');
    expect(target.host).toBe('db.example.test');
  });

  it('allows the test mode only on its explicitly configured isolated DB', () => {
    const target = assertSafeTargets(testEnvironment());

    expect(target.database).toBe('vexgo_feature07_test');
    expect(target.port).toBe(3010);
  });

  it('rejects the runtime database in test mode even with matching confirmation', () => {
    expect(() =>
      assertSafeTargets(
        testEnvironment({
          DATABASE_URL: runtimeDatabaseUrl,
          MIGRATION_URL: runtimeDatabaseUrl,
          BOOKING_READ_PERMISSION_ROLLOUT_CONFIRM_DATABASE: 'vexgo_feature07',
        }),
      ),
    ).toThrow();
  });

  it('rejects the original VexGo database for an operator rollout', () => {
    expect(() =>
      assertSafeTargets(
        operatorEnvironment({
          DATABASE_URL: 'mysql://root:test@127.0.0.1:3010/vexgo',
          MIGRATION_URL: 'mysql://root:test@127.0.0.1:3010/vexgo',
          BOOKING_READ_PERMISSION_ROLLOUT_CONFIRM_DATABASE: 'vexgo',
        }),
      ),
    ).toThrow(/original VexGo database/);
  });

  it('rejects operator targets without an exact schema confirmation', () => {
    expect(() =>
      assertSafeTargets(
        operatorEnvironment({
          BOOKING_READ_PERMISSION_ROLLOUT_CONFIRM_DATABASE:
            'vexgo_feature07_other',
        }),
      ),
    ).toThrow(/exactly match/);
  });

  it('rejects operator targets where migration and runtime URLs differ', () => {
    expect(() =>
      assertSafeTargets(
        operatorEnvironment({
          MIGRATION_URL:
            'mysql://migrator:test@127.0.0.1:3010/vexgo_feature07_other',
        }),
      ),
    ).toThrow(/same database/);
  });

  it('rejects an operator target that aliases the shadow database', () => {
    expect(() =>
      assertSafeTargets(
        operatorEnvironment({
          SHADOW_DATABASE_URL:
            'mysql://root:test@127.0.0.1:3010/VEXGO_FEATURE07',
        }),
      ),
    ).toThrow(/separate database/);
  });

  it('treats schema-case variants as the same migration target', () => {
    const target = assertSafeTargets(
      operatorEnvironment({
        MIGRATION_URL:
          'mysql://migrator:test@127.0.0.1:3010/VEXGO_FEATURE07',
      }),
    );

    expect(target.database).toBe('vexgo_feature07');
  });

  it('rejects an arbitrary local schema even when its port is allowed', () => {
    expect(() =>
      assertSafeTargets(
        operatorEnvironment({
          DATABASE_URL:
            'mysql://operator:test@127.0.0.1:3010/arbitrary_schema',
          MIGRATION_URL:
            'mysql://migrator:test@127.0.0.1:3010/arbitrary_schema',
          BOOKING_READ_PERMISSION_ROLLOUT_CONFIRM_DATABASE:
            'arbitrary_schema',
        }),
      ),
    ).toThrow(/restricted/);
  });

  it('rejects runtime, shadow and arbitrary targets in test mode', () => {
    for (const url of [
      runtimeDatabaseUrl,
      shadowDatabaseUrl,
      'mysql://vexgo_feature07_test:test@192.0.2.10:3010/vexgo_feature07_test',
      'mysql://vexgo_feature07_test:test@127.0.0.1:3306/vexgo_feature07_test',
      'mysql://root:test@127.0.0.1:3010/vexgo_feature07_test',
      'mysql://vexgo_feature07_test:test@127.0.0.1:3010/vexgo',
    ]) {
      expect(() =>
        assertSafeTargets(
          testEnvironment({ DATABASE_URL: url, MIGRATION_URL: url }),
        ),
      ).toThrow();
    }
  });
});
