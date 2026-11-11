# Handoff môi trường — Feature 07

## Phạm vi

Phạm vi của lần setup này là worktree, dependencies, MySQL/Prisma và xác minh API/Admin; không thực hiện thêm Phase 1, seed, reset/drop DB, xóa volume, sửa script được Git track, commit, push hoặc tạo PR. Tại thời điểm xác minh, worktree đã có sẵn các commit Feature 07 nêu dưới đây; chúng được giữ nguyên.

## Git và worktree

- Worktree: `E:\Huit_Local\KhoaLuanCuNhan\SourceCode\vexgo-feature07`
- Branch: `feature/admin-bookings-tickets`
- Base commit: `f2edf7f8562a2e397f58b7c88568e7f1e6bd40c5`
- HEAD tại lần xác minh setup ban đầu: `48447c9c7567d8a8579ba881bdd3e24056dcdf68`; branch khi đó ahead 5 commit so với `origin/develop`. Sau đó lịch sử local được rebase/reword theo yêu cầu và tiếp tục có các commit P05/handoff.
- `origin/develop` sau `git fetch origin develop`: cùng commit `f2edf7f8562a2e397f58b7c88568e7f1e6bd40c5`
- Worktree tracking: `origin/develop`
- Checkout gốc `develop` vẫn ở commit trên và `git status --short --branch` sạch tại lần xác minh ngày 2026-10-09.
- ZIP `D:\data\Downloads\feature-07-pdv-ve-admin-docs.zip` đã được đối chiếu với thư mục đích. Cả năm file trong ZIP đều hiện diện; `HANDOFF_TEMPLATE.md` và `PHASE_01_RBAC_BACKEND_FOUNDATION.md` khớp byte-for-byte. Ba file `ENVIRONMENT_WORKTREE.md`, `README.md` và `MASTER_SPEC.md` khác bản ZIP, có thời gian cập nhật mới hơn; không giải nén đè lên các bản local này.
- Lưu ý phạm vi: tại lúc xác minh setup, worktree đã có năm commit Feature 07 trên baseline, gồm các commit P01–P04. Phần kiểm tra môi trường ban đầu không reset/clean DB hoặc volume; các commit implementation và handoff được thực hiện sau đó theo mục tiêu Feature 07.
- Các thay đổi tài liệu handoff phát sinh sau lần setup được ghi ở các commit docs riêng; không chứa secrets.
- **Lưu ý Git cục bộ:** file chung `.git/info/exclude` có quy tắc `docs/*`, nên tài liệu Feature 07 hiện có trên đĩa nhưng bị ignore và không hiện trong `git status`. Không sửa quy tắc chung này và không force-stage tài liệu trong bước setup. Nếu muốn đưa tài liệu vào commit sau này, cần chủ động `git add -f docs/feature-07-pdv-ve-admin/` hoặc điều chỉnh exclude phù hợp.

## Môi trường riêng

| Thành phần | Cấu hình Feature 07 | Kết quả |
|---|---|---|
| Admin | `http://127.0.0.1:3002` | HTTP 200; Next.js đã đọc `apps/admin/.env.local` |
| API | `http://127.0.0.1:4001` | `/api/v1/health` trả HTTP 200; CORS cho `http://127.0.0.1:3002`, credentials `true` |
| MySQL | `127.0.0.1:3307` | Container healthy |
| phpMyAdmin | Không chạy; 8080 đang được Compose gốc dùng | Không cần dùng 8081 |
| Customer Web | Không chạy | Không thuộc phạm vi setup |

- Compose project: `vexgo_feature07`
- Container: `vexgo_feature07-mysql-1`
- Volume mới: `vexgo_feature07_mysql_data`, mount tại `/var/lib/mysql`
- Database ứng dụng: `vexgo_feature07`
- Shadow database: `vexgo_feature07_shadow`
- Cấu hình DB chỉ bind vào `127.0.0.1:3307`.
- File riêng: root `.env` tạo từ `.env.example`; `apps/admin/.env.local` đặt API URL `http://127.0.0.1:4001`.
- MYSQL root/app password, `OTP_HASH_SECRET` và `JWT_ACCESS_SECRET` được sinh mới, riêng biệt; mỗi secret dài 64 ký tự hex. Giá trị không được ghi trong handoff.
- Chọn `127.0.0.1` cho cả Admin/API và CORS/cookie allowlist để tách host cookie khỏi `localhost` của cấu hình mẫu. Không đọc hoặc sao chép `.env` của checkout gốc.
- Các file `.env` được ignore. Prisma Client sinh tại `apps/api/src/generated/prisma` cũng được ignore.

## Lệnh đã chạy và kết quả

1. Tại checkout gốc: `git status --short --branch`, `git worktree list`, kiểm tra remote/origin và `git fetch origin develop`; checkout gốc sạch.
2. Tạo worktree: `git worktree add -b feature/admin-bookings-tickets ..\vexgo-feature07 origin/develop`.
3. Trong worktree: tạo `.env` và Admin `.env.local`; xác minh hostname, port, database của `DATABASE_URL`, `MIGRATION_URL`, `SHADOW_DATABASE_URL` mà không in credentials.
4. `npm ci` — thành công, thêm 1.077 packages. npm báo 18 vulnerabilities (1 moderate, 16 high, 1 critical); không chạy `npm audit fix` và không thay dependency.
5. Xác minh Compose config có project `vexgo_feature07`, volume `vexgo_feature07_mysql_data`, database `vexgo_feature07`, port `3307`.
6. `docker compose -p vexgo_feature07 --env-file .env up -d --wait mysql` — MySQL healthy; chỉ service `mysql` được khởi động.
7. Tạo và kiểm tra `vexgo_feature07_shadow` bên trong container Feature 07.
8. Xác minh lại ba URL trước Prisma; `npx prisma migrate deploy` — 23 migration áp dụng thành công; `npx prisma generate` — Prisma Client 7.10.0 sinh thành công; `npx prisma migrate status` — schema up to date.
9. `npm run start:dev --workspace=@vexgo/api` — API chạy trên 4001; Nest khởi tạo PrismaService, health/CORS đạt như bảng trên.
10. Admin chạy bằng lệnh trực tiếp từ thư mục `apps/admin`: `& '..\..\node_modules\.bin\next.cmd' dev -p 3002`; homepage trả HTTP 200. Lệnh `npm exec --workspace=@vexgo/admin -- next dev --port 3002` trong tài liệu ZIP không tương thích với npm hiện tại, nên dùng Next CLI trực tiếp để giữ nguyên package script đã track.

API và Admin đang chạy để dùng tiếp. Không chạy test suite hoặc seed.

## Xác nhận isolation

- Compose gốc vẫn có container `vexgo-mysql-1` trên `3306`, phpMyAdmin gốc trên `8080`; volume `vexgo_mysql_data` vẫn còn. Không dừng hoặc xóa chúng.
- MySQL Feature 07 dùng project và volume mới, không dùng DB/volume gốc.
- Repo gốc `develop` sạch ở lần kiểm tra cuối. Worktree đang có năm commit Feature 07 và hai thay đổi tài liệu staged như ghi ở trên; `.env`/`.env.local` bị ignore, các tài liệu khác bị ảnh hưởng bởi quy tắc `docs/*` trong `.git/info/exclude`.
- Các URL API/DB trong `.env` đã được kiểm tra chỉ in hostname, port và tên database; password không được ghi vào handoff hoặc log.

## Còn lại

Chưa có lỗi chặn môi trường. npm dependency audit warning nêu trên cần được xem xét riêng nếu team muốn xử lý; không thuộc setup này.
