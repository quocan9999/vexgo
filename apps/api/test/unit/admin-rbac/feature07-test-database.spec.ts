import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const { assertFeature07TestDatabase } = require(
  '../../../../../prisma/test-support/feature07-test-database.cjs',
) as {
  assertFeature07TestDatabase(options: {
    testDatabaseUrl: string;
    protectedDatabaseUrls: Array<{ name: string; value: string }>;
    ci?: string;
  }): URL;
};

const worktreeTest =
  'mysql://vexgo_feature07_test:test@127.0.0.1:3010/vexgo_feature07_test';
const runtime =
  'mysql://vexgo_f07_app:test@127.0.0.1:3010/vexgo_feature07';
const migration =
  'mysql://root:test@127.0.0.1:3010/vexgo_feature07';
const shadow =
  'mysql://root:test@127.0.0.1:3010/vexgo_feature07_shadow';

function validate(
  testDatabaseUrl = worktreeTest,
  protectedDatabaseUrls = [
    { name: 'runtime', value: runtime },
    { name: 'migration', value: migration },
    { name: 'shadow', value: shadow },
  ],
) {
  return assertFeature07TestDatabase({
    testDatabaseUrl,
    protectedDatabaseUrls,
    ci: 'false',
  });
}

describe('Feature 07 test database isolation guard', () => {
  it('accepts only the scoped worktree test account and schema on port 3010', () => {
    expect(validate().pathname).toBe('/vexgo_feature07_test');
  });

  it('rejects test and runtime targets that share a schema through loopback aliases', () => {
    expect(() =>
      validate(worktreeTest, [
        {
          name: 'runtime',
          value:
            'mysql://vexgo_feature07_test:test@localhost:3010/vexgo_feature07_test',
        },
        {
          name: 'migration',
          value:
            'mysql://root:test@localhost:3010/vexgo_feature07_test',
        },
        { name: 'shadow', value: shadow },
      ]),
    ).toThrow(/separate from runtime/);
  });

  it('rejects runtime and shadow targets that share a schema through loopback aliases', () => {
    expect(() =>
      validate(worktreeTest, [
        {
          name: 'runtime',
          value: 'mysql://root:test@localhost:3010/vexgo_feature07',
        },
        {
          name: 'migration',
          value: 'mysql://root:test@localhost:3010/vexgo_feature07',
        },
        {
          name: 'shadow',
          value: 'mysql://root:test@[::1]:3010/vexgo_feature07',
        },
      ]),
    ).toThrow(/Runtime and shadow databases must be separate/);
  });

  it('allows different schemas on the same port across loopback aliases', () => {
    expect(
      validate(worktreeTest, [
        {
          name: 'runtime',
          value: 'mysql://root:test@localhost:3010/vexgo_feature07',
        },
        {
          name: 'migration',
          value: 'mysql://root:test@127.0.0.1:3010/vexgo_feature07',
        },
        {
          name: 'shadow',
          value: 'mysql://root:test@[::1]:3010/vexgo_feature07_shadow',
        },
      ]).pathname,
    ).toBe('/vexgo_feature07_test');
  });

  it('keeps the legacy local test port limited to a same-named test account/schema', () => {
    const target =
      'mysql://vexgo_feature07_ci_test:test@127.0.0.1:3307/vexgo_feature07_ci_test';
    const result = validate(target, [
      { name: 'runtime', value: 'mysql://app:p@127.0.0.1:3307/vexgo_feature07' },
      { name: 'migration', value: 'mysql://root:p@127.0.0.1:3307/vexgo_feature07' },
      { name: 'shadow', value: 'mysql://root:p@127.0.0.1:3307/vexgo_feature07_shadow' },
    ]);
    expect(result.pathname).toBe('/vexgo_feature07_ci_test');
  });

  it.each([3306, 3307])(
    'preserves the scoped CI database on port %i',
    (port) => {
      const target = `mysql://vexgo_feature07_ci_test:test@127.0.0.1:${port}/vexgo_feature07_ci_test`;
      expect(
        assertFeature07TestDatabase({
          testDatabaseUrl: target,
          ci: 'true',
          protectedDatabaseUrls: [
            {
              name: 'runtime',
              value: `mysql://root:p@127.0.0.1:${port}/vexgo_ci`,
            },
            {
              name: 'shadow',
              value: `mysql://root:p@127.0.0.1:${port}/vexgo_ci_shadow`,
            },
          ],
        }).pathname,
      ).toBe('/vexgo_feature07_ci_test');
    },
  );

  it('rejects a root account for the Feature 07 CI database', () => {
    expect(() =>
      assertFeature07TestDatabase({
        testDatabaseUrl:
          'mysql://root:test@127.0.0.1:3306/vexgo_feature07_ci_test',
        ci: 'true',
        protectedDatabaseUrls: [
          { name: 'runtime', value: 'mysql://root:p@127.0.0.1:3306/vexgo_ci' },
          {
            name: 'shadow',
            value: 'mysql://root:p@127.0.0.1:3306/vexgo_ci_shadow',
          },
        ],
      }),
    ).toThrow(/scoped vexgo_feature07_ci_test/);
  });

  it('keeps the CI database guard from accepting the local port 3010', () => {
    expect(() =>
      assertFeature07TestDatabase({
        testDatabaseUrl:
          'mysql://vexgo_feature07_ci_test:test@127.0.0.1:3010/vexgo_feature07_ci_test',
        ci: 'true',
        protectedDatabaseUrls: [
          { name: 'runtime', value: 'mysql://root:p@localhost:3010/vexgo_ci' },
          {
            name: 'shadow',
            value: 'mysql://root:p@[::1]:3010/vexgo_ci_shadow',
          },
        ],
      }),
    ).toThrow(/port 3306 or 3307/);
  });

  it.each([
    ['runtime schema', worktreeTest.replace('/vexgo_feature07_test', '/vexgo_feature07')],
    ['root account', worktreeTest.replace('vexgo_feature07_test:test@', 'root:test@')],
    ['wrong account', worktreeTest.replace('vexgo_feature07_test:test@', 'vexgo_f07_app:test@')],
    ['arbitrary host', worktreeTest.replace('127.0.0.1', '192.0.2.1')],
    ['wrong port', worktreeTest.replace('3010', '3306')],
    ['arbitrary schema', worktreeTest.replace('/vexgo_feature07_test', '/vexgo')],
    ['non-MySQL URL', worktreeTest.replace('mysql:', 'https:')],
  ])('rejects a target using %s', (_reason, target) => {
    expect(() => validate(target)).toThrow();
  });

  it.each(['runtime', 'migration', 'shadow'])(
    'rejects the test schema when it aliases %s',
    (name) => {
      const protectedTargets = [
        { name: 'runtime', value: runtime },
        { name: 'migration', value: migration },
        { name: 'shadow', value: shadow },
      ];
      const collision = protectedTargets.find((target) => target.name === name);
      if (!collision) throw new Error(`Missing test fixture ${name}`);
      collision.value = worktreeTest;
      expect(() => validate(worktreeTest, protectedTargets)).toThrow(/separate/);
    },
  );

  it('requires both runtime and shadow targets before allowing DB tests', () => {
    expect(() => validate(worktreeTest, [])).toThrow(/Runtime and shadow/);
  });

  it('allows the rollout to use the isolated test target as MIGRATION_URL', () => {
    expect(
      validate(worktreeTest, [
        { name: 'runtime', value: runtime },
        { name: 'shadow', value: shadow },
      ]).pathname,
    ).toBe('/vexgo_feature07_test');
  });

  it('rejects runtime and shadow targets that alias each other', () => {
    expect(() =>
      validate(worktreeTest, [
        { name: 'runtime', value: runtime },
        { name: 'migration', value: migration },
        { name: 'shadow', value: runtime },
      ]),
    ).toThrow(/Runtime and shadow/);
  });
});
