import { describe, expect, it, vi } from 'vitest';
import {
  assertPrismaUsesVerifiedHistoryDatabase,
  BOOKING_HISTORY_TEST_DATABASE_ENV,
  BOOKING_HISTORY_TEST_DATABASE_NAME,
  BOOKING_HISTORY_TEST_DATABASE_USER,
  type HistoryTestDatabaseConnector,
  type HistoryTestDatabaseSession,
  type ReadOnlyDatabaseConnection,
  verifyBookingHistoryTestDatabase,
  withVerifiedBookingHistoryTestDatabase,
} from '../../support/booking-history-test-database.js';

const testDatabaseUrl = `mysql://${BOOKING_HISTORY_TEST_DATABASE_USER}:test-only-password@127.0.0.1:3010/${BOOKING_HISTORY_TEST_DATABASE_NAME}`;

const validEnvironment: Record<string, string | undefined> = {
  [BOOKING_HISTORY_TEST_DATABASE_ENV]: testDatabaseUrl,
  DATABASE_URL:
    'mysql://vexgo_app:runtime-password@localhost:3010/vexgo_feature07',
  MIGRATION_URL:
    'mysql://root:migration-password@127.0.0.1:3010/vexgo_feature07',
  SHADOW_DATABASE_URL:
    'mysql://root:shadow-password@127.0.0.1:3010/vexgo_feature07_shadow',
};

const validSession: HistoryTestDatabaseSession = {
  schemaName: BOOKING_HISTORY_TEST_DATABASE_NAME,
  serverHost: 'mysql-test-container',
  serverPort: 3306,
  serverUuid: 'server-uuid-test-only',
  currentUser: `${BOOKING_HISTORY_TEST_DATABASE_USER}@%`,
};

const validGrants = [
  {
    Grant: `GRANT USAGE ON *.* TO \`${BOOKING_HISTORY_TEST_DATABASE_USER}\`@\`%\``,
  },
  {
    Grant: `GRANT SELECT, INSERT, UPDATE, DELETE ON \`${BOOKING_HISTORY_TEST_DATABASE_NAME}\`.* TO \`${BOOKING_HISTORY_TEST_DATABASE_USER}\`@\`%\``,
  },
];

function createConnectionHarness(
  options: {
    session?: HistoryTestDatabaseSession;
    grants?: unknown[];
    tableCount?: number;
  } = {},
) {
  const queries: string[] = [];
  const connection: ReadOnlyDatabaseConnection = {
    query: async <T = unknown>(sql: string): Promise<T> => {
      queries.push(sql);
      if (sql.startsWith('SELECT DATABASE()')) {
        return [options.session ?? validSession] as T;
      }
      if (sql === 'SHOW GRANTS') return (options.grants ?? validGrants) as T;
      if (sql.includes('information_schema.tables')) {
        return [{ tableCount: options.tableCount ?? 46 }] as T;
      }
      throw new Error(`Unexpected query in read-only guard: ${sql}`);
    },
    end: vi.fn(async () => undefined),
  };
  const connect = vi.fn<HistoryTestDatabaseConnector>(async () => connection);

  return { connect, connection, queries };
}

describe('booking history test database guard', () => {
  it('verifies a dedicated local schema and a DML-only account before initialization', async () => {
    const { connect, connection, queries } = createConnectionHarness();
    const initialize = vi.fn(async () => 'initialized');

    const result = await withVerifiedBookingHistoryTestDatabase(
      validEnvironment,
      initialize,
      connect,
    );

    expect(result).toBe('initialized');
    expect(initialize).toHaveBeenCalledWith(
      expect.objectContaining({
        host: '127.0.0.1',
        port: 3010,
        schema: BOOKING_HISTORY_TEST_DATABASE_NAME,
        username: BOOKING_HISTORY_TEST_DATABASE_USER,
      }),
    );
    expect(connect).toHaveBeenCalledWith(
      expect.objectContaining({
        host: '127.0.0.1',
        port: 3010,
        database: BOOKING_HISTORY_TEST_DATABASE_NAME,
        user: BOOKING_HISTORY_TEST_DATABASE_USER,
      }),
    );
    expect(queries.every((query) => /^(SELECT|SHOW)\b/i.test(query))).toBe(
      true,
    );
    expect(connection.end).toHaveBeenCalledOnce();
  });

  it.each([
    [
      'missing test URL',
      { ...validEnvironment, [BOOKING_HISTORY_TEST_DATABASE_ENV]: undefined },
    ],
    [
      'malformed test URL',
      { ...validEnvironment, [BOOKING_HISTORY_TEST_DATABASE_ENV]: 'mysql://%' },
    ],
    [
      'runtime schema through a loopback alias',
      {
        ...validEnvironment,
        [BOOKING_HISTORY_TEST_DATABASE_ENV]: `mysql://${BOOKING_HISTORY_TEST_DATABASE_USER}:test-only-password@127.0.0.1:3010/vexgo_feature07`,
      },
    ],
    [
      'unapproved schema',
      {
        ...validEnvironment,
        [BOOKING_HISTORY_TEST_DATABASE_ENV]: `mysql://${BOOKING_HISTORY_TEST_DATABASE_USER}:test-only-password@127.0.0.1:3010/vexgo_other_test`,
      },
    ],
    [
      'root account',
      {
        ...validEnvironment,
        [BOOKING_HISTORY_TEST_DATABASE_ENV]: `mysql://root:test-only-password@127.0.0.1:3010/${BOOKING_HISTORY_TEST_DATABASE_NAME}`,
      },
    ],
    [
      'remote host',
      {
        ...validEnvironment,
        [BOOKING_HISTORY_TEST_DATABASE_ENV]: `mysql://${BOOKING_HISTORY_TEST_DATABASE_USER}:test-only-password@db.example.test:3010/${BOOKING_HISTORY_TEST_DATABASE_NAME}`,
      },
    ],
    [
      'different MySQL endpoint',
      {
        ...validEnvironment,
        [BOOKING_HISTORY_TEST_DATABASE_ENV]: `mysql://${BOOKING_HISTORY_TEST_DATABASE_USER}:test-only-password@127.0.0.1:3011/${BOOKING_HISTORY_TEST_DATABASE_NAME}`,
      },
    ],
    ['missing runtime URL', { ...validEnvironment, DATABASE_URL: undefined }],
    [
      'missing migration URL',
      { ...validEnvironment, MIGRATION_URL: undefined },
    ],
    [
      'missing shadow URL',
      { ...validEnvironment, SHADOW_DATABASE_URL: undefined },
    ],
  ])(
    'blocks %s before connecting or initializing the suite',
    async (_case, env) => {
      const { connect } = createConnectionHarness();
      const initialize = vi.fn(async () => 'initialized');

      await expect(
        withVerifiedBookingHistoryTestDatabase(env, initialize, connect),
      ).rejects.toThrow();

      expect(connect).not.toHaveBeenCalled();
      expect(initialize).not.toHaveBeenCalled();
    },
  );

  it.each([
    [
      'a runtime grant',
      [
        ...validGrants,
        { Grant: 'GRANT ALL PRIVILEGES ON *.* TO `vexgo_history_ci_test`@`%`' },
      ],
    ],
    [
      'a DDL grant',
      [
        validGrants[0],
        {
          Grant: `GRANT SELECT, INSERT, UPDATE, DELETE, CREATE, DROP ON \`${BOOKING_HISTORY_TEST_DATABASE_NAME}\`.* TO \`${BOOKING_HISTORY_TEST_DATABASE_USER}\`@\`%\``,
        },
      ],
    ],
  ])('blocks %s before initializing the suite', async (_case, grants) => {
    const { connect, connection } = createConnectionHarness({ grants });
    const initialize = vi.fn(async () => 'initialized');

    await expect(
      withVerifiedBookingHistoryTestDatabase(
        validEnvironment,
        initialize,
        connect,
      ),
    ).rejects.toThrow(/only SELECT\/INSERT\/UPDATE\/DELETE/);

    expect(initialize).not.toHaveBeenCalled();
    expect(connection.end).toHaveBeenCalledOnce();
  });

  it('blocks a server session that does not match the configured test target', async () => {
    const { connect, connection } = createConnectionHarness({
      session: { ...validSession, schemaName: 'vexgo_feature07' },
    });
    const initialize = vi.fn(async () => 'initialized');

    await expect(
      withVerifiedBookingHistoryTestDatabase(
        validEnvironment,
        initialize,
        connect,
      ),
    ).rejects.toThrow(/different schema/);

    expect(initialize).not.toHaveBeenCalled();
    expect(connection.end).toHaveBeenCalledOnce();
  });

  it('blocks an unmigrated schema before initializing the suite', async () => {
    const { connect, connection } = createConnectionHarness({ tableCount: 0 });
    const initialize = vi.fn(async () => 'initialized');

    await expect(
      withVerifiedBookingHistoryTestDatabase(
        validEnvironment,
        initialize,
        connect,
      ),
    ).rejects.toThrow(/no migrated tables/);

    expect(initialize).not.toHaveBeenCalled();
    expect(connection.end).toHaveBeenCalledOnce();
  });

  it('requires PrismaService to use the same verified MySQL server and schema', () => {
    const { connect } = createConnectionHarness();

    return verifyBookingHistoryTestDatabase(validEnvironment, connect).then(
      (preflight) => {
        expect(() =>
          assertPrismaUsesVerifiedHistoryDatabase(preflight, {
            ...validSession,
            schemaName: 'vexgo_feature07',
          }),
        ).toThrow(/different schema/);

        expect(() =>
          assertPrismaUsesVerifiedHistoryDatabase(preflight, {
            ...validSession,
            serverUuid: 'different-server',
          }),
        ).toThrow(/different MySQL server/);
      },
    );
  });
});
