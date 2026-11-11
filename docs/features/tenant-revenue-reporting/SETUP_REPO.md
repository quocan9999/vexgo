# SETUP_REPO — Feature 12 làm trực tiếp trên repo VexGo gốc (KHÔNG worktree)

**Chỉ dẫn cho agent:** Người dùng yêu cầu không tạo worktree riêng. Chỉ thay checkout của **repo gốc** sang branch feature, giữ nguyên metadata Git/repo và không tác động các branch/worktree khác. Hướng dẫn này **không phải setup phase phải dừng**; GOAL được phép setup rồi triển khai Phase 00 sau khi an toàn.

## 1. Kiểm tra repo và branch an toàn

- Đảm bảo `git rev-parse --show-toplevel` là repo gốc VexGo; `git remote -v` khớp `quocan9999/vexgo` (nếu remote đổi phải xác minh owner thực, không đoán).
- Trước khi checkout: `git status --short`, `git branch --show-current`; không tự `stash`, `reset --hard`, `clean`, discard hay overwrite các file uncommitted của người dùng. Nếu đang có thay đổi liên quan ZIP docs **chưa tracked** cần kiểm tra không collision; nếu có thay đổi code thực/commit chưa sẵn thì `BLOCKED` và báo rõ, không force checkout.
- `git fetch origin develop`; lưu SHA `git rev-parse origin/develop`; chưa có branch F12 thì từ repo gốc chạy `git switch -c feature/tenant-revenue-reporting origin/develop` (chỉ khi an toàn). Nếu branch đã tồn tại, **xem HEAD, base và dirty state trước**; không tự force/recreate.
- Tuyệt đối **không code trực tiếp trên `develop`**, không auto push/PR/merge/rebase. Không tự sync/mang thay đổi từ feature branch chưa merge.
- Giải nén ZIP **sau khi ở branch F12** vào repo root; archive prefix là `docs/features/tenant-revenue-reporting/`. Không giải nén trùng thành `docs/features/docs/features/...`. Không ghi đè tài liệu có edits chưa backup.

## 2. Ports và DB riêng

| Hạng mục | Giá trị bắt buộc | Ý nghĩa |
|---|---|---|
| MySQL | `127.0.0.1:3306` | MySQL SERVER SHARED, **không mở container MySQL thứ hai** |
| phpMyAdmin | `http://localhost:8091` | Shared, không tự đổi cấu hình stack của feature khác |
| Database app | `vexgo_feature12` | Chỉ F12 được phép drop/reset/reseed nếu demo không khớp |
| Database shadow | `vexgo_feature12_shadow` | Chỉ shadow của F12; KHÔNG trỏ trùng DB app |
| API | `http://localhost:4019` | Root env `PORT=4019` |
| Web | `http://localhost:3017` | `apps/web/.env.local` |
| Admin | `http://localhost:3018` | `apps/admin/.env.local` |
| Múi giờ nghiệp vụ | `Asia/Ho_Chi_Minh` | Bucketing tài chính |

**Dùng credentials đang hoạt động của môi trường local, không đưa password trong commit/handoff/chat.** `.env.example` ở root và `apps/{web,admin}/.env.example` là templates (có thể đã đổi trên develop). Không dùng mật khẩu ví dụ nếu chưa biết credentials thực tế.

Root `.env` — các key F12 tối thiểu; điền user/password chính xác, URL-encode password nếu cần:

```dotenv
MYSQL_PORT=3306
MYSQL_DATABASE=vexgo_feature12
PHPMYADMIN_PORT=8091
DATABASE_URL=mysql://<runtime-user>:<password-url-encoded>@127.0.0.1:3306/vexgo_feature12
MIGRATION_URL=mysql://<migration-user>:<password-url-encoded>@127.0.0.1:3306/vexgo_feature12
SHADOW_DATABASE_URL=mysql://<migration-user>:<password-url-encoded>@127.0.0.1:3306/vexgo_feature12_shadow
PORT=4019
BUSINESS_TIME_ZONE=Asia/Ho_Chi_Minh
CORS_ALLOWED_ORIGINS=http://localhost:3017,http://localhost:3018,http://127.0.0.1:3017,http://127.0.0.1:3018
ADMIN_AUTH_COOKIE_ALLOWED_ORIGINS=http://localhost:3018,http://127.0.0.1:3018
```

`apps/web/.env.local`:

```dotenv
PORT=3017
NEXT_PUBLIC_API_URL=http://localhost:4019/api/v1
```

`apps/admin/.env.local`:

```dotenv
PORT=3018
NEXT_PUBLIC_API_URL=http://localhost:4019
NEXT_PUBLIC_ADMIN_DATA_SOURCE=api
```

- Các env root còn lại (JWT/OTP/Cookie/SePay/etc.) **giữ từ cấu hình local hợp lệ hiện tại**; không commit hoặc log secret. `PAYMENT_DEMO_MODE` theo actual env; Feature Revenue không được dựa vào payment mock để làm số thật.
- Vì làm trên **repo gốc**, `.env`, `.env.local` có thể đang phục vụ tính năng khác: trước khi chỉnh phải **kiểm tra nội dung key, backup an toàn ra vùng local không track và xác nhận không có service đang dùng**. Không âm thầm ghi đè local env. Nếu không thể bảo vệ cấu hình hiện hữu → báo BLOCKED, không thay.
- Với Prisma 7, `prisma.config.ts` hiện đọc `MIGRATION_URL` và `SHADOW_DATABASE_URL`, API dùng `DATABASE_URL`. Runtime/migration DB có thể là cùng **app DB F12**, còn shadow **bắt buộc khác**. Trước thao tác seed/migrate/drop phải **in ra tên database đã parse từ URL (không in username/password)** và assert chính xác `vexgo_feature12`, `vexgo_feature12_shadow`.

## 3. Tạo & triển khai DB F12

- Chỉ tạo `vexgo_feature12` và `vexgo_feature12_shadow` trên MySQL existing (charset/collation theo repo). User xác nhận data **demo**, nên có thể reset/reseed **chỉ** hai DB này khi dữ liệu cũ không phù hợp; không có yêu cầu migration bảo toàn data demo F12.
- Tuyệt đối không `DROP DATABASE vexgo`, `vexgo_feature07`, `vexgo_feature09`, `vexgo_pr36` hoặc bất kỳ DB/volume shared nào khác; không chạy lệnh `docker compose down -v`, `prisma migrate reset` khi chưa chứng minh URL đích chỉ là F12 DB.
- Có thể chạy `npm ci` khi cần và lockfile chính thức; `npx prisma generate`, `npx prisma migrate deploy`, seed hiện hành nếu verified chỉ DB F12. Với migration mới, phải tạo theo convention repo và áp dụng F12 only; shadow DB cho Prisma Migrate phải thực sự isolated.
- Nếu schema migration cũ không tương thích demo seed → chỉnh seed dữ liệu F12 hoặc reset/reseed F12. Không hack migration cũ, không lén sửa seed của toàn team theo kịch bản chỉ để unit test pass. Commit schema/migrations code hợp lệ, không commit .env hoặc DB dump.
- phpMyAdmin 8091 dùng chung; nếu đã có container ở đó thì giữ, nếu chưa có không tự dựng service mới đè lên existing shared server.

## 4. Quality strategy đã chốt

- Chỉ **unit tests mục tiêu** cho logic backend tiền/scope/UTC offset/DTO/contract khó thấy bằng mắt. KHÔNG viết/chạy integration/e2e/browser automation/UI component test.
- Có thể chạy scoped `typecheck`, `lint`, `build` cho những workspace đổi; các lệnh này không thay thế unit test hoặc UI smoke thật.
- Người dùng tự truy cập Admin `3018`, Web `3017`, API `4019` và smoke test; giao manual checklist khi kết thúc.

## 5. Ghi thực tế vào handoff

Ngay khi bootstrap an toàn, ghi vào `handoff/INITIAL_HANDOFF.md` hoặc Phase 00: repo root path, branch, SHA `origin/develop`, 2 DB verified, env/ports set/not set, blocker, không đưa secrets. Trong implementation không có bước dừng riêng kiểu `SETUP_COMPLETE — STOPPED`, agent tiếp tục Phase 00 khi an toàn.
