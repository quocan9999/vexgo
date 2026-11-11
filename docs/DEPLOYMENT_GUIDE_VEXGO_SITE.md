# Hướng dẫn Deploy VexGo lên Cloud với tên miền `vexgo.site` (Tenten.vn)

Tài liệu này hướng dẫn chi tiết từng bước triển khai toàn bộ hệ thống **VexGo** lên các dịch vụ Cloud **hoàn toàn miễn phí ($0/tháng)**, nạp sẵn toàn bộ dữ liệu mẫu (`npx prisma db seed`), trỏ tên miền `vexgo.site` từ **Tenten.vn** và chống sleep cho API bằng **cron-job.org**.

---

## Tổng quan kiến trúc triển khai

| Thành phần | Tên miền | Nền tảng Cloud | Ghi chú |
| :--- | :--- | :--- | :--- |
| **Customer Web** (`apps/web`) | `https://vexgo.site`<br>`https://www.vexgo.site` | **Vercel** (Free) | Next.js 16 SSR + Global CDN |
| **Admin Web** (`apps/admin`) | `https://admin.vexgo.site` | **Vercel** (Free) | Next.js 16 Admin Portal |
| **Backend API & Socket.IO** (`apps/api`) | `https://api.vexgo.site` | **Render** (Web Service Free) | NestJS 12 + REST API + Realtime Chat |
| **Database MySQL 8** | Nội bộ Cloud (SSL/TLS) | **Aiven for MySQL** (Free 5GB) | MySQL 8 chuẩn, kết nối qua `?ssl-mode=REQUIRED` |
| **Keep-Alive (Chống sleep)** | Ping `/api/v1/health` | **cron-job.org** (Free) | Gọi mỗi 10 phút để Render không ngủ sau 15 phút |

---

## Bước 1: Tạo Database MySQL 8 miễn phí trên Aiven

1. Truy cập [https://console.aiven.io/](https://console.aiven.io/) và đăng ký/đăng nhập tài khoản.
2. Nhấn **Create service** → Chọn **MySQL**:
   - **Version:** MySQL 8
   - **Cloud Provider & Region:** Chọn vùng gần Việt Nam nhất (ví dụ: **DigitalOcean - Singapore** hoặc **AWS - ap-southeast-1**).
   - **Service Plan:** Chọn **Free** (1 CPU, 1GB RAM, 5GB Storage — $0/tháng).
   - **Service Name:** Đặt là `mysql-vexgo` rồi nhấn **Create free service**.
3. Đợi khoảng 2–3 phút cho tới khi trạng thái chuyển sang **Running** (màu xanh lá).
4. **Tắt cấu hình `sql_require_primary_key` trên Aiven (Bắt buộc):**
   - Trong trang quản lý dịch vụ MySQL trên Aiven, chọn mục **Service settings** ở menu bên trái.
   - Cuộn xuống phần **Advanced configuration** → nhấn **Configure** (hoặc **Add configuration option**).
   - Tìm và chọn **`mysql.sql_require_primary_key`**, gạt công tắc sang **Off (`false`)** rồi nhấn **Save configuration**.
   - *(Lý do: Một số migration của VexGo tạo bảng tạm `CREATE TEMPORARY TABLE` để kiểm tra ràng buộc dữ liệu không có cột Primary Key; mặc định Aiven bật cờ này nên cần tắt đi để chạy toàn bộ 65 migrations).*
5. Quay lại tab **Overview** (mục **Connection information**), sao chép giá trị **Service URI**. Chuỗi này có dạng:
   ```text
   mysql://avnadmin:<PASSWORD>@mysql-vexgo-xxxx.aivencloud.com:25060/defaultdb?ssl-mode=REQUIRED
   ```
   > **Lưu ý:** Code VexGo (`prisma.config.ts`, `PrismaService` và toàn bộ script seed) đã được cấu hình tự động nhận diện `?ssl-mode=REQUIRED` để chuyển đổi sang `?sslaccept=accept_invalid_certs` cho Prisma CLI và bật kết nối TLS/SSL tới chứng chỉ CA của Aiven.

---

## Bước 2: Đẩy Schema & Toàn bộ dữ liệu mẫu (117.964 ghế & 3.938 chuyến xe) lên Aiven trong 20 giây

Bộ dữ liệu mẫu đầy đủ của VexGo (`npx prisma db seed`) rất lớn (~23MB gồm **3.938 chuyến xe** và **117.964 ghế chuyến xe** từ tháng 9 đến tháng 12/2026).
- Nếu chạy trực tiếp `npx prisma db seed` qua mạng Internet tới server Aiven ở Singapore, các lệnh `upsert` từng dòng một (120.000+ vòng lặp mạng) sẽ mất hàng giờ đồng hồ.
- Thay vào đó, hãy **chạy seed ở Docker MySQL local (hoặc lấy trực tiếp từ container Docker MySQL local đã có sẵn dữ liệu) rồi truyền dạng gói (`mysqldump` multi-row insert) lên Aiven** — toàn bộ 117.964 ghế sẽ được nạp lên Aiven chỉ trong **~20 giây**!

Mở **PowerShell** và chạy lệnh một dòng sau (thay thông tin host/port/password Aiven của bạn nếu khác):

```powershell
docker exec deploy-deploy-project-mysql-1 sh -c "MYSQL_PWD=vexgo_root_dev mysqldump -uroot --single-transaction --no-tablespaces --set-gtid-purged=OFF vexgo | MYSQL_PWD='<AIVEN_PASSWORD>' mysql -h <AIVEN_HOST> -P <AIVEN_PORT> -u avnadmin --ssl-mode=REQUIRED defaultdb"
```

Sau khi lệnh chạy xong (~20 giây), kiểm tra lại bằng lệnh:
```powershell
node scripts/verify-uuid4-all.mjs
```
Khi màn hình hiện `[PASS]` toàn bộ 14 bảng dữ liệu là database Aiven của bạn đã có đầy đủ 100% dữ liệu mẫu giống hệt môi trường local!

**Tài khoản đăng nhập mặc định sau khi seed (mật khẩu chung: `VexGo@123`):**
- **Super Admin:** `+84900000000` (hoặc `0900000000`)
- **Admin Phương Trang (FUTA):** `+84900000101`
- **Admin Thành Bưởi (TB):** `+84900000201`
- **Admin Hoa Mai (HM):** `+84900000301`

---

## Bước 3: Deploy Backend API (`@vexgo/api`) lên Render

1. Đẩy nhánh code đã cập nhật lên GitHub repository của bạn.
2. Đăng nhập [https://dashboard.render.com/](https://dashboard.render.com/).
3. Nhấn **New +** → **Web Service** → Kết nối tới GitHub repository `vexgo` của bạn.
4. Cấu hình dịch vụ:
   - **Name:** `vexgo-api`
   - **Region:** `Singapore (Southeast Asia)`
   - **Root Directory:** *(để trống — chạy từ thư mục gốc của monorepo)*
   - **Runtime:** `Node`
   - **Build Command:**
     ```bash
     npm ci --include=dev && npm run build --workspace=@vexgo/api && npx prisma migrate deploy
     ```
   - **Start Command:**
     ```bash
     npm run start:prod --workspace=@vexgo/api
     ```
   - **Instance Type:** `Free`
5. Kéo xuống mục **Environment Variables**, thêm các biến sau:

| Key | Value |
| :--- | :--- |
| `NODE_ENV` | `production` |
| `PORT` | `4000` |
| `DATABASE_URL` | `mysql://avnadmin:...@...aivencloud.com:.../defaultdb?ssl-mode=REQUIRED` *(Service URI từ Aiven)* |
| `MIGRATION_URL` | *(Dán giống hệt giá trị `DATABASE_URL` ở trên)* |
| `BUSINESS_TIME_ZONE` | `Asia/Ho_Chi_Minh` |
| `CORS_ALLOWED_ORIGINS` | `https://vexgo.site,https://www.vexgo.site,https://admin.vexgo.site` |
| `ADMIN_AUTH_COOKIE_ALLOWED_ORIGINS` | `https://admin.vexgo.site` |
| `JWT_ACCESS_SECRET` | *(Chuỗi ngẫu nhiên >= 32 ký tự, ví dụ chạy `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`)* |
| `OTP_HASH_SECRET` | *(Chuỗi ngẫu nhiên >= 32 ký tự khác với JWT_ACCESS_SECRET)* |
| `SMS_PROVIDER` | `textbee` *(Gửi OTP qua TextBee Android Gateway)* |
| `TEXTBEE_API_KEY` | *(Lấy từ TextBee.dev Dashboard)* |
| `TEXTBEE_DEVICE_ID` | *(ID thiết bị Android hiển thị trên TextBee.dev)* |
| `SEPAY_ACCOUNT_NUMBER` | *(Số tài khoản ngân hàng nhận tiền SePay của bạn)* |
| `SEPAY_WEBHOOK_SECRET` | *(Chuỗi bí mật ngẫu nhiên >= 32 ký tự)* |
| `PAYMENT_DEMO_MODE` | `false` *(hoặc `true` nếu muốn bật nút xác nhận thanh toán demo)* |

6. Nhấn **Deploy Web Service**. Khi build xong, truy cập thử `https://<ten-service-cua-ban>.onrender.com/api/v1/health` sẽ thấy trả về:
   ```json
   { "data": { "status": "ok" } }
   ```
7. **Gắn tên miền `api.vexgo.site` trên Render:**
   - Trong trang quản lý service `vexgo-api` trên Render, vào tab **Settings** → cuộn tới mục **Custom Domains**.
   - Nhấn **Add Custom Domain** → nhập `api.vexgo.site` → nhấn **Save**.
   - Render sẽ hiển thị địa chỉ CNAME đích (ví dụ: `vexgo-api-xxxx.onrender.com`) để bạn trỏ trên Tenten ở Bước 5.

---

## Bước 4: Deploy Customer Web & Admin Web lên Vercel

Bạn sẽ tạo **2 project riêng biệt** trên [https://vercel.com/](https://vercel.com/) từ cùng 1 GitHub repository `vexgo`.

### 4.1. Project 1: Customer Web (`vexgo-web`)
1. Trên Vercel Dashboard, nhấn **Add New...** → **Project** → Chọn repo `vexgo`.
2. Cấu hình:
   - **Project Name:** `vexgo-web`
   - **Framework Preset:** `Next.js`
   - **Root Directory:** Nhấn **Edit** và chọn `apps/web`
3. Mở mục **Environment Variables**, thêm các biến sau:

| Key | Value |
| :--- | :--- |
| `NEXT_PUBLIC_API_URL` | `https://api.vexgo.site/api/v1` *(Bắt buộc có hậu tố `/api/v1`)* |
| `VEXGO_API_URL` | `https://api.vexgo.site/api/v1` |
| `NEXT_PUBLIC_SOCKET_URL` | `https://api.vexgo.site` *(Không có `/api/v1`)* |
| `NEXT_PUBLIC_SEPAY_BANK_ID` | *(Mã ngân hàng nhận VietQR của bạn, ví dụ `MB` hoặc `VCB`)* |
| `NEXT_PUBLIC_SEPAY_ACCOUNT_NUMBER` | *(Số tài khoản nhận tiền)* |
| `NEXT_PUBLIC_SEPAY_ACCOUNT_NAME` | *(Tên chủ tài khoản không dấu)* |

4. Nhấn **Deploy**.
5. Sau khi deploy xong, vào **Settings** → **Domains** của project `vexgo-web`:
   - Thêm `vexgo.site` và `www.vexgo.site`.

### 4.2. Project 2: Admin Web (`vexgo-admin`)
1. Quay lại Vercel Dashboard, nhấn **Add New...** → **Project** → Chọn lại repo `vexgo`.
2. Cấu hình:
   - **Project Name:** `vexgo-admin`
   - **Framework Preset:** `Next.js`
   - **Root Directory:** Nhấn **Edit** và chọn `apps/admin`
3. Mở mục **Environment Variables**, thêm các biến sau:

| Key | Value |
| :--- | :--- |
| `NEXT_PUBLIC_API_URL` | `https://api.vexgo.site` *(Lưu ý: Admin Web **KHÔNG** có `/api/v1` ở cuối vì service Admin tự nối `/api/v1`)* |
| `NEXT_PUBLIC_SOCKET_URL` | `https://api.vexgo.site` |
| `NEXT_PUBLIC_ADMIN_DATA_SOURCE` | `api` |

4. Nhấn **Deploy**.
5. Sau khi deploy xong, vào **Settings** → **Domains** của project `vexgo-admin`:
   - Thêm `admin.vexgo.site`.

---

## Bước 5: Cấu hình bản ghi DNS cho `vexgo.site` trên Tenten.vn

1. Đăng nhập trang quản trị tên miền tại [https://domain.tenten.vn/](https://domain.tenten.vn/) (hoặc trang quản lý dịch vụ của Tenten).
2. Chọn tên miền **`vexgo.site`** → vào mục **Cấu hình DNS** (Quản lý bản ghi DNS).
3. Thêm/cập nhật chính xác **4 bản ghi** dưới đây:

| Tên bản ghi (Host / Record) | Loại (Type) | Giá trị (Value / Points to) | Mục đích |
| :--- | :---: | :--- | :--- |
| `@` *(hoặc để trống)* | `A` | `76.76.21.21` | Trỏ `vexgo.site` về Vercel (Customer Web) |
| `www` | `CNAME` | `cname.vercel-dns.com` | Trỏ `www.vexgo.site` về Vercel (Customer Web) |
| `admin` | `CNAME` | `cname.vercel-dns.com` | Trỏ `admin.vexgo.site` về Vercel (Admin Web) |
| `api` | `CNAME` | `<ten-service-cua-ban>.onrender.com` | Trỏ `api.vexgo.site` về Render (Backend API) |

> **Mẹo kiểm tra:**
> - Nếu trên Vercel hiển thị một chuỗi CNAME riêng dạng `xxxxxx.vercel-dns-017.com` trong mục Domains, bạn có thể điền chuỗi đó hoặc `cname.vercel-dns.com` đều hoạt động.
> - Sau khi lưu trên Tenten khoảng 5–15 phút, quay lại tab **Custom Domains** trên Render (nhấn nút **Verify**) và tab **Domains** trên Vercel để hệ thống tự động cấp chứng chỉ HTTPS (Let's Encrypt SSL).

---

## Bước 6: Cấu hình cron-job.org để giữ API luôn thức 24/7

Gói Free của Render sẽ tự động đưa container vào trạng thái ngủ nếu không có HTTP request nào trong 15 phút. Để giữ server luôn thức:

1. Truy cập [https://cron-job.org/](https://cron-job.org/), đăng ký tài khoản miễn phí và đăng nhập.
2. Vào **Cronjobs** → nhấn **CREATE CRONJOB**:
   - **Title:** `VexGo API Keep-Alive`
   - **URL:** `https://api.vexgo.site/api/v1/health`
   - **Execution schedule:** Chọn **Every 10 minutes** (Mỗi 10 phút).
   - Trong tab **Advanced** (tùy chọn):
     - **Request method:** `GET`
     - **Timeout:** `30 seconds`
3. Nhấn **CREATE**.
4. Nhấn nút **TEST RUN** để kiểm tra ngay: nếu nhận được `200 OK` với nội dung `{"data":{"status":"ok"}}` là hệ thống của bạn đã hoạt động hoàn hảo 24/7!
