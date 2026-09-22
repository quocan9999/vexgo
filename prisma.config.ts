import 'dotenv/config';
import { defineConfig, env } from 'prisma/config';

const migrationUrl = env('MIGRATION_URL');
const shadowDatabaseUrl = env('SHADOW_DATABASE_URL');
const migrationDatabase = decodeURIComponent(
  new URL(migrationUrl).pathname.replace(/^\/+/, ''),
);
const shadowDatabase = decodeURIComponent(
  new URL(shadowDatabaseUrl).pathname.replace(/^\/+/, ''),
);
const runtimeUrl = process.env.DATABASE_URL;
const runtimeDatabase = runtimeUrl
  ? decodeURIComponent(new URL(runtimeUrl).pathname.replace(/^\/+/, ''))
  : migrationDatabase;

if (
  shadowDatabase === migrationDatabase ||
  shadowDatabase === runtimeDatabase
) {
  throw new Error(
    'SHADOW_DATABASE_URL must target a database separate from DATABASE_URL and MIGRATION_URL.',
  );
}

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'node prisma/seed-bootstrap.mjs',
  },
  datasource: {
    url: env('MIGRATION_URL'),
    shadowDatabaseUrl: env('SHADOW_DATABASE_URL'),
  },
});
