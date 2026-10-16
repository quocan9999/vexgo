import { describe, expect, it } from 'vitest';
import { promotionTestDatabaseUrl } from '../../support/promotion-test-database.js';

const local = 'mysql://vexgo_promotion_app:test@127.0.0.1:3306/vexgo_promotion';
const ci = 'mysql://root:test@127.0.0.1:3306/vexgo_ci';
const github = { CI: 'true', GITHUB_ACTIONS: 'true' };

describe('promotion integration database isolation', () => {
  it('accepts the restricted local feature DB and isolated GitHub CI DB', () => {
    expect(promotionTestDatabaseUrl(local, {}).pathname).toBe('/vexgo_promotion');
    expect(promotionTestDatabaseUrl(ci, github).pathname).toBe('/vexgo_ci');
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
