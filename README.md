# 🚍 VexGo — Nền Tảng Công Nghệ Quản Lý & Đặt Vé Xe Khách Trực Tuyến

<p align="center">
  <img src="https://raw.githubusercontent.com/quocan9999/vexgo/main/apps/web/public/favicon.ico" alt="VexGo Logo" width="80" height="80" style="vertical-align: middle;" />
</p>

<p align="center">
  <strong>Giải pháp chuyển đổi số toàn diện cho mạng lưới vận tải hành khách và hàng hóa liên tỉnh</strong>
</p>

<p align="center">
  <a href="https://vexgo.site"><img src="https://img.shields.io/badge/Live-vexgo.site-22c55e?style=for-the-badge&logo=vercel&logoColor=white" alt="Live Site" /></a>
  <a href="https://admin.vexgo.site"><img src="https://img.shields.io/badge/Admin-admin.vexgo.site-3b82f6?style=for-the-badge&logo=vercel&logoColor=white" alt="Live Admin" /></a>
  <a href="https://api.vexgo.site/api/v1/health"><img src="https://img.shields.io/badge/API-api.vexgo.site-a855f7?style=for-the-badge&logo=render&logoColor=white" alt="Live API" /></a>
  <a href="https://github.com/quocan9999/vexgo"><img src="https://img.shields.io/badge/Status-Production_Ready-success?style=for-the-badge" alt="Production Ready" /></a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Next.js-16.0-black?logo=next.js" alt="Next.js 16" />
  <img src="https://img.shields.io/badge/NestJS-12.0-E0234E?logo=nestjs" alt="NestJS 12" />
  <img src="https://img.shields.io/badge/MySQL-8.4-4479A1?logo=mysql&logoColor=white" alt="MySQL 8.4" />
  <img src="https://img.shields.io/badge/Prisma-7.10-2D3748?logo=prisma" alt="Prisma" />
  <img src="https://img.shields.io/badge/TailwindCSS-4.0-38B2AC?logo=tailwind-css" alt="Tailwind CSS 4" />
  <img src="https://img.shields.io/badge/TypeScript-5.9-3178C6?logo=typescript" alt="TypeScript" />
  <img src="https://img.shields.io/badge/Socket.io-4.8-010101?logo=socket.io" alt="Socket.io" />
</p>

---

## 🌐 Hệ Thống Triển Khai Trực Tuyến (Production)

Toàn bộ hệ thống VexGo hiện đang vận hành trực tiếp trên tên miền chính thức **`vexgo.site`** với hạ tầng Cloud phân tán:

| Phân hệ | Tên miền chính thức | Nền tảng Cloud | Mục đích & Ghi chú |
| :--- | :--- | :---: | :--- |
| **Customer Web** | [https://vexgo.site](https://vexgo.site) | **Vercel** | Cổng đặt vé, gửi hàng và chăm sóc khách hàng (Next.js 16 App Router) |
| **Admin Portal** | [https://admin.vexgo.site](https://admin.vexgo.site) | **Vercel** | Bàn điều hành nhà xe và quản trị toàn hệ thống |
| **Backend API** | [https://api.vexgo.site/api/v1](https://api.vexgo.site/api/v1) | **Render** | REST API & Realtime Gateway (NestJS 12, Node.js 24) |
| **API Health Check** | [https://api.vexgo.site/api/v1/health](https://api.vexgo.site/api/v1/health) | **Render** | Endpoint giám sát & duy trì trạng thái 24/7 qua cron-job.org |
| **Database Server** | `mysql-vexgo-vexgo.h.aivencloud.com` | **Aiven** | MySQL 8.4 Cloud hỗ trợ TLS/SSL bảo mật cao |

---

## 📖 Giới Thiệu Tổng Quan

**VexGo** là nền tảng quản lý và thương mại điện tử chuyên biệt cho ngành vận tải xe khách liên tỉnh, hướng tới giải quyết bài toán phân mảnh dữ liệu giữa các nhà xe, tối ưu hóa công tác bán vé đa kênh (Online & Quầy vé POS) và tự động hóa quy trình ký gửi hàng hóa.

### Đối tượng phục vụ:
1. **Hành khách:** Trải nghiệm tìm kiếm tuyến đường thông minh, chọn vị trí ngồi trực quan trên sơ đồ 2 tầng, thanh toán không dùng tiền mặt (VietQR tự động), tra cứu hành trình và hỗ trợ trực tuyến song ngữ (Việt - Anh) kèm Trợ lý AI.
2. **Doanh nghiệp vận tải (Nhà xe):** Quản trị toàn trình từ đội xe, phương tiện, tài xế, mở chuyến, cấu hình biểu cước linh hoạt theo thời điểm, bán vé tại quầy (POS), quản lý gom dỡ hàng hóa và phân tích doanh thu chuyên sâu.
3. **Ban quản trị nền tảng (Super Admin):** Điều phối danh mục nhà xe, phê duyệt đối tác, giám sát vận hành toàn quốc và kiểm soát quyền hạn đa tầng (RBAC).

---

## 🏗️ Kiến Trúc Hệ Thống (Architecture)

Dự án áp dụng mô hình **Monorepo** chuẩn hóa với triết lý **ONE DATABASE · ONE BACKEND · ONE BUSINESS RULE**, phân tách rõ ràng trách nhiệm giữa các tầng:

```text
vexgo/
├── apps/
│   ├── web/                 # Customer Web App (Next.js 16, React 19, Tailwind CSS 4)
│   ├── admin/               # Admin Management Portal (Next.js 16, shadcn/ui, Radix)
│   └── api/                 # Core Backend API (NestJS 12, Prisma, Socket.IO, Express)
├── prisma/                  # Database Schema, 66 Migrations & Comprehensive Seed Pipeline
├── scripts/                 # Utility scripts phục vụ seed và kiểm chứng tính toàn vẹn dữ liệu
├── docs/                    # Tài liệu đặc tả kỹ thuật, hướng dẫn triển khai và báo cáo
└── render.yaml              # Cấu hình tự động hóa triển khai hạ tầng Render Blueprint
```

### Luồng Dữ Liệu & Tích Hợp Ngoại Vi:
```
[ Khách hàng / Quản trị viên ]
             │
             ▼
    [ Next.js Web / Admin ]
             │ (HTTPS / WSS)
             ▼
   [ NestJS Backend API ] ────► [ MariaDB Driver Pool (TLS/SSL) ] ──► [ Aiven MySQL 8.4 ]
             │
             ├──► [ TextBee.dev Android Gateway ] ──► Gửi SMS OTP thực tế đến điện thoại
             ├──► [ SePay Payment Gateway ]       ──► Webhook thanh toán VietQR tự động
             ├──► [ Cloudinary Media CDN ]        ──► Lưu trữ ảnh xe, giấy tờ & chứng từ
             ├──► [ SMTP Mail Server ]            ──► Gửi hóa đơn & vé điện tử qua email
             └──► [ Groq LLM & Jina Embeddings ]  ──► AI Chatbot tư vấn lịch trình (RAG)
```

---

## ✨ Tính Năng Nổi Bật

### 1. Phân hệ Khách hàng (Customer Web)
- **Tìm kiếm chuyến xe đa tiêu chí:** Lọc chuyến xe theo điểm đi, điểm đến, ngày khởi hành, khung giờ, nhà xe, loại xe (Giường nằm, Limousine, Ghế ngồi) và mức giá.
- **Sơ đồ ghế 2 tầng Realtime:** Hiển thị trực quan tầng dưới/tầng trên; áp dụng cơ chế khóa ghế tạm thời (Atomic Seat Hold) ngăn chặn triệt để tình trạng xung đột đặt trùng ghế (Race Condition).
- **Thanh toán VietQR tự động (SePay):** Sinh mã QR động kèm nội dung chuyển khoản độc bản; hệ thống tự động ghi nhận thanh toán và phát hành vé chỉ sau 2-3 giây.
- **Ký gửi hàng hóa liên tỉnh:** Đặt dịch vụ gửi hàng theo chuyến, tự động tính cước theo khoảng cách, khối lượng và thể tích; tra cứu vận đơn bằng mã phiếu gửi.
- **Trợ lý ảo AI Chatbot (RAG):** Ứng dụng mô hình ngôn ngữ lớn (Llama 3.3 qua Groq) kết hợp tìm kiếm ngữ nghĩa (Jina AI) để giải đáp lịch trình và chính sách 24/7.
- **Hủy vé & Đổi trả tự động:** Tính toán tỷ lệ hoàn tiền theo chính sách riêng của từng nhà xe và thời gian trước giờ khởi hành.
- **Đa ngôn ngữ (i18n):** Chuyển đổi mượt mà giữa Tiếng Việt và Tiếng Anh trên toàn bộ giao diện.

### 2. Phân hệ Quản trị (Admin Portal)
- **Phân quyền đa cấp bậc (RBAC):** Super Admin (toàn quyền nền tảng) và Admin Nhà xe (giới hạn trong phạm vi Tenant/Nhà xe sở hữu).
- **Quản lý Đội xe & Phương tiện:** Quản lý danh sách phương tiện, cấu hình bố cục ghế tùy biến theo từng loại xe.
- **Điều hành Tuyến & Chuyến xe:** Lập lịch trình, phân công tài xế/phụ xe, quản lý điểm đón/trả dọc đường và kiểm soát lệnh xuất bến.
- **Bán vé & Nhận hàng tại quầy (POS):** Giao diện chuyên dụng cho nhân viên phòng vé thao tác đặt chỗ, in vé và lập phiếu nhận hàng nhanh chóng.
- **Báo cáo Doanh thu Chuyên sâu:** Biểu đồ phân tích doanh thu theo ngày/tháng, sản lượng vé bán, tỷ lệ lấp đầy ghế và doanh thu dịch vụ gửi hàng.

### 3. Phân hệ Backend API
- **Kiến trúc Module hóa (NestJS):** Tách biệt rành mạch các domain: `auth`, `bus-companies`, `vehicles`, `routes`, `trips`, `bookings`, `tickets`, `shipments`, `payments`, `media`, `notifications`, `ai-chatbot`.
- **Bảo mật Đa tầng:** Xác thực qua Access Token JWT, bảo vệ phiên đăng nhập quản trị qua HttpOnly Cookie, mã hóa một chiều dữ liệu nhạy cảm.
- **Xác thực OTP qua SMS thật:** Tích hợp TextBee Android SMS Gateway chuyển tiếp tin nhắn SMS OTP thực tế tới điện thoại người dùng.

---

## 🔑 Tài Khoản Dùng Thử (Demo Accounts)

Hệ thống đã được nạp sẵn bộ dữ liệu mẫu toàn diện với **3.938 chuyến xe** và **117.964 ghế** (bao phủ từ tháng 09/2026 đến tháng 12/2026):

> **Mật khẩu dùng chung cho tất cả tài khoản bên dưới:** `VexGo@123`

| Vai trò | Số điện thoại đăng nhập | Đơn vị quản lý | Phạm vi truy cập |
| :--- | :---: | :--- | :--- |
| **Super Admin** | `+84900000000` | Toàn hệ thống VexGo | Toàn quyền kiểm soát, quản lý tất cả nhà xe |
| **Admin Nhà xe** | `+84900000101` | Công ty Phương Trang (FUTA) | Quản lý dữ liệu nội bộ nhà xe FUTA |
| **Admin Nhà xe** | `+84900000201` | Công ty Thành Bưởi (TB) | Quản lý dữ liệu nội bộ nhà xe Thành Bưởi |
| **Admin Nhà xe** | `+84900000301` | Công ty Hoa Mai (HM) | Quản lý dữ liệu nội bộ nhà xe Hoa Mai |
| **Khách hàng** | Đăng ký trực tiếp | Khách hàng cá nhân | Đặt vé, gửi hàng, lịch sử giao dịch cá nhân |

---

## 💻 Hướng Dẫn Cài Đặt & Vận Hành Local (Local Development)

### Yêu cầu tiên quyết
- **Node.js**: Phiên bản 20 LTS trở lên (khuyến nghị 24.x)
- **npm**: Phiên bản 10.x trở lên
- **Docker Desktop**: Chạy MySQL 8 và phpMyAdmin cục bộ
- **Git**

### 1. Clone repository & Cài đặt dependencies
```bash
git clone https://github.com/quocan9999/vexgo.git
cd vexgo

# Cài đặt toàn bộ dependencies cho tất cả workspaces từ root
npm install
```

### 2. Thiết lập biến môi trường
Tạo file cấu hình `.env` cho Backend và các file `.env.local` cho từng ứng dụng Frontend:

```bash
# Windows PowerShell
Copy-Item .env.example .env
Copy-Item apps/web/.env.example apps/web/.env.local
Copy-Item apps/admin/.env.example apps/admin/.env.local

# Linux / macOS
cp .env.example .env
cp apps/web/.env.example apps/web/.env.local
cp apps/admin/.env.example apps/admin/.env.local
```

### 3. Khởi động Cơ sở dữ liệu Docker
```bash
# Khởi chạy MySQL 8 và phpMyAdmin local
docker compose up -d

# Kiểm tra trạng thái containers
docker compose ps
```
- **MySQL Local**: `127.0.0.1:3306` (User: `vexgo_app` / Password: `vexgo_dev_password`)
- **phpMyAdmin**: [http://localhost:8080](http://localhost:8080)

### 4. Nạp dữ liệu mẫu (Database Seed)
```bash
# Chạy migration và chuỗi nạp dữ liệu toàn diện
npx prisma migrate dev
npx prisma db seed
```

### 5. Khởi chạy ứng dụng
Mở các terminal riêng biệt để chạy từng phân hệ:

```bash
# Terminal 1: Chạy Backend NestJS API (Port 4000)
npm run start:dev --workspace=@vexgo/api

# Terminal 2: Chạy Customer Web (Port 3000)
npm run dev --workspace=@vexgo/web

# Terminal 3: Chạy Admin Web (Port 3001)
npm run dev --workspace=@vexgo/admin
```

---

## 🧪 Kiểm Thử & Đảm Bảo Chất Lượng (Quality Assurance)

Dự án tuân thủ nghiêm ngặt quy trình kiểm thử trước khi bàn giao mã nguồn:

```bash
# Chạy Unit Tests Backend API (Vitest)
npm run test --workspace=@vexgo/api

# Kiểm tra kiểu dữ liệu TypeScript (Typecheck)
npm run typecheck

# Kiểm tra quy chuẩn mã nguồn (Linting)
npm run lint

# Build thử nghiệm toàn bộ dự án
npm run build
```

---

## 👥 Thành Viên Thực Hiện (Contributors)

Đồ án Khóa luận Tốt nghiệp Cử nhân Công nghệ Thông tin:

- **Trình Quốc An** — *Lead Developer / Full-stack Engineer*
- **Lê Sony** — *Frontend / Mobile Developer*
- **Phạm Minh Tài** — *Backend / Database Engineer*

---

## 📄 Bản Quyền & Giấy Phép (License)

Dự án được xây dựng phục vụ mục đích nghiên cứu học thuật và nghiệm thu Khóa luận Tốt nghiệp tại Trường Đại học Công Thương TP. Hồ Chí Minh (HUIT). 

Bản quyền mã nguồn thuộc về nhóm tác giả. Vui lòng liên hệ trước khi sử dụng lại với mục đích thương mại.
