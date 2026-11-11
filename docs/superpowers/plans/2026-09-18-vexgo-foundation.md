# VexGo Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create a runnable npm/Turborepo foundation containing customer web, admin web, a secure NestJS API, and a local MySQL/Prisma development environment.

**Architecture:** The root npm workspace contains three independently buildable apps and three narrowly scoped shared packages. Next.js web and admin call the versioned NestJS API over HTTP; only the API owns Prisma and MySQL. Turbo coordinates the same quality tasks at root and in each workspace.

**Tech Stack:** Node.js LTS, npm, Turborepo, Next.js App Router, TypeScript, Tailwind CSS, shadcn/ui, NestJS (Express), Prisma, MySQL 8, Jest, Playwright, ESLint, Prettier, Husky, lint-staged, GitHub Actions.

**Spec:** `docs/superpowers/specs/2026-09-18-vexgo-foundation-design.md`

## Global Constraints

- Keep exactly three applications: `apps/web`, `apps/admin`, and `apps/api`; mobile is a separate repository.
- `web` and `admin` must never connect directly to MySQL.
- API routes use the `/api/v1` prefix and Swagger/OpenAPI is enabled only outside production.
- Prisma schema, migrations, and seed data live in `apps/api`.
- Do not add booking, payments, real-time chat, cargo, email, object storage, or provider integrations.
- Commit no `.env` file, secret, generated database data, or production credential.
- Use `CUSTOMER`, `STAFF`, and `ADMIN` as the initial role enum.

---

## Target File Structure

```text
package.json                         Root scripts and npm workspace membership
package-lock.json                    Reproducible npm dependency lock
turbo.json                           Task graph and cache inputs
.gitignore                           Generated files and secrets
.prettierrc.json                     Formatting policy
.husky/pre-commit                    Staged-file quality check
lint-staged.config.mjs               Staged file commands
apps/web/                            Customer Next.js app
apps/admin/                          Admin Next.js app
apps/api/                            NestJS API and Prisma ownership
packages/config/                     Shared TypeScript, ESLint, Tailwind configs
packages/types/                      Shared pagination/response/role types
packages/ui/                         Shared presentation-only UI library
infra/docker/docker-compose.yml      MySQL local service
.github/workflows/ci.yml             Pull-request quality pipeline
```

### Task 1: Establish the workspace and Turbo task graph

**Files:**
- Create: `package.json` with npm workspaces, `turbo.json`, `.gitignore`, `.prettierrc.json`, `.nvmrc`
- Test: `package.json` root scripts by `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`

**Interfaces:**
- Produces root commands: `dev`, `build`, `lint`, `format`, `format:check`, `typecheck`, `test`.
- Consumes each workspace package's equivalent scripts.

- [ ] **Step 1: Create the failing workspace command check.**

Run: `npm --version`

Expected: npm is available; no root `package.json` exists yet, so `npm run lint` fails with a missing manifest error.

- [ ] **Step 2: Add root workspace manifests.**

Add npm workspace membership to the root `package.json`:

```yaml
packages:
  - 'apps/*'
  - 'packages/*'
```

Create `turbo.json` with `build` depending on `^build` and outputting `dist/**` and `.next/**` (excluding `.next/cache/**`); define `lint`, `typecheck`, and `test` with their package dependencies; set `dev` to `{ "cache": false, "persistent": true }`. Add `NEXT_PUBLIC_API_URL` to the frontend build task `env` list and include `.env*` files as build inputs.

Set `packageManager` in root `package.json`, add `turbo` as a dev dependency, and define scripts such as:

```json
{
  "scripts": {
    "build": "turbo run build",
    "lint": "turbo run lint",
    "typecheck": "turbo run typecheck",
    "test": "turbo run test",
    "dev": "turbo run dev --parallel"
  }
}
```

Add ignores for `node_modules`, `.next`, `dist`, `coverage`, `.env*` except `.env.example`, Prisma local SQLite artifacts if ever created, and Playwright reports. Pin the repository Node LTS major in `.nvmrc`.

- [ ] **Step 3: Install and validate the task graph.**

Run: `npm install && npm exec -- turbo run lint --dry`

Expected: install produces `package-lock.json`; Turbo enumerates the root task graph without a schema error.

- [ ] **Step 4: Commit.**

```powershell
git add package.json turbo.json .gitignore .prettierrc.json .nvmrc package-lock.json
git commit -m "chore: initialize npm turbo workspace"
```

### Task 2: Add shared configuration, types, and UI package contracts

**Files:**
- Create: `packages/config/package.json`, `packages/config/tsconfig.base.json`, `packages/config/eslint.base.mjs`, `packages/config/tailwind.css`
- Create: `packages/types/package.json`, `packages/types/src/index.ts`, `packages/types/tsconfig.json`
- Create: `packages/ui/package.json`, `packages/ui/src/index.ts`, `packages/ui/src/components/button.tsx`, `packages/ui/tsconfig.json`
- Test: `packages/types/src/index.test.ts`, `packages/ui/src/components/button.test.tsx`

**Interfaces:**
- Produces `@vexgo/types` exports: `Role`, `PaginationMeta`, `ApiSuccess<T>`, `ApiError`.
- Produces `@vexgo/ui` export: `Button` with standard button props.
- Apps extend `@vexgo/config/tsconfig.base.json` and import workspace packages through `workspace:*`.

- [ ] **Step 1: Write failing type and component tests.**

```ts
import { Role } from './index';
it('exposes the approved roles', () => {
  expect(Object.values(Role)).toEqual(['CUSTOMER', 'STAFF', 'ADMIN']);
});
```

```tsx
import { render, screen } from '@testing-library/react';
import { Button } from './button';
it('renders its label', () => {
  render(<Button>Continue</Button>);
  expect(screen.getByRole('button', { name: 'Continue' })).toBeVisible();
});
```

- [ ] **Step 2: Confirm both tests fail before implementation.**

Run: `npm run test --workspace=@vexgo/types && npm run test --workspace=@vexgo/ui`

Expected: FAIL because packages and exports do not exist.

- [ ] **Step 3: Implement the smallest reusable contracts.**

Use `Role` as a string enum with exactly the three global roles. Implement `ApiSuccess<T>` as `{ data: T; meta?: PaginationMeta; requestId: string }`; implement `ApiError` as `{ error: { code: string; message: string; requestId: string } }`. Implement a presentation-only shadcn-compatible `Button`, with no data access or feature logic. Add per-package `build`, `lint`, `typecheck`, and `test` scripts compatible with root Turbo commands.

- [ ] **Step 4: Run shared package checks.**

Run: `npm run typecheck --workspace=@vexgo/types && npm run test --workspace=@vexgo/types && npm run test --workspace=@vexgo/ui`

Expected: PASS.

- [ ] **Step 5: Commit.**

```powershell
git add packages/config packages/types packages/ui package.json package-lock.json
git commit -m "chore: add shared workspace packages"
```

### Task 3: Scaffold the customer and admin Next.js applications

**Files:**
- Create: `apps/web/**`, `apps/web/.env.example`, `apps/web/e2e/home.smoke.spec.ts`, `apps/web/playwright.config.ts`
- Create: `apps/admin/**`, `apps/admin/.env.example`, `apps/admin/e2e/home.smoke.spec.ts`, `apps/admin/playwright.config.ts`
- Test: `apps/web/src/app/page.test.tsx`, `apps/admin/src/app/page.test.tsx`

**Interfaces:**
- Consumes `NEXT_PUBLIC_API_URL` from each app environment.
- Consumes `@vexgo/ui` and `@vexgo/types` only through public package exports.
- Produces unauthenticated root pages; no product feature routes.

- [ ] **Step 1: Write the two failing page tests.**

```tsx
import { render, screen } from '@testing-library/react';
import HomePage from './page';
it('identifies the customer application', () => {
  render(<HomePage />);
  expect(screen.getByRole('heading', { name: 'VexGo' })).toBeVisible();
});
```

For admin, assert a heading named `VexGo Admin`.

- [ ] **Step 2: Verify failure.**

Run: `npm run test --workspace=@vexgo/web && npm run test --workspace=@vexgo/admin`

Expected: FAIL because the Next apps and page modules do not exist.

- [ ] **Step 3: Generate both apps and apply monorepo settings.**

Use the current `create-next-app` TypeScript, App Router, Tailwind, ESLint and `src/` options in `apps/web` and `apps/admin`. Set distinct names `@vexgo/web` and `@vexgo/admin`, add workspace dependencies, and configure Tailwind content scanning for `@vexgo/ui`. Add each `.env.example` with `NEXT_PUBLIC_API_URL=http://localhost:4000/api/v1`.

Implement only accessible app-identifying root pages and metadata. Add a `GET /health` API client function with a timeout but do not render backend data yet.

- [ ] **Step 4: Add minimum browser smoke tests.**

Use a Playwright `webServer` command for each Next app. Each `*.smoke.spec.ts` must visit `/` and assert the same app-specific heading from the unit test.

- [ ] **Step 5: Run frontend verification.**

Run: `npm run lint --workspace=@vexgo/web && npm run typecheck --workspace=@vexgo/web && npm run test --workspace=@vexgo/web && npm run lint --workspace=@vexgo/admin && npm run typecheck --workspace=@vexgo/admin && npm run test --workspace=@vexgo/admin`

Expected: PASS. Run the Playwright smoke tests after browser binaries are installed.

- [ ] **Step 6: Commit.**

```powershell
git add apps/web apps/admin packages/ui package.json package-lock.json
git commit -m "feat: scaffold customer and admin applications"
```

### Task 4: Establish the NestJS API, configuration, and API documentation

**Files:**
- Create: `apps/api/src/main.ts`, `apps/api/src/app.module.ts`, `apps/api/src/health/health.controller.ts`, `apps/api/src/health/health.controller.spec.ts`
- Create: `apps/api/src/common/filters/http-exception.filter.ts`, `apps/api/src/common/interceptors/request-id.interceptor.ts`
- Create: `apps/api/src/config/env.schema.ts`, `apps/api/.env.example`, `apps/api/package.json`

**Interfaces:**
- Produces `GET /api/v1/health` -> `ApiSuccess<{ status: 'ok' }>`.
- Produces documented OpenAPI UI at `/docs` outside production.
- Consumes `DATABASE_URL`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `CORS_ORIGINS`, `PORT`, and `NODE_ENV` from environment.

- [ ] **Step 1: Write the failing health endpoint test.**

```ts
it('returns a healthy versioned response', async () => {
  return request(app.getHttpServer())
    .get('/api/v1/health')
    .expect(200)
    .expect(({ body }) => {
      expect(body.data).toEqual({ status: 'ok' });
      expect(body.requestId).toEqual(expect.any(String));
    });
});
```

- [ ] **Step 2: Verify failure.**

Run: `npm run test --workspace=@vexgo/api -- health.controller.spec.ts`

Expected: FAIL because the API app and route do not exist.

- [ ] **Step 3: Implement bootstrap policies and health route.**

Create NestJS with the Express adapter. Configure a global `/api/v1` prefix, `ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true })`, request-ID interceptor, and global HTTP exception filter that returns `ApiError`. Validate all required environment variables with a Zod `ConfigModule` schema. Parse `CORS_ORIGINS` as a comma-separated allow list. Configure Swagger via `DocumentBuilder`; do not register it when `NODE_ENV` equals `production`.

- [ ] **Step 4: Run API checks.**

Run: `npm run test --workspace=@vexgo/api -- health.controller.spec.ts && npm run lint --workspace=@vexgo/api && npm run typecheck --workspace=@vexgo/api`

Expected: PASS.

- [ ] **Step 5: Commit.**

```powershell
git add apps/api package.json package-lock.json
git commit -m "feat: establish versioned NestJS API foundation"
```

### Task 5: Add MySQL, Prisma, migrations, and idempotent demo seed

**Files:**
- Create: `infra/docker/docker-compose.yml`, `apps/api/prisma/schema.prisma`, `apps/api/prisma/seed.ts`
- Create: `apps/api/src/database/prisma.service.ts`, `apps/api/src/database/prisma.service.spec.ts`
- Create: `apps/api/prisma/migrations/<timestamp>_init/migration.sql`
- Modify: `apps/api/src/app.module.ts`, `apps/api/.env.example`, `apps/api/package.json`

**Interfaces:**
- Produces `PrismaService` injectable database client.
- Produces a MySQL database named `vexgo` on port `3306` through Docker Compose.
- Produces seeded roles `CUSTOMER`, `STAFF`, `ADMIN` without duplicate rows.

- [ ] **Step 1: Write a failing Prisma service test.**

```ts
it('connects and reads the database', async () => {
  await expect(service.$queryRaw`SELECT 1`).resolves.toBeDefined();
});
```

- [ ] **Step 2: Confirm the test fails without a database service.**

Run: `npm run test --workspace=@vexgo/api -- prisma.service.spec.ts`

Expected: FAIL because `PrismaService` does not exist.

- [ ] **Step 3: Define the minimal data model and local service.**

Use `provider = "mysql"` and `DATABASE_URL` in Prisma. Create only `Role` and `User` models necessary to support initial RBAC: `Role` has unique `code`, `User` has unique `email`, password hash field, and one role relation. Configure Docker Compose with MySQL 8, a named `mysql_data` volume, health check, non-secret development defaults, and port `3306:3306`. Put matching, explicitly development-only values in `.env.example`.

Implement `PrismaService` with application shutdown hooks. Implement a seed script with `upsert` for the three roles and one non-production admin account whose password is documented as local-only. Add `db:migrate`, `db:seed`, `db:generate`, and `db:studio` scripts to API package.

- [ ] **Step 4: Run integration verification.**

Run: `docker compose -f infra/docker/docker-compose.yml up -d && npm run db:migrate --workspace=@vexgo/api && npm run db:seed --workspace=@vexgo/api && npm run test --workspace=@vexgo/api -- prisma.service.spec.ts`

Expected: migration succeeds, repeated seed does not duplicate role rows, and test PASSes.

- [ ] **Step 5: Commit.**

```powershell
git add infra/docker apps/api/prisma apps/api/src/database apps/api/src/app.module.ts apps/api/.env.example apps/api/package.json package-lock.json
git commit -m "feat: add local MySQL and Prisma foundation"
```

### Task 6: Add authentication and authorization skeleton

**Files:**
- Create: `apps/api/src/auth/auth.module.ts`, `apps/api/src/auth/auth.service.ts`, `apps/api/src/auth/auth.controller.ts`, `apps/api/src/auth/dto/login.dto.ts`
- Create: `apps/api/src/auth/guards/jwt-auth.guard.ts`, `apps/api/src/auth/guards/roles.guard.ts`, `apps/api/src/auth/decorators/roles.decorator.ts`
- Create: `apps/api/src/auth/auth.controller.spec.ts`, `apps/api/src/auth/guards/roles.guard.spec.ts`

**Interfaces:**
- Produces `POST /api/v1/auth/login` accepting `{ email: string, password: string }`.
- Produces `{ accessToken: string, refreshToken: string }` only after valid credentials.
- Produces `@Roles(...roles: Role[])` for API controllers.

- [ ] **Step 1: Write failing login and guard tests.**

```ts
it('rejects an invalid login without exposing account detail', async () => {
  return request(app.getHttpServer())
    .post('/api/v1/auth/login')
    .send({ email: 'unknown@example.test', password: 'wrong-password' })
    .expect(401)
    .expect(({ body }) => expect(body.error.code).toBe('AUTH_INVALID_CREDENTIALS'));
});
```

```ts
it('denies a customer from an admin-only route', () => {
  expect(guard.canActivate(customerAdminContext)).toBe(false);
});
```

- [ ] **Step 2: Verify failure.**

Run: `npm run test --workspace=@vexgo/api -- auth.controller.spec.ts roles.guard.spec.ts`

Expected: FAIL because the auth module and guards do not exist.

- [ ] **Step 3: Implement skeleton security controls.**

Use Argon2 password verification and Nest JWT. Issue a short-lived access JWT and a long-lived refresh token; persist only a hash of the refresh token on `User`. Use a generic invalid-credential error for nonexistent user and invalid password. Implement `JwtAuthGuard`, `RolesGuard`, and `@Roles` using the shared `Role` enum. Add a protected test route used only by tests to verify authorization.

Add throttling for login and public API endpoints. Do not add registration, profile, password reset, permission administration, or frontend login UI.

- [ ] **Step 4: Run security tests.**

Run: `npm run test --workspace=@vexgo/api -- auth.controller.spec.ts roles.guard.spec.ts && npm run typecheck --workspace=@vexgo/api`

Expected: PASS.

- [ ] **Step 5: Commit.**

```powershell
git add apps/api package.json package-lock.json
git commit -m "feat: add API auth and RBAC skeleton"
```

### Task 7: Add developer hooks, CI, and end-to-end verification

**Files:**
- Create: `lint-staged.config.mjs`, `.husky/pre-commit`, `.github/workflows/ci.yml`, `README.md`
- Modify: root `package.json`, `turbo.json`
- Test: root command sequence and GitHub Actions workflow syntax

**Interfaces:**
- Produces `npm run format:check` and `npm run prepare`.
- Produces PR CI for install, lint, format check, typecheck, test, and build.

- [ ] **Step 1: Write the failing root verification run.**

Run: `npm run format:check && npm run lint && npm run typecheck && npm test && npm run build`

Expected: initially FAIL because the root format script, hooks, and CI-related commands are incomplete.

- [ ] **Step 2: Implement local quality gates.**

Add Prettier check/write scripts, `prepare: husky`, and a pre-commit hook executing `npm exec -- lint-staged`. Configure lint-staged to run Prettier and ESLint only on staged source/config files. Document prerequisites (Node LTS, npm, Docker), local startup, database migration/seed, root quality checks, port assignments, Swagger URL, and no-secret policy in `README.md`.

- [ ] **Step 3: Implement pull-request CI.**

Create a GitHub Actions workflow triggered on `pull_request` and `push` to the default branch. Use setup-node with npm cache, `npm ci`, then `npm run format:check`, `npm run lint`, `npm run typecheck`, `npm test`, and `npm run build`. Do not inject deployment credentials or run deploy jobs.

- [ ] **Step 4: Run final evidence-based verification.**

Run: `npm run format:check && npm run lint && npm run typecheck && npm test && npm run build`

Expected: all commands PASS. Then run `docker compose -f infra/docker/docker-compose.yml up -d`, `npm run db:migrate --workspace=@vexgo/api`, `npm run db:seed --workspace=@vexgo/api`, start API/web/admin, and verify `GET /api/v1/health`, `http://localhost:<web-port>/`, `http://localhost:<admin-port>/`, and development Swagger UI respond successfully.

- [ ] **Step 5: Commit.**

```powershell
git add README.md lint-staged.config.mjs .husky .github/workflows package.json turbo.json package-lock.json
git commit -m "ci: add project quality gates"
```

## Plan Self-Review

- Spec coverage: Tasks 1–3 implement monorepo, web/admin, shared packages, environments, and Turbo. Tasks 4–6 implement API versioning, Swagger, validation, errors, CORS, MySQL/Prisma, rate limiting, auth, and RBAC. Task 7 implements hooks, CI, documentation, and the final verification sequence.
- Scope: The plan deliberately excludes all business modules and external integrations specified as out of scope.
- Consistency: `@vexgo/types` is the only cross-app data contract package; `PrismaService` remains API-owned; role values match the approved spec in every task.
