# Feature 09 — Environment / Worktree / Database isolation

**Bắt buộc hoàn tất trước Phase 01. Codex tự làm toàn bộ bước này.** Người dùng chỉ đưa ZIP và goal cho Codex. Không yêu cầu người dùng tự tạo worktree/database hoặc chạy npm.

## 1. Worktree do agent sở hữu

Chạy từ **repository chính** (không phải worktree Feature 07):

```powershell
git status --short
git worktree list
git fetch origin develop
# Chỉ chạy nếu branch và đường dẫn chưa tồn tại:
git worktree add -b feature/shipment-management ..\vexgo-feature09 origin/develop
```

- Nếu worktree/branch tồn tại: inspect `git worktree list`, branch, HEAD, status và path trước; dùng lại đúng worktree sạch/hợp lệ, không `--force`, không xóa/overwrite/recreate.
- Branch local có nhưng chưa gắn worktree: xác minh base và tình trạng branch; không tự đặt lại branch về `develop`.
- Nếu `git fetch` bị chặn: báo blocker cụ thể; không lấy `develop` stale rồi tuyên bố đã dùng latest.
- Không sửa source, `.env`, worktree hoặc metadata branch `feature/booking-and-ticket-history` của Feature 07.
- Khi worktree đã có, extract ZIP vào **worktree root** để sinh `docs/features/feature-09-gui-hang-admin/...`. Chỉ dùng bản docs trong worktree; không thêm ZIP, `CODEX_GOAL.txt` hay `SETUP_FOR_CODEX.md` vào Git.
- Ghi `handoff/ENVIRONMENT_HANDOFF.md` (không secret); đưa tài liệu này vào commit Phase 01.

## 2. Port và MySQL (đã chốt)

| Dịch vụ | Worktree Feature 09 | Ghi chú |
|---|---|---|
| Admin | `http://localhost:3003` | Không sửa npm script track chỉ vì dev port |
| Nest API | `http://localhost:4003` | `PORT=4003` trong root `.env` |
| MySQL host | `127.0.0.1:3306` | **Tái sử dụng MySQL đang chạy**; không có Docker/compose mới |
| Database | `vexgo_feature09` | 100% riêng; không dùng `vexgo` |
| Shadow DB | `vexgo_feature09_shadow` | Riêng cho Prisma, không trỏ vào runtime DB |
| Customer Web | Không chạy trong MVP | Không cần sửa cổng Customer |

- Không `docker compose up/down`, không stop MySQL chung, không thay port 3306, không `docker compose down -v`, không drop/truncate schema không liên quan.
- Nếu port `3003/4003` có service khác thì báo blocker; không kill app người khác/đổi port khác.

## 3. Bảo toàn credential

Đọc cấu hình hiện có trên máy developer ở repo gốc (read-only, không log secret). **Giữ nguyên user, password, host, port cho từng vai trò kết nối**:

- `DATABASE_URL`: runtime-user đã dùng (thường app user) → DB `vexgo_feature09`.
- `MIGRATION_URL`: migration-user đã dùng (có thể `root`) → DB `vexgo_feature09`.
- `SHADOW_DATABASE_URL`: giữ user/password giống URL shadow hiện tại → DB `vexgo_feature09_shadow`.
- Không mặc định đổi migration-user thành app-user, không tạo tài khoản/mật khẩu mới.

Nếu cần quyền: chỉ `CREATE DATABASE IF NOT EXISTS` hai DB đúng tên đã chốt, sau khi xác minh database chưa chứa dữ liệu khác; cấp GRANT tối thiểu trên `vexgo_feature09.*` cho đúng runtime user/host đã tồn tại nếu cần, và quyền phù hợp trên `vexgo_feature09_shadow.*` cho migration user; không grant global `*.*` hay sửa mật khẩu.

Tạo `.env` **chỉ tại worktree**, bằng cách sao chép bí mật/tham số từ môi trường local đang dùng một cách an toàn; không trích secret vào shell logs/handoff. Giữ các env cần cho JWT/OTP/auth đang có; thay:

```dotenv
MYSQL_PORT=3306
MYSQL_DATABASE=vexgo_feature09
DATABASE_URL=mysql://<GIU_NGUYEN_USER_PASSWORD>@127.0.0.1:3306/vexgo_feature09
MIGRATION_URL=mysql://<GIU_NGUYEN_MIGRATION_USER_PASSWORD>@127.0.0.1:3306/vexgo_feature09
SHADOW_DATABASE_URL=mysql://<GIU_NGUYEN_SHADOW_USER_PASSWORD>@127.0.0.1:3306/vexgo_feature09_shadow
PORT=4003
CORS_ALLOWED_ORIGINS=http://localhost:3003
ADMIN_AUTH_COOKIE_ALLOWED_ORIGINS=http://localhost:3003
BUSINESS_TIME_ZONE=Asia/Ho_Chi_Minh
```

Đây là **placeholder cấu trúc**, tuyệt đối không sử dụng nguyên văn trong runtime. CORS có thể giữ các origin hiện có khi đúng nhu cầu; cookie Admin origin bắt buộc 3003. Nếu secret yêu cầu >=32 ký tự, giữ nguyên secret đang dùng nếu hợp lệ; không dán placeholder từ `.env.example` rồi bỏ qua lỗi login.

`apps/admin/.env.local` tại worktree:

```dotenv
NEXT_PUBLIC_API_URL=http://localhost:4003
```

Cookie cùng hostname `localhost` có thể gây nhiễu giữa port; dùng browser profile riêng khi test Feature 09.

## 4. Safe preflight → migrate/seed

`prisma.config.ts` đang dùng `MIGRATION_URL` + `SHADOW_DATABASE_URL`; `prisma/seed.mjs` đang đọc `DATABASE_URL` và có thể cập nhật seed rộng. Agent phải:

1. Kiểm tra root `.env` của worktree, đường dẫn/host/port/db trong cả ba URL **bằng parser che password**, xác nhận đúng `127.0.0.1:3306/vexgo_feature09` và shadow riêng. Thực hiện kiểm tra tương tự cho mọi test DB URL.
2. Kết nối MySQL server sẵn có, xác minh quyền và database thực tế (không in mật khẩu). **Không chạy migration/seed** nếu ba URL chưa kiểm chứng.
3. `npm ci` tại worktree, sau đó chạy `npx prisma migrate deploy` và `npx prisma generate` chỉ trên DB Feature 09.
4. Đọc toàn bộ seed entrypoint (`prisma.config.ts`, `prisma/seed-bootstrap.mjs`, `prisma/seed.mjs`) và phụ thuộc build. Chỉ seed **một lần** nếu DB Feature 09 mới và cần demo. Vì seed có thể update record trên các lần chạy lại, không re-seed bừa bãi sau khi đã đổi status trên UI.
5. Nếu chạy integration tests phá dữ liệu/truncate, tạo scratch DB Feature 09 có kiểm soát, không chạy destructive test trên DB demo khi chưa có isolation.
6. Xác nhận có phiếu ở `MOI_TAO` thuộc tenant đăng nhập thử; nếu không có, giải thích rõ dữ liệu thiếu. Không tạo mock frontend để giả API thành công.

Để chạy API/Admin từ worktree (CLI Next tránh script `--port 3001`):

```powershell
npm run dev --workspace=@vexgo/api
npm exec --workspace=@vexgo/admin -- next dev --port 3003
```

Agent có thể thay lệnh tương đương nếu npm CLI trên máy khác; phải xác nhận thực tế API lắng nghe 4003, Admin 3003. Có thể chạy hai terminal/process độc lập, không sửa `apps/admin/package.json` vì cấu hình local.

## 5. Gate an toàn

**STOP**, không chạy `migrate reset`, `db push --force-reset`, `DROP DATABASE`, xóa volume, không sửa migration lịch sử đã chạy. Không sử dụng/ghi vào `vexgo`, `vexgo_shadow`, database của Feature 07, production hoặc cloud. Không commit `.env`, `.env.local`, log, secret, artefact build/Prisma generated.

Handoff môi trường phải nêu: branch + base SHA, worktree path, port, **tên** database, kiểm tra quyền, migrate/generate/seed thực sự đã chạy, trạng thái DB-backed, blocker. Không đưa URL credential hoặc secret.
