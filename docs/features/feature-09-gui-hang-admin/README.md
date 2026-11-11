# VexGo — Feature 09: Gửi hàng Admin (MVP, ưu tiên demo)

**Trạng thái:** Phase 05 status UI và luồng API/MySQL/browser đã triển khai; kết luận demo cuối hiện **NOT READY** cho đến khi kiểm tra được detail phiếu có nhiều kiện hàng trên DB feature. Xem [`handoff/FINAL_HANDOFF.md`](handoff/FINAL_HANDOFF.md). CRUD hàng hóa/điểm/bảng cước và Customer online vẫn là backlog riêng.
**Quyết định nghiệp vụ:** 09/10/2026; roadmap HTML chỉ là tham khảo lịch sử.  
**Branch:** `feature/shipment-management` từ `origin/develop`. **Worktree:** sibling `vexgo-feature09`.  
**Mục tiêu:** Admin quản lý các phiếu gửi **đã tồn tại** trong database thật; không tạo phiếu thay khách.

## Danh mục

```text
docs/features/feature-09-gui-hang-admin/
├── README.md
├── ENVIRONMENT_WORKTREE.md
├── spec/
│   ├── MASTER_SPEC.md
│   ├── PHASE_01_RBAC_BACKEND_FOUNDATION.md
│   ├── PHASE_02_SHIPMENT_READ_APIS.md
│   ├── PHASE_03_ADMIN_LIST_DETAIL_UI.md
│   ├── PHASE_04_STATUS_TRANSITION_API.md
│   └── PHASE_05_ADMIN_STATUS_UI_ACCEPTANCE.md
└── handoff/
    ├── INITIAL_HANDOFF.md
    ├── HANDOFF_TEMPLATE.md
    ├── PHASE_04_HANDOFF.md
    ├── PHASE_05_HANDOFF.md
    └── FINAL_HANDOFF.md
```

**Gói ZIP** có thêm `CODEX_GOAL.txt` và `SETUP_FOR_CODEX.md` ở root archive để bootstrap; hai file này là hướng dẫn cho agent, **không cần commit vào repo**.

## Thứ tự làm việc

Các bước bootstrap bên dưới mô tả lần thiết lập ban đầu. Khi tiếp quản worktree/branch/database Feature 09 đang tồn tại, tiếp tục từ handoff gần nhất và **không chạy lại bước tạo worktree/database hoặc Setup Prompt**.

1. Người dùng đặt ZIP vào repository chính rồi mở Codex tại repo chính; Codex tự tạo/kiểm tra worktree và bung bộ docs vào worktree. **Người dùng không cần tự chạy git worktree.**
2. Codex đọc root `AGENTS.md`, `apps/admin/AGENTS.md`, `apps/admin/DESIGN.md`, tenant rules, `ENVIRONMENT_WORKTREE.md` và `spec/MASTER_SPEC.md` trước khi sửa.
3. Agent tự xác minh MySQL 3306 sẵn có, tạo riêng hai database, cấu hình `.env` tại worktree; không thay đổi nguồn gốc và Feature 07.
4. Triển khai tuần tự Phase 01 → 02 → 03 → 04 → 05. Mỗi phase đọc spec riêng, targeted tests, GitNexus impact/detect-changes, self-review, **một commit logic** (tiếng Việt + body gạch đầu dòng), viết handoff dưới `handoff/`.
5. Để demo sớm: Phase 03 xong sẽ có list/detail DB-backed; Phase 05 mới có mutation + timeline hoàn chỉnh. Không đánh dấu MVP READY nếu Phase 04–05 còn thiếu.
6. Giữ commit local; **không push/PR/merge/rebase Feature 07**, không đổi `develop` hay thư mục gốc.

## Nguồn tham chiếu

- Quyết định nghiệp vụ mới nhất trong cuộc thảo luận.
- `prisma/schema.prisma` và migrations trên branch thực tế; class diagram 002 gửi hàng và các shipment handoff.
- `docs/ADMIN_TENANCY_AND_OPERATIONS.md`, `AGENTS.md`, `apps/admin/AGENTS.md`, `apps/admin/DESIGN.md`, `rule-api.md` và các quy tắc GitNexus.
- Không tự copy các rule hoặc data mẫu từ Customer Web `/shipments/new`: màn hiện tại là demo hard-code, chưa có API tạo vận đơn.

> Đây là **MVP trước buổi báo cáo**, không phải bộ spec của toàn bộ Feature 09. Các CRUD loại hàng/điểm/bảng cước/capacity và Customer online là backlog riêng, không được tự đưa vào scope này.
