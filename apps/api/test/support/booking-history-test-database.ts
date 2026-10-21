import { createConnection, type ConnectionConfig } from 'mariadb';

export const BOOKING_HISTORY_TEST_DATABASE_ENV =
  'BOOKING_TICKET_STATUS_HISTORY_TEST_DATABASE_URL';
export const BOOKING_HISTORY_TEST_DATABASE_NAME =
  'vexgo_booking_ticket_status_history_ci_test';
export const BOOKING_HISTORY_TEST_DATABASE_USER = 'vexgo_history_ci_test';

const ISOLATION_DATABASE_ENVIRONMENTS = [
  'DATABASE_URL',
  'MIGRATION_URL',
  'SHADOW_DATABASE_URL',
] as const;

type Environment = Record<string, string | undefined>;

type ParsedDatabaseTarget = {
  host: string;
  normalizedHost: string;
  port: number;
  schema: string;
  username: string;
  password: string;
};

export type HistoryTestDatabaseSession = {
  schemaName: string;
  serverHost: string;
  serverPort: number;
  serverUuid: string;
  currentUser: string;
};

export type VerifiedHistoryTestDatabase = {
  host: string;
  port: number;
  schema: string;
  username: string;
  session: HistoryTestDatabaseSession;
};

export type ReadOnlyDatabaseConnection = {
  query<T = unknown>(sql: string): Promise<T>;
  end(): Promise<void>;
};

export type HistoryTestDatabaseConnector = (
  config: ConnectionConfig,
) => Promise<ReadOnlyDatabaseConnection>;

function normalizedHost(host: string): string {
  const unwrappedHost = host.toLowerCase().replace(/^\[|\]$/g, '');
  return ['localhost', '127.0.0.1', '::1'].includes(unwrappedHost)
    ? 'loopback'
    : unwrappedHost;
}

function parseMysqlTarget(
  value: string | undefined,
  label: string,
): ParsedDatabaseTarget {
  if (!value) {
    throw new Error(
      `${label} is required to verify booking history test database isolation.`,
    );
  }

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`${label} must be a valid MySQL URL.`);
  }

  if (url.protocol !== 'mysql:') {
    throw new Error(`${label} must use the mysql: protocol.`);
  }

  let schema: string;
  let username: string;
  let password: string;
  try {
    schema = decodeURIComponent(url.pathname.replace(/^\/+/, ''));
    username = decodeURIComponent(url.username);
    password = decodeURIComponent(url.password);
  } catch {
    throw new Error(`${label} must be a valid MySQL URL.`);
  }

  const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, '');
  const port = Number(url.port || 3306);

  if (!host || !Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new Error(`${label} must include a valid host and port.`);
  }
  if (!schema || schema.includes('/') || schema.includes('\\')) {
    throw new Error(`${label} must target exactly one database schema.`);
  }
  if (url.search || url.hash) {
    throw new Error(`${label} must not contain query parameters or fragments.`);
  }

  return {
    host,
    normalizedHost: normalizedHost(host),
    port,
    schema: schema.toLowerCase(),
    username,
    password,
  };
}

function assertHistoryTestDatabaseTarget(
  env: Environment,
): ParsedDatabaseTarget {
  const testTarget = parseMysqlTarget(
    env[BOOKING_HISTORY_TEST_DATABASE_ENV],
    BOOKING_HISTORY_TEST_DATABASE_ENV,
  );

  if (!['localhost', '127.0.0.1', '::1'].includes(testTarget.host)) {
    throw new Error(
      `${BOOKING_HISTORY_TEST_DATABASE_ENV} must use a loopback host.`,
    );
  }
  if (testTarget.schema !== BOOKING_HISTORY_TEST_DATABASE_NAME) {
    throw new Error(
      `${BOOKING_HISTORY_TEST_DATABASE_ENV} must target ${BOOKING_HISTORY_TEST_DATABASE_NAME}.`,
    );
  }
  if (
    testTarget.username !== BOOKING_HISTORY_TEST_DATABASE_USER ||
    !testTarget.password
  ) {
    throw new Error(
      `${BOOKING_HISTORY_TEST_DATABASE_ENV} must use its dedicated non-root test account.`,
    );
  }

  for (const environmentName of ISOLATION_DATABASE_ENVIRONMENTS) {
    const otherTarget = parseMysqlTarget(env[environmentName], environmentName);
    if (testTarget.schema === otherTarget.schema) {
      throw new Error(
        `${BOOKING_HISTORY_TEST_DATABASE_ENV} must use a schema separate from ${environmentName}.`,
      );
    }
    if (
      testTarget.normalizedHost !== otherTarget.normalizedHost ||
      testTarget.port !== otherTarget.port
    ) {
      throw new Error(
        `${BOOKING_HISTORY_TEST_DATABASE_ENV} must use the same local MySQL endpoint as ${environmentName}.`,
      );
    }
  }

  return testTarget;
}

function readGrantText(row: unknown): string {
  if (typeof row !== 'object' || row === null) return '';
  const grant = Object.values(row).find((value) => typeof value === 'string');
  return typeof grant === 'string' ? grant.trim() : '';
}

function assertDmlOnlyGrants(grants: unknown[], schema: string): void {
  const expected = [
    `GRANT USAGE ON *.* TO \`${BOOKING_HISTORY_TEST_DATABASE_USER}\`@\`%\``,
    `GRANT SELECT, INSERT, UPDATE, DELETE ON \`${schema}\`.* TO \`${BOOKING_HISTORY_TEST_DATABASE_USER}\`@\`%\``,
  ];
  const actual = grants.map(readGrantText).sort();
  const sortedExpected = expected.sort();

  if (
    actual.length !== expected.length ||
    actual[0] !== sortedExpected[0] ||
    actual[1] !== sortedExpected[1]
  ) {
    throw new Error(
      `${BOOKING_HISTORY_TEST_DATABASE_USER} must have only SELECT/INSERT/UPDATE/DELETE on the history test schema.`,
    );
  }
}

function assertSessionMatchesTarget(
  session: HistoryTestDatabaseSession,
  target: ParsedDatabaseTarget,
): void {
  if (session.schemaName.toLowerCase() !== target.schema) {
    throw new Error(
      'Connected history test account selected a different schema.',
    );
  }
  if (session.currentUser !== `${BOOKING_HISTORY_TEST_DATABASE_USER}@%`) {
    throw new Error(
      'Connected history test session is not using the dedicated test account.',
    );
  }
  if (
    !session.serverHost ||
    !Number.isInteger(Number(session.serverPort)) ||
    !session.serverUuid
  ) {
    throw new Error('Could not verify the connected MySQL server identity.');
  }
}

function createMariaDbConnection(
  config: ConnectionConfig,
): Promise<ReadOnlyDatabaseConnection> {
  return createConnection({
    ...config,
    connectTimeout: 5_000,
    socketTimeout: 5_000,
  }).then((connection) => ({
    query: <T = unknown>(sql: string) => connection.query<T>(sql),
    end: () => connection.end(),
  }));
}

export async function verifyBookingHistoryTestDatabase(
  env: Environment,
  connect: HistoryTestDatabaseConnector = createMariaDbConnection,
): Promise<VerifiedHistoryTestDatabase> {
  const target = assertHistoryTestDatabaseTarget(env);
  let connection: ReadOnlyDatabaseConnection | undefined;

  try {
    connection = await connect({
      host: target.host,
      port: target.port,
      user: target.username,
      password: target.password,
      database: target.schema,
      allowPublicKeyRetrieval: true,
    });

    const sessions = await connection.query<HistoryTestDatabaseSession[]>(
      'SELECT DATABASE() AS schemaName, @@hostname AS serverHost, @@port AS serverPort, @@server_uuid AS serverUuid, CURRENT_USER() AS currentUser',
    );
    const session = sessions[0];
    if (!session) {
      throw new Error(
        'MySQL did not return the history test session identity.',
      );
    }
    assertSessionMatchesTarget(session, target);

    const grants = await connection.query<unknown[]>('SHOW GRANTS');
    assertDmlOnlyGrants(grants, target.schema);

    const tables = await connection.query<
      Array<{ tableCount: number | string }>
    >(
      "SELECT COUNT(*) AS tableCount FROM information_schema.tables WHERE table_schema = DATABASE() AND table_type = 'BASE TABLE'",
    );
    if (Number(tables[0]?.tableCount ?? 0) === 0) {
      throw new Error('History test schema has no migrated tables.');
    }

    return {
      host: target.host,
      port: target.port,
      schema: target.schema,
      username: target.username,
      session,
    };
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.startsWith('Connected history test')
    ) {
      throw error;
    }
    if (
      error instanceof Error &&
      /^(MySQL did not return|Could not verify|History test schema|vexgo_history_ci_test must)/.test(
        error.message,
      )
    ) {
      throw error;
    }
    throw new Error(
      'Could not verify the isolated booking history test database; no suite initialization was allowed.',
    );
  } finally {
    await connection?.end();
  }
}

export function assertPrismaUsesVerifiedHistoryDatabase(
  preflight: VerifiedHistoryTestDatabase,
  prismaSession: HistoryTestDatabaseSession,
): void {
  assertSessionMatchesTarget(prismaSession, {
    host: preflight.host,
    normalizedHost: normalizedHost(preflight.host),
    port: preflight.port,
    schema: preflight.schema,
    username: preflight.username,
    password: '',
  });

  if (
    prismaSession.serverHost !== preflight.session.serverHost ||
    Number(prismaSession.serverPort) !== Number(preflight.session.serverPort) ||
    prismaSession.serverUuid !== preflight.session.serverUuid
  ) {
    throw new Error(
      'PrismaService connected to a different MySQL server than the verified test target.',
    );
  }
}

export async function withVerifiedBookingHistoryTestDatabase<T>(
  env: Environment,
  initialize: (database: VerifiedHistoryTestDatabase) => Promise<T>,
  connect: HistoryTestDatabaseConnector = createMariaDbConnection,
): Promise<T> {
  const verifiedDatabase = await verifyBookingHistoryTestDatabase(env, connect);
  return initialize(verifiedDatabase);
}
