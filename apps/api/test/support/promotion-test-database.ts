type TestEnvironment = { CI?: string; GITHUB_ACTIONS?: string };

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
  if (url.protocol !== 'mysql:' || url.hostname !== '127.0.0.1' ||
      Number(url.port || 3306) !== 3306 || (!local && !ci)) {
    throw new Error('Promotion tests require the scoped local feature database or the isolated GitHub Actions CI database at 127.0.0.1:3306.');
  }
  return url;
}
