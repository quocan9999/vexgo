import { describe, expect, it } from 'vitest';
import { promotionTestDatabaseUrl } from '../../support/promotion-test-database.js';

const local = 'mysql://vexgo_promotion_app:test@127.0.0.1:3306/vexgo_promotion';
const ci = 'mysql://root:test@127.0.0.1:3306/vexgo_ci';
const feature07 = 'mysql://vexgo_feature07_test:test@127.0.0.1:3010/vexgo_feature07_test';
const github = { CI: 'true', GITHUB_ACTIONS: 'true' };
const feature07Environment = {
  CI: 'false',
  FEATURE07_TEST_DATABASE_URL: feature07,
  FEATURE07_RUNTIME_DATABASE_URL: 'mysql://vexgo_f07_app:test@127.0.0.1:3010/vexgo_feature07',
  MIGRATION_URL: 'mysql://root:test@127.0.0.1:3010/vexgo_feature07',
  SHADOW_DATABASE_URL: 'mysql://root:test@127.0.0.1:3010/vexgo_feature07_shadow',
};

describe('promotion integration database isolation', () => {
  it('accepts the restricted local feature DB and isolated GitHub CI DB', () => {
    expect(promotionTestDatabaseUrl(local, {}).pathname).toBe('/vexgo_promotion');
    expect(promotionTestDatabaseUrl(ci, github).pathname).toBe('/vexgo_ci');
  });
  it('accepts the explicitly configured, isolated Feature 07 test database on port 3010', () => {
    expect(promotionTestDatabaseUrl(feature07, feature07Environment).pathname).toBe(
      '/vexgo_feature07_test',
    );
  });
  it.each([
    ['not the configured Feature 07 test URL', feature07, { ...feature07Environment, FEATURE07_TEST_DATABASE_URL: undefined }],
    ['the runtime database', feature07, { ...feature07Environment, MIGRATION_URL: feature07 }],
    ['the shadow database', feature07, { ...feature07Environment, SHADOW_DATABASE_URL: feature07 }],
    ['a root account', feature07.replace('vexgo_feature07_test:test@', 'root:test@'), feature07Environment],
    ['an arbitrary schema', feature07.replace('/vexgo_feature07_test', '/vexgo'), feature07Environment],
    ['an arbitrary host', feature07.replace('127.0.0.1', '192.0.2.1'), feature07Environment],
    ['another port', feature07.replace('3010', '3306'), feature07Environment],
  ])('rejects Feature 07 target that is %s', (_reason, url, environment) => {
    expect(() => promotionTestDatabaseUrl(url, environment)).toThrow();
  });
  it.each([{}, { CI: 'true' }, { GITHUB_ACTIONS: 'true' }, { CI: 'false', GITHUB_ACTIONS: 'true' }])(
    'rejects the CI database outside GitHub Actions: %j', (environment) => {
      expect(() => promotionTestDatabaseUrl(ci, environment)).toThrow();
    },
  );
  it.each([
    local.replace('127.0.0.1', '192.0.2.1'), local.replace('3306', '3307'),
    local.replace('/vexgo_promotion', '/vexgo'), local.replace('vexgo_promotion_app:', 'root:'),
    ci.replace('/vexgo_ci', '/vexgo'), ci.replace('root:', 'other:'),
    ci.replace('mysql:', 'https:'), undefined, 'invalid',
  ])('rejects an unsafe database target: %s', (url) => {
    expect(() => promotionTestDatabaseUrl(url, github)).toThrow();
  });
});
