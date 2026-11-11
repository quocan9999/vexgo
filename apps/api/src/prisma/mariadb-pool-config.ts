const SSL_ENABLED_VALUES = new Set([
  'true',
  '1',
  'required',
  'verify_ca',
  'verify_identity',
  'accept_invalid_certs',
  'strict',
]);

export interface MariaDbPoolConfig {
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
  allowPublicKeyRetrieval: boolean;
  ssl?: {
    rejectUnauthorized: boolean;
  };
}

function hasSslEnabledParam(url: URL): boolean {
  const sslParam =
    url.searchParams.get('ssl-mode') ??
    url.searchParams.get('sslMode') ??
    url.searchParams.get('ssl_mode') ??
    url.searchParams.get('sslaccept') ??
    url.searchParams.get('ssl');

  return (
    sslParam !== null && SSL_ENABLED_VALUES.has(sslParam.trim().toLowerCase())
  );
}

export function normalizePrismaCliMysqlUrl(rawUrl: string): string {
  try {
    const parsed = new URL(rawUrl);
    if (
      parsed.protocol === 'mysql:' &&
      hasSslEnabledParam(parsed) &&
      !parsed.searchParams.has('sslaccept')
    ) {
      parsed.searchParams.set('sslaccept', 'accept_invalid_certs');
      return parsed.toString();
    }
  } catch {
    // Keep original string if not a valid URL
  }
  return rawUrl;
}

export function parseMariaDbPoolConfig(
  rawUrl: string,
  envName = 'DATABASE_URL',
): MariaDbPoolConfig {
  const databaseUrl = new URL(rawUrl);

  if (databaseUrl.protocol !== 'mysql:') {
    throw new Error(`${envName} must use the mysql: protocol`);
  }

  const enableSsl = hasSslEnabledParam(databaseUrl);

  const config: MariaDbPoolConfig = {
    host: databaseUrl.hostname,
    port: Number(databaseUrl.port || 3306),
    user: decodeURIComponent(databaseUrl.username),
    password: decodeURIComponent(databaseUrl.password),
    database: decodeURIComponent(databaseUrl.pathname.replace(/^\/+/, '')),
    allowPublicKeyRetrieval: true,
  };

  if (enableSsl) {
    config.ssl = { rejectUnauthorized: false };
  }

  return config;
}

const PLACEHOLDER_DATABASE_URL =
  'mysql://placeholder:placeholder@127.0.0.1:3306/vexgo';

function extractDatabaseName(rawUrl: string): string {
  return decodeURIComponent(new URL(rawUrl).pathname.replace(/^\/+/, ''));
}

export function resolvePrismaDatasourceUrls(
  envObj: Record<string, string | undefined> = process.env,
): { url: string; shadowDatabaseUrl?: string } {
  const rawMigrationUrl =
    envObj.MIGRATION_URL?.trim() ||
    envObj.DATABASE_URL?.trim() ||
    PLACEHOLDER_DATABASE_URL;
  const migrationUrl = normalizePrismaCliMysqlUrl(rawMigrationUrl);
  const runtimeUrl = envObj.DATABASE_URL?.trim() || migrationUrl;
  const rawShadowUrl = envObj.SHADOW_DATABASE_URL?.trim() || undefined;
  const shadowDatabaseUrl = rawShadowUrl
    ? normalizePrismaCliMysqlUrl(rawShadowUrl)
    : undefined;

  if (shadowDatabaseUrl) {
    const migrationDatabase = extractDatabaseName(migrationUrl);
    const runtimeDatabase = extractDatabaseName(runtimeUrl);
    const shadowDatabase = extractDatabaseName(shadowDatabaseUrl);

    if (
      shadowDatabase === migrationDatabase ||
      shadowDatabase === runtimeDatabase
    ) {
      throw new Error(
        'SHADOW_DATABASE_URL must target a database separate from DATABASE_URL and MIGRATION_URL.',
      );
    }
  }

  return {
    url: migrationUrl,
    shadowDatabaseUrl,
  };
}
