'use strict';

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1', '[::1]']);
const LOOPBACK_CANONICAL_HOST = '127.0.0.1';
const LOCAL_DATABASE_PATTERN = /^vexgo_feature07(?:_[a-z0-9]+)*_test$/i;
const LOCAL_TEST_DATABASE = 'vexgo_feature07_test';
const CI_TEST_DATABASE = 'vexgo_feature07_ci_test';

function readTarget(value, name) {
  if (!value) throw new Error(`${name} is required.`);

  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`${name} must be a valid MySQL URL.`);
  }
  if (url.protocol !== 'mysql:') {
    throw new Error(`${name} must use the mysql: protocol.`);
  }

  const database = decodeURIComponent(url.pathname.replace(/^\/+/, ''));
  const username = decodeURIComponent(url.username);
  if (!database || !username) {
    throw new Error(`${name} must include a database and a scoped username.`);
  }

  return {
    url,
    host: url.hostname.toLowerCase(),
    port: Number(url.port || 3306),
    database: database.toLowerCase(),
    username,
  };
}

function sameDatabaseTarget(left, right) {
  return (
    normalizeHost(left.host) === normalizeHost(right.host) &&
    left.port === right.port &&
    left.database.toLowerCase() === right.database.toLowerCase()
  );
}

function normalizeHost(host) {
  const normalizedHost = host.toLowerCase();
  return LOCAL_HOSTS.has(normalizedHost)
    ? LOOPBACK_CANONICAL_HOST
    : normalizedHost;
}

function assertFeature07TestDatabase({
  testDatabaseUrl,
  protectedDatabaseUrls,
  ci = process.env.CI,
} = {}) {
  const target = readTarget(testDatabaseUrl, 'FEATURE07_TEST_DATABASE_URL');
  const isCi = ci === 'true';

  if (!LOCAL_HOSTS.has(target.host)) {
    throw new Error('Feature 07 DB tests must target a loopback MySQL host.');
  }

  if (isCi) {
    if (
      ![3306, 3307].includes(target.port) ||
      target.database !== CI_TEST_DATABASE ||
      target.username !== CI_TEST_DATABASE
    ) {
      throw new Error(
        'CI Feature 07 DB tests require the scoped vexgo_feature07_ci_test account/schema on port 3306 or 3307.',
      );
    }
  } else {
    if (![3010, 3307].includes(target.port)) {
      throw new Error(
        'Local Feature 07 DB tests require port 3010 or the legacy isolated port 3307.',
      );
    }
    const databaseAllowed =
      target.port === 3010
        ? target.database === LOCAL_TEST_DATABASE
        : LOCAL_DATABASE_PATTERN.test(target.database);
    if (!databaseAllowed || target.username !== target.database) {
      throw new Error(
        'Local Feature 07 DB tests require a dedicated *_test schema and its same-named scoped account.',
      );
    }
    if (target.port === 3010 && target.host !== '127.0.0.1') {
      throw new Error(
        'The worktree MySQL test database on port 3010 must use 127.0.0.1.',
      );
    }
  }

  if (!Array.isArray(protectedDatabaseUrls)) {
    throw new Error(
      'Runtime and shadow database targets must be provided for isolation checks.',
    );
  }
  const names = new Set(protectedDatabaseUrls.map(({ name }) => name));
  if (!names.has('runtime') || !names.has('shadow')) {
    throw new Error(
      'Runtime and shadow database targets are required for Feature 07 test isolation.',
    );
  }

  const targets = new Map();
  for (const { name, value } of protectedDatabaseUrls) {
    const protectedTarget = readTarget(value, name);
    targets.set(name, protectedTarget);
    if (sameDatabaseTarget(target, protectedTarget)) {
      throw new Error(
        `Feature 07 test database must be separate from ${name}.`,
      );
    }
  }
  if (sameDatabaseTarget(targets.get('runtime'), targets.get('shadow'))) {
    throw new Error('Runtime and shadow databases must be separate.');
  }

  return target.url;
}

module.exports = { assertFeature07TestDatabase, sameDatabaseTarget };
