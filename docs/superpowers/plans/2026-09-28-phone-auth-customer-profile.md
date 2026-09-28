# Phone Authentication and Customer Profile Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Hoàn thiện đăng ký OTP bằng số điện thoại, JWT access/refresh session và API hồ sơ khách hàng dùng chung cho Web/Mobile.

**Architecture:** `AuthModule` sở hữu OTP, credential, token và session; `CustomersModule` sở hữu `/me`. OTP/proof và refresh token chỉ được lưu dạng hash; các thao tác consume proof, tạo customer/role/session và rotate refresh token dùng Prisma transaction.

**Tech Stack:** NestJS 12, `@nestjs/jwt` 12.0.2, Prisma 7.10, MySQL 8.4, class-validator 0.15, Vitest 4, Node `crypto`, bcrypt 6.

**Spec:** `docs/superpowers/specs/2026-09-28-phone-auth-customer-profile-design.md`

## Global Constraints

- API prefix là `/api/v1`; response thành công dùng `{ data }`, lỗi dùng `{ statusCode, error, message, details? }`.
- Chỉ backend truy cập Prisma; controller mỏng và không chứa business logic.
- Prisma model/field mới giữ naming tiếng Việt; code/module/API dùng tiếng Anh.
- OTP 6 số, TTL 300 giây, cooldown 60 giây, tối đa 5 lần sai; proof TTL 600 giây và dùng một lần.
- Access token TTL 900 giây; opaque refresh token TTL 2.592.000 giây và rotate mỗi lần refresh.
- Mật khẩu dài 8–72 byte UTF-8; số điện thoại là E.164 Việt Nam như `+84900000000`.
- `GET/PATCH /me` luôn suy ra account/customer từ token, không nhận `customerId` từ client.
- `SMS_PROVIDER=console` chỉ dùng local và production phải từ chối cấu hình này.
- Không triển khai Google login hoặc Swagger.

## Review Focus

- Hai request OTP đồng thời cho cùng số: chỉ một challenge được gửi, request còn lại nhận cooldown conflict (Task 1).
- Mật khẩu Unicode có không quá 72 ký tự nhưng vượt 72 byte: register phải từ chối trước bcrypt (Task 3).
- Refresh token cũ bị dùng lại sau rotation: phải trả `REFRESH_TOKEN_INVALID`, không cấp thêm phiên (Task 4).
- Role `KHACH_HANG` bị thiếu: transaction register rollback, không để lại `TaiKhoan` mồ côi (Task 3).
- JWT hợp lệ nhưng session đã thu hồi hoặc account bị khóa: guard phải trả lỗi xác thực/phạm vi phù hợp (Task 5).

---

## File Map

- `prisma/schema.prisma`: thêm `YeuCauOtp`, `PhienDangNhap` và relation từ `TaiKhoan`.
- `prisma/migrations/20260928090000_add_registration_otp/migration.sql`: persistence/index cho OTP challenge/proof.
- `prisma/migrations/20260928100000_add_auth_sessions/migration.sql`: persistence/index/foreign key cho refresh session.
- `apps/api/src/auth/otp/*`: sinh/hash/verify OTP và SMS abstraction.
- `apps/api/src/auth/tokens/*`: tạo access/refresh token, rotate/revoke session.
- `apps/api/src/auth/guards/access-token.guard.ts`: xác thực bearer token, account và session.
- `apps/api/src/auth/decorators/current-principal.decorator.ts`: lấy principal đã xác thực.
- `apps/api/src/auth/dto/*`: DTO riêng cho OTP, register, login, refresh/logout.
- `apps/api/src/common/validators/is-date-only.validator.ts`: validate ngày lịch thực theo `YYYY-MM-DD`, không chỉ regex.
- `apps/api/src/auth/auth.service.ts`: orchestration register/login/refresh/logout.
- `apps/api/src/auth/auth.controller.ts`: HTTP contract auth.
- `apps/api/src/customers/*`: `GET/PATCH /me` và profile mapping.
- `apps/api/test/unit/auth/*`, `apps/api/test/unit/customers/*`: business/edge regression tests.
- `apps/api/test/integration/auth/*`, `apps/api/test/integration/customers/*`: HTTP contract, pipe/filter/guard integration.
- `apps/api/test/e2e/auth-customer.e2e-spec.ts`: smoke flow thật với MySQL.
- `.env.example`: document secrets/TTL/SMS provider.
- `docs/api/auth-customer.md`: hướng dẫn Postman, request/response/error.

### Task 1: Persisted registration OTP request

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/20260928090000_add_registration_otp/migration.sql`
- Create: `apps/api/src/auth/otp/otp.constants.ts`
- Create: `apps/api/src/auth/otp/otp-crypto.service.ts`
- Create: `apps/api/src/auth/otp/otp.service.ts`
- Create: `apps/api/src/auth/sms/sms-sender.ts`
- Create: `apps/api/src/auth/sms/console-sms.sender.ts`
- Create: `apps/api/src/auth/dto/request-register-otp.dto.ts`
- Modify: `apps/api/src/auth/auth.controller.ts`
- Modify: `apps/api/src/auth/auth.module.ts`
- Modify: `.env.example`
- Test: `apps/api/test/unit/auth/otp.service.spec.ts`
- Test: `apps/api/test/integration/auth/request-register-otp.spec.ts`

**Interfaces:**
- Produces: `OtpService.requestRegistrationOtp(soDienThoai: string): Promise<{ challengeId: string; expiresAt: string; resendAfter: string }>`.
- Produces: `SmsSender.sendOtp(input: { soDienThoai: string; otp: string }): Promise<void>` injected bằng `SMS_SENDER`.
- Produces: `OtpCryptoService.hashOtp(challengeId: string, otp: string): string` and `matchesOtp(...)` using HMAC-SHA256.

- [ ] **Step 1: Write failing unit tests** for six-digit generation, hash-not-plaintext, one SMS call, existing phone conflict, 60-second cooldown, and two concurrent requests where only one send succeeds.
- [ ] **Step 2: Run unit test and confirm RED.** Run `npm run test --workspace=@vexgo/api -- test/unit/auth/otp.service.spec.ts`; expect missing classes/methods.
- [ ] **Step 3: Add `YeuCauOtp` schema and SQL migration** with unique `challengeId` and unique `[soDienThoai, mucDich]` current-challenge row, plus attempt/expiry/proof/use timestamps; then run `npm exec prisma generate`.
- [ ] **Step 4: Implement OTP crypto, console SMS adapter, DTO and `requestRegistrationOtp`** with phone normalization/validation, duplicate-account check, DB-backed cooldown and no OTP in response.
- [ ] **Step 5: Expose `POST /auth/register/request-otp`** from the controller and register providers in `AuthModule`; reject console provider when `NODE_ENV=production`.
- [ ] **Step 6: Write HTTP integration test** asserting `201`, `{ data: { challengeId, expiresAt, resendAfter } }`, unknown-field validation, duplicate phone and cooldown error codes.
- [ ] **Step 7: Run targeted verification.** Run both Task 1 test files, API lint and typecheck; expect PASS.
- [ ] **Step 8: Apply migration to local Docker MySQL** with `npm exec prisma migrate deploy`; verify `_prisma_migrations` and `YeuCauOtp` exist.
- [ ] **Step 9: Commit.** `feat(auth): add registration OTP requests`.

### Task 2: Verify OTP and issue one-time proof

**Files:**
- Create: `apps/api/src/auth/dto/verify-register-otp.dto.ts`
- Modify: `apps/api/src/auth/otp/otp.service.ts`
- Modify: `apps/api/src/auth/auth.controller.ts`
- Test: `apps/api/test/unit/auth/otp-verification.spec.ts`
- Test: `apps/api/test/integration/auth/verify-register-otp.spec.ts`

**Interfaces:**
- Consumes: OTP challenge and hashing interfaces from Task 1.
- Produces: `OtpService.verifyRegistrationOtp(input: { challengeId: string; soDienThoai: string; otp: string }): Promise<{ otpProof: string; expiresAt: string }>`.
- Produces: `OtpService.consumeRegistrationProof(tx: Prisma.TransactionClient, input: { soDienThoai: string; otpProof: string; usedAt: Date }): Promise<void>` for Task 3.

- [ ] **Step 1: Write failing unit tests** for valid OTP, wrong phone, expired challenge, wrong OTP increment, sixth attempt rejection, concurrent verify, proof hash storage and raw proof returned once.
- [ ] **Step 2: Run unit test and confirm RED.** Run `npm run test --workspace=@vexgo/api -- test/unit/auth/otp-verification.spec.ts`.
- [ ] **Step 3: Implement constant-time OTP comparison and atomic verification update**; generate 32-byte proof, persist only SHA-256, set 600-second proof expiry.
- [ ] **Step 4: Implement atomic `consumeRegistrationProof`** using `updateMany` conditions for purpose, phone, expiry and `daSuDungLuc: null`; zero updated rows throws `OTP_PROOF_INVALID`.
- [ ] **Step 5: Expose `POST /auth/register/verify-otp`** and preserve structured `OTP_INVALID`, `OTP_EXPIRED`, `OTP_ATTEMPTS_EXCEEDED` errors.
- [ ] **Step 6: Write and run HTTP integration tests** for success envelope and each negative branch; run lint/typecheck.
- [ ] **Step 7: Commit.** `feat(auth): verify registration OTP`.

### Task 3: Transactional customer registration and token foundation

**Files:**
- Modify: `apps/api/package.json`
- Modify: `package-lock.json`
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/20260928100000_add_auth_sessions/migration.sql`
- Create: `apps/api/src/auth/tokens/auth-principal.ts`
- Create: `apps/api/src/auth/tokens/token.service.ts`
- Create: `apps/api/src/common/validators/is-date-only.validator.ts`
- Modify: `apps/api/src/auth/dto/auth.dto.ts`
- Modify: `apps/api/src/auth/auth.service.ts`
- Modify: `apps/api/src/auth/auth.module.ts`
- Modify: `.env.example`
- Modify: `apps/api/test/unit/auth/auth.dto.spec.ts`
- Create: `apps/api/test/unit/auth/register.spec.ts`
- Create: `apps/api/test/integration/auth/register.spec.ts`

**Interfaces:**
- Consumes: `consumeRegistrationProof` from Task 2.
- Produces: `TokenService.createSession(tx, account): Promise<AuthTokenResponse>`.
- Produces: `AuthTokenResponse = { accessToken; refreshToken; tokenType: 'Bearer'; expiresIn: 900; user }`.
- Produces: `AuthService.register(dto: RegisterDto): Promise<AuthTokenResponse>`.

- [ ] **Step 1: Install exact dependency** with `npm install @nestjs/jwt@12.0.2 --workspace=@vexgo/api`.
- [ ] **Step 2: Write failing DTO tests** for required `otpProof`, optional valid `dateOfBirth`, impossible date-only values such as `2026-02-30`, `phoneNumber` in Vietnamese E.164 format, 8-byte minimum and Unicode `password` over 72 UTF-8 bytes.
- [ ] **Step 3: Write failing register service tests** for full transaction, proof/account/role/customer/session writes, duplicate phone, missing `KHACH_HANG` role rollback and sanitized response.
- [ ] **Step 4: Add `PhienDangNhap` schema/migration and regenerate Prisma Client**; hash field is unique, session id is unique, account relation restricts deletion.
- [ ] **Step 5: Implement `TokenService`** using Node crypto opaque refresh tokens, SHA-256 persistence and claims `{ sub, sid, roles }`; fail startup in every environment when JWT/OTP secrets are missing or unsafe.
- [ ] **Step 6: Upgrade `RegisterDto` and `AuthService.register`**; consume proof and create `TaiKhoan`, collision-safe numeric `maKhachHang`, `KhachHang`, `TaiKhoanVaiTro`, session in one transaction.
- [ ] **Step 7: Write HTTP integration tests** asserting `201`, standard envelope/token fields, database constraint mapping and one-time proof replay rejection.
- [ ] **Step 8: Run targeted tests, migration deploy, lint, typecheck and build.** Expect all PASS.
- [ ] **Step 9: Commit.** `feat(auth): register verified customers`.

### Task 4: Login, refresh rotation and logout

**Files:**
- Create: `apps/api/src/auth/dto/refresh-token.dto.ts`
- Modify: `apps/api/src/auth/auth.service.ts`
- Modify: `apps/api/src/auth/auth.controller.ts`
- Modify: `apps/api/src/auth/tokens/token.service.ts`
- Test: `apps/api/test/unit/auth/auth-session.spec.ts`
- Test: `apps/api/test/integration/auth/auth-session.spec.ts`

**Interfaces:**
- Produces: `AuthService.login(dto: LoginDto): Promise<AuthTokenResponse>`.
- Produces: `TokenService.rotateRefreshToken(rawToken: string): Promise<AuthTokenResponse>`.
- Produces: `TokenService.revokeRefreshToken(rawToken: string): Promise<void>`.

- [ ] **Step 1: Write failing service tests** for correct login, indistinguishable wrong phone/password error, locked account, seeded non-customer account, refresh rotation, expired/revoked token, replay of old token, and logout idempotency policy.
- [ ] **Step 2: Run test and confirm RED.** Run `npm run test --workspace=@vexgo/api -- test/unit/auth/auth-session.spec.ts`.
- [ ] **Step 3: Upgrade login** to load roles/customer, reject non-active accounts, compare bcrypt and create a persisted session.
- [ ] **Step 4: Implement refresh rotation transaction** with conditional revoke of the old session and exactly one replacement; replay returns `REFRESH_TOKEN_INVALID` without creating another session.
- [ ] **Step 5: Implement logout** as idempotent for a valid-or-already-revoked token and return no body with HTTP 204; random/malformed token returns `REFRESH_TOKEN_INVALID`.
- [ ] **Step 6: Expose `POST /auth/refresh` and `POST /auth/logout`** with DTO validation and structured errors.
- [ ] **Step 7: Write/run HTTP integration tests** for token response, error envelopes, rotation and 204 logout; run lint/typecheck/build.
- [ ] **Step 8: Commit.** `feat(auth): add login sessions and token rotation`.

### Task 5: Access-token guard and customer `/me`

**Files:**
- Create: `apps/api/src/auth/guards/access-token.guard.ts`
- Create: `apps/api/src/auth/decorators/current-principal.decorator.ts`
- Modify: `apps/api/src/auth/auth.module.ts`
- Create: `apps/api/src/customers/dto/update-me.dto.ts`
- Create: `apps/api/src/customers/customers.service.ts`
- Create: `apps/api/src/customers/customers.controller.ts`
- Create: `apps/api/src/customers/customers.module.ts`
- Modify: `apps/api/src/app.module.ts`
- Test: `apps/api/test/unit/auth/access-token.guard.spec.ts`
- Test: `apps/api/test/unit/customers/customers.service.spec.ts`
- Test: `apps/api/test/integration/customers/me.spec.ts`

**Interfaces:**
- Produces: `AuthPrincipal = { taiKhoanId: number; sessionId: string; roles: string[] }` on `request.user`.
- Produces: `CustomersService.getMe(taiKhoanId: number): Promise<{ data: CustomerProfile }>`.
- Produces: `CustomersService.updateMe(taiKhoanId: number, dto: UpdateMeDto): Promise<{ data: CustomerProfile }>`.

- [ ] **Step 1: Write failing guard tests** for missing/malformed/expired JWT, wrong signature, revoked/missing session, locked account, and valid JWT principal attachment.
- [ ] **Step 2: Implement `AccessTokenGuard` and `CurrentPrincipal`**; verify JWT then load account/session/roles from Prisma before allowing the request.
- [ ] **Step 3: Write failing customer service tests** for exact profile mapping, non-customer access, account scoping, partial update, null-clearing of optional fields, invalid calendar date and unchanged phone.
- [ ] **Step 4: Implement `UpdateMeDto` and `CustomersService`**; expose `fullName`, `dateOfBirth`, `email`, `citizenId`, reject phone/customer id/unknown fields, return `YYYY-MM-DD` for date-only.
- [ ] **Step 5: Implement guarded controller/module routes** `GET /me` and `PATCH /me`, import `CustomersModule` in `AppModule`, require `KHACH_HANG` role.
- [ ] **Step 6: Write HTTP integration tests** with real guard and mocked Prisma boundaries for bearer auth, customer isolation, validation/error/success envelopes.
- [ ] **Step 7: Run targeted tests, lint, typecheck and build.** Expect PASS.
- [ ] **Step 8: Commit.** `feat(customers): add authenticated profile APIs`.

### Task 6: Real-database flow, documentation and final verification

**Files:**
- Create: `apps/api/test/e2e/auth-customer.e2e-spec.ts`
- Create: `docs/api/auth-customer.md`
- Modify only if defects are found: files owned by Tasks 1–5.

**Interfaces:**
- Consumes: all public HTTP contracts from Tasks 1–5.
- Produces: repeatable Postman-equivalent flow and handoff documentation for frontend.

- [ ] **Step 1: Write E2E test** using a unique E.164 phone, a test-only captured `SmsSender` override, and cleanup in `afterAll`; assert request OTP → captured OTP → verify → register → get me → patch me → refresh → old refresh rejected → logout → protected request rejected after session revoke.
- [ ] **Step 2: Run E2E against Docker MySQL.** Run `npm run test:e2e --workspace=@vexgo/api -- test/e2e/auth-customer.e2e-spec.ts`; expect PASS without altering seed accounts.
- [ ] **Step 3: Write `docs/api/auth-customer.md`** with environment variables, startup commands, exact Postman bodies, bearer header, success/error examples and local console OTP instructions.
- [ ] **Step 4: Run full verification:** `npm run lint --workspace=@vexgo/api`, `npm run typecheck --workspace=@vexgo/api`, `npm run test --workspace=@vexgo/api`, `npm run test:e2e --workspace=@vexgo/api`, `npm run build --workspace=@vexgo/api`, and `git diff --check`.
- [ ] **Step 5: Start built API and smoke test** `/auth/login`, `/me`, `/auth/refresh`, `/auth/logout`; confirm no password/hash/OTP appears in responses or logs other than the explicit local console sender line.
- [ ] **Step 6: Refresh GitNexus index and run `detect_changes({ scope: "all" })`**; investigate any partial/truncated result or HIGH/CRITICAL risk before committing.
- [ ] **Step 7: Commit.** `docs(auth): add phone auth API guide`.
