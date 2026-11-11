import 'dotenv/config';
import { defineConfig } from 'prisma/config';
import { resolvePrismaDatasourceUrls } from './apps/api/src/prisma/mariadb-pool-config.js';

const datasourceUrls = resolvePrismaDatasourceUrls();

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'node prisma/seed-bootstrap.mjs',
  },
  datasource: datasourceUrls,
});
