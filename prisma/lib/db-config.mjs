const SSL_ENABLED_VALUES = new Set([
  'true',
  '1',
  'required',
  'verify_ca',
  'verify_identity',
  'accept_invalid_certs',
  'strict',
]);

export function databaseConfig(
  raw = process.env.DATABASE_URL ?? process.env.MIGRATION_URL,
) {
  if (!raw) {
    throw new Error('MIGRATION_URL or DATABASE_URL is required');
  }

  const url = new URL(raw);
  if (url.protocol !== 'mysql:') {
    throw new Error('Database URL must use mysql: protocol');
  }

  const sslParam =
    url.searchParams.get('ssl-mode') ??
    url.searchParams.get('sslMode') ??
    url.searchParams.get('ssl_mode') ??
    url.searchParams.get('sslaccept') ??
    url.searchParams.get('ssl');

  const enableSsl =
    sslParam !== null && SSL_ENABLED_VALUES.has(sslParam.trim().toLowerCase());

  const config = {
    host: url.hostname,
    port: Number(url.port || 3306),
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database: decodeURIComponent(url.pathname.replace(/^\/+/, '')),
    allowPublicKeyRetrieval: true,
  };

  if (enableSsl) {
    config.ssl = { rejectUnauthorized: false };
  }

  return config;
}
