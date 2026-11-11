# Feature 07 — Thiết lập môi trường độc lập (worktree, MySQL, port, `.env`)

**Phải hoàn tất trước Phase 1.** Không được chạy migration, seed hoặc API trước khi kiểm tra endpoint DB của worktree. Không thay đổi `.env` và process của repo gốc.

## 1. Baseline và worktree

Trong thư mục repo gốc, PowerShell:

```powershell
git status --short
git fetch origin develop
git worktree list
git worktree add -b feature/admin-bookings-tickets ..\vexgo-feature07 origin/develop
cd ..\vexgo-feature07
git branch --show-current
git status --short
```

Nếu branch/worktree đã tồn tại thì **không** tạo lại, xóa hoặc force; kiểm tra trạng thái rồi dùng worktree sẵn có. Worktree là thư mục sibling, tuyệt đối không triển khai Feature 07 trên `develop` của repo gốc. Nếu `origin/develop` đã đổi sau khi viết tài liệu, đọc lại diff/thiết kế liên quan trước khi implement.

## 2. Bảng port

| Dịch vụ | Baseline develop | Feature 07 | Cách cấu hình |
|---|---:|---:|---|
| Customer Next.js | 3000 | **3001** theo quy tắc +1, **không chạy đồng thời** Admin gốc | CLI riêng, chỉ khi cần |
| Admin Next.js | 3001 | **3002** | Next CLI trong worktree |
| API NestJS | 4000 | **4001** | `PORT=4001` trong `.env` worktree |
| MySQL host port | 3306 | **3307** | `MYSQL_PORT=3307` trong `.env` worktree |
| phpMyAdmin | 8080 | 8081 nếu thật sự cần | Phải cấu hình override riêng; không chạy phpMyAdmin từ `compose.yaml` mặc định |

**Cảnh báo port chéo:** Customer worktree 3001 trùng Admin gốc 3001; nếu cần chạy Customer đồng thời với toàn bộ repo gốc, dùng port trống khác (đề xuất 3003), ghi ngoại lệ vào handoff. Không tự kill process của repo gốc. Feature 07 chỉ yêu cầu Admin + API + MySQL chạy song song.

`apps/admin/package.json` có script `next dev --port 3001`, `apps/web/package.json` có `next dev --port 3000`; **không sửa script đã track chỉ để đổi port local**, vì khi merge sẽ ảnh hưởng team. Chạy API từ root worktree. Mở terminal Admin tại thư mục `apps/admin` trong worktree để chạy Next CLI trực tiếp:

```powershell
# Terminal 1 (root worktree): API, nhận PORT từ .env
npm run start:dev --workspace=@vexgo/api

# Terminal 2 (apps/admin, PowerShell): không dùng script hard-code 3001
& '..\..\node_modules\.bin\next.cmd' dev -p 3002

# Optional, chỉ khi 3001 trống:
npm exec --workspace=@vexgo/web -- next dev --port 3001
```

Nếu command `npm exec` khác theo nền tảng/npm thực tế, điều chỉnh CLI tương đương nhưng phải xác nhận server lắng nghe đúng port.

## 3. `.env` độc lập

Tại **root worktree** sao chép `.env.example` thành `.env` (bị `.gitignore` loại trừ). Giữ các giá trị khác chỉ khi phù hợp, thay hoặc tạo riêng:

```dotenv
MYSQL_DATABASE=vexgo_feature07
MYSQL_PORT=3307
MYSQL_USER=vexgo_f07_app
MYSQL_PASSWORD=<mat-khau-rieng-khong-commit>
MYSQL_ROOT_PASSWORD=<mat-khau-root-rieng-khong-commit>
DATABASE_URL=mysql://vexgo_f07_app:<URL_ENCODED_PASSWORD>@127.0.0.1:3307/vexgo_feature07
MIGRATION_URL=mysql://root:<URL_ENCODED_ROOT_PASSWORD>@127.0.0.1:3307/vexgo_feature07
SHADOW_DATABASE_URL=mysql://root:<URL_ENCODED_ROOT_PASSWORD>@127.0.0.1:3307/vexgo_feature07_shadow
PORT=4001
CORS_ALLOWED_ORIGINS=http://127.0.0.1:3002
ADMIN_AUTH_COOKIE_ALLOWED_ORIGINS=http://127.0.0.1:3002
BUSINESS_TIME_ZONE=Asia/Ho_Chi_Minh
OTP_HASH_SECRET=<random-khac-JWT-dai-it-nhat-32-ky-tu>
JWT_ACCESS_SECRET=<random-khac-OTP-dai-it-nhat-32-ky-tu>
REFUND_PROVIDER_URL=
REFUND_PROVIDER_TOKEN=
```

Chỉ là **mẫu**, thay placeholder bằng secret thật trong local (không commit). Khi có ký tự đặc biệt trong password URL, dùng URL encode. Chỉ cho phép localhost/127.0.0.1; không trỏ ra production hoặc DB gốc. Không in toàn bộ DATABASE_URL/secret ra log. Nếu Customer được chạy ở cổng khác, bổ sung chính xác origin đó vào CORS, giữ cookie allowed-origin chỉ cho Admin.

Trong **`apps/admin/.env.local` thuộc worktree**, đặt:

```dotenv
NEXT_PUBLIC_API_URL=http://127.0.0.1:4001
```

Kiểm tra key API thực tế ở Customer trước khi tạo `apps/web/.env.local`; không áp đặt key chưa có. Không sửa/copy `.env` từ repo gốc. `apps/api/src/app.module.ts` ưu tiên root `.env` khi chạy API từ workspace; `prisma.config.ts` đọc `MIGRATION_URL` và `SHADOW_DATABASE_URL` qua dotenv. Chạy CLI Prisma từ root worktree.

## 4. Docker MySQL cô lập bằng Compose project khác

Dùng **cùng compose.yaml**, nhưng Compose project name khác nên container và named volume khác:

```powershell
# Chạy từ root worktree, chỉ bật MySQL (tránh port phpMyAdmin 8080 bị trùng)
docker compose -p vexgo_feature07 --env-file .env up -d mysql
docker compose -p vexgo_feature07 --env-file .env ps
```

`compose.yaml` sẽ tạo `MYSQL_DATABASE=vexgo_feature07` trên volume mới. Không dùng `docker compose up` mặc định (vì phpMyAdmin cố định 8080) và không dùng `docker compose down -v` / xóa volume.

Prisma shadow database phải tách biệt main DB. Tạo thủ công nếu chưa tồn tại bằng **MySQL instance riêng của feature**:

```powershell
docker compose -p vexgo_feature07 --env-file .env exec mysql mysql -uroot -p
```

Nhập mật khẩu root của **feature** qua prompt, sau đó trong mysql shell:

```sql
CREATE DATABASE IF NOT EXISTS vexgo_feature07_shadow;
SHOW DATABASES;
```

Thoát bằng `exit;`. Không thực thi trên MySQL instance/volume gốc.

## 5. Chốt kiểm tra an toàn trước lệnh Prisma

Kiểm tra mọi URL bằng cách phân tích tên database và port, **không in password**. Chạy từ root worktree (Node + dotenv đã cài):

```powershell
node -r dotenv/config -e 'for (const [key, expected] of [["DATABASE_URL", "vexgo_feature07"], ["MIGRATION_URL", "vexgo_feature07"], ["SHADOW_DATABASE_URL", "vexgo_feature07_shadow"]]) { const url = new URL(process.env[key]); const db = decodeURIComponent(url.pathname.slice(1)); if (url.hostname !== "127.0.0.1" || url.port !== "3307" || db !== expected) { throw Error(key + " khong tro dung database feature07"); } console.log(key + " OK: " + url.hostname + ":" + url.port + "/" + db); }'
```

Nếu PowerShell xử lý nháy khác phiên bản, có thể chạy dưới Node script tạm thời **không commit**, bảo toàn các điều kiện trên. Dừng nếu URL không khớp. Kiểm tra process/port trống, `git status`, `docker compose -p vexgo_feature07 ... ps` và MySQL health.

Chỉ sau đó:

```powershell
npm ci
npx prisma migrate deploy
npx prisma generate
```

`migrate deploy` chạy các migration đã có lên DB mới, `generate` sinh Prisma Client; **không chạy `migrate reset`, `db push --force-reset`, `db seed` đại trà hoặc lệnh xóa dữ liệu** nếu chưa audit. Nếu cần seed phục vụ demo, kiểm tra `prisma/seed.mjs` vì seed có thể tác động rộng, chỉ chạy trên DB Feature 07 và phải được phép. Phase 1 cần cung cấp chiến lược idempotent để đồng bộ quyền `booking:read` lên DB đang có dữ liệu.

## 6. Test DB và CORS/cookie

- Test unit và frontend không được lặng lẽ dùng DB gốc.
- Trước integration/e2e test có DB, kiểm tra `DATABASE_URL` và mọi biến DB test do harness sử dụng; chỉ định thêm database test riêng `vexgo_feature07_test` trên container feature nếu test có thao tác xóa/truncate/rollback hoặc seed reset. **Không test destructive trên `vexgo_feature07` đang dùng thủ công** nếu harness không cô lập.
- Kiểm tra login Admin với origin `http://127.0.0.1:3002`, API `http://127.0.0.1:4001`; refresh cookie phải chấp nhận origin, CORS phải allow origin này. Không dùng `*` cho credentialed requests.
- Khi test browser nhớ 2 viewport 1440x900 và 375x667 ở Phase UI.

## 7. Handoff môi trường

Ghi trong `handoff/ENVIRONMENT_HANDOFF.md`: đường dẫn worktree, tên branch, commit base, Compose project name, container status, ports, **chỉ tên database (không URL chứa mật khẩu)**, các lệnh migration/generate đã thực thi, kết quả kiểm tra isolation, tình trạng worktree, và mọi ngoại lệ đã áp dụng. Không commit `.env`, `.env.local`, credentials, logs hoặc file tạm.

> Môi trường độc lập chỉ dùng cho **phát triển/test**. Schema và migration vẫn thuộc cùng project VexGo, sẽ được review/merge vào `develop` bình thường; không tạo một Prisma schema hay backend riêng cho Admin.
