import { randomUUID } from 'node:crypto';
import { Test } from '@nestjs/testing';
import type { ExecutionContext, INestApplication } from '@nestjs/common';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { AppModule } from '../../../src/app.module.js';
import { AccessTokenGuard } from '../../../src/auth/guards/access-token.guard.js';
import type { AuthPrincipal } from '../../../src/auth/tokens/auth-principal.js';
import { configureApi } from '../../../src/common/configure-api.js';
import { PrismaService } from '../../../src/prisma/prisma.service.js';
import { SupportChatService } from '../../../src/support-chat/support-chat.service.js';
import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';

describe('Support Chat Backend Integration & Concurrency Tests (MySQL DB-backed)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let chatService: SupportChatService;

  const testSuffix = randomUUID().replaceAll('-', '').slice(0, 8);
  let busCompanyAId: number;
  let busCompanyBId: number;
  let busCompanySuspendedId: number;

  let customerUser: { taiKhoanId: number; khachHangId: number; principal: AuthPrincipal };
  let staffUserA1: { taiKhoanId: number; nhanVienId: number; principal: AuthPrincipal };
  let staffUserA2: { taiKhoanId: number; nhanVienId: number; principal: AuthPrincipal };
  let staffUserB: { taiKhoanId: number; nhanVienId: number; principal: AuthPrincipal };
  let superAdminUser: { taiKhoanId: number; principal: AuthPrincipal };

  let createdConversationIds: number[] = [];

  beforeAll(async () => {
    let currentPrincipal: AuthPrincipal | null = null;
    const accessTokenGuard = {
      canActivate(context: ExecutionContext) {
        if (currentPrincipal) {
          context.switchToHttp().getRequest<{ user?: AuthPrincipal }>().user = currentPrincipal;
        }
        return true;
      },
    };

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(AccessTokenGuard)
      .useValue(accessTokenGuard)
      .compile();

    app = moduleRef.createNestApplication();
    configureApi(app);
    await app.init();

    prisma = app.get(PrismaService);
    chatService = app.get(SupportChatService);

    // 1. Tạo 2 nhà xe hoạt động và 1 nhà xe tạm ngưng
    const companyA = await prisma.nhaXe.create({
      data: {
        maNhaXe: `NX-A-${testSuffix}`,
        tenNhaXe: `Nhà Xe A ${testSuffix}`,
        trangThai: 'HOAT_DONG',
      },
    });
    busCompanyAId = companyA.nhaXeId;

    const companyB = await prisma.nhaXe.create({
      data: {
        maNhaXe: `NX-B-${testSuffix}`,
        tenNhaXe: `Nhà Xe B ${testSuffix}`,
        trangThai: 'HOAT_DONG',
      },
    });
    busCompanyBId = companyB.nhaXeId;

    const companySuspended = await prisma.nhaXe.create({
      data: {
        maNhaXe: `NX-S-${testSuffix}`,
        tenNhaXe: `Nhà Xe Tam Ngung ${testSuffix}`,
        trangThai: 'TAM_NGUNG',
      },
    });
    busCompanySuspendedId = companySuspended.nhaXeId;

    // 2. Tạo tài khoản Khách hàng
    const tkCustomer = await prisma.taiKhoan.create({
      data: {
        hoTen: `Khách Hàng ${testSuffix}`,
        soDienThoai: `09${Math.floor(10000000 + Math.random() * 90000000)}`,
        matKhau: '$2b$10$hashedpasswordforexample',
        email: `cust_${testSuffix}@example.com`,
        daXacThucSoDienThoai: true,
        trangThai: 'HOAT_DONG',
      },
    });
    const khachHang = await prisma.khachHang.create({
      data: {
        maKhachHang: `KH-${testSuffix}`,
        taiKhoanId: tkCustomer.taiKhoanId,
      },
    });
    customerUser = {
      taiKhoanId: tkCustomer.taiKhoanId,
      khachHangId: khachHang.khachHangId,
      principal: {
        taiKhoanId: tkCustomer.taiKhoanId,
        sessionId: `sess-cust-${testSuffix}`,
        roles: ['KHACH_HANG'],
        permissions: [],
        nhanVienId: null,
        nhaXeId: null,
      },
    };

    // 3. Tạo 2 tài khoản Nhân viên nhà xe A có quyền chat:manage
    const createStaff = async (name: string, companyId: number) => {
      const tk = await prisma.taiKhoan.create({
        data: {
          hoTen: `${name} ${testSuffix}`,
          soDienThoai: `09${Math.floor(10000000 + Math.random() * 90000000)}`,
          matKhau: '$2b$10$hashedpasswordforexample',
          email: `${name.toLowerCase().replace(/\s+/g, '_')}_${testSuffix}@example.com`,
          daXacThucSoDienThoai: true,
          trangThai: 'HOAT_DONG',
        },
      });
      const nv = await prisma.nhanVien.create({
        data: {
          maNhanVien: `NV-${randomUUID().slice(0, 6)}`,
          taiKhoanId: tk.taiKhoanId,
          nhaXeId: companyId,
          trangThaiLamViec: 'DANG_LAM_VIEC',
        },
      });
      return {
        taiKhoanId: tk.taiKhoanId,
        nhanVienId: nv.nhanVienId,
        principal: {
          taiKhoanId: tk.taiKhoanId,
          sessionId: `sess-${nv.nhanVienId}`,
          roles: ['NHAN_VIEN_CSKH'],
          permissions: ['chat:read', 'chat:manage'],
          nhanVienId: nv.nhanVienId,
          nhaXeId: companyId,
        },
      };
    };

    staffUserA1 = await createStaff('Staff A1', busCompanyAId);
    staffUserA2 = await createStaff('Staff A2', busCompanyAId);
    staffUserB = await createStaff('Staff B', busCompanyBId);

    // 4. Tạo tài khoản Super Admin
    const tkAdmin = await prisma.taiKhoan.create({
      data: {
        hoTen: `Super Admin ${testSuffix}`,
        soDienThoai: `09${Math.floor(10000000 + Math.random() * 90000000)}`,
        matKhau: '$2b$10$hashedpasswordforexample',
        email: `superadmin_${testSuffix}@example.com`,
        daXacThucSoDienThoai: true,
        trangThai: 'HOAT_DONG',
      },
    });
    superAdminUser = {
      taiKhoanId: tkAdmin.taiKhoanId,
      principal: {
        taiKhoanId: tkAdmin.taiKhoanId,
        sessionId: `sess-admin-${testSuffix}`,
        roles: ['SUPER_ADMIN'],
        permissions: ['*'],
        nhanVienId: null,
        nhaXeId: null,
      },
    };
  }, 30000);

  afterAll(async () => {
    // Cleanup DB
    if (prisma) {
      if (createdConversationIds.length > 0) {
        await prisma.tinNhanHoTro.deleteMany({
          where: { cuocTroChuyenId: { in: createdConversationIds } },
        });
        await prisma.cuocTroChuyen.deleteMany({
          where: { cuocTroChuyenId: { in: createdConversationIds } },
        });
      }

      const allTaiKhoanIds = [
        customerUser?.taiKhoanId,
        staffUserA1?.taiKhoanId,
        staffUserA2?.taiKhoanId,
        staffUserB?.taiKhoanId,
        superAdminUser?.taiKhoanId,
      ].filter(Boolean) as number[];

      if (customerUser?.khachHangId) {
        await prisma.khachHang.deleteMany({ where: { taiKhoanId: customerUser.taiKhoanId } });
      }

      const allNhanVienIds = [
        staffUserA1?.nhanVienId,
        staffUserA2?.nhanVienId,
        staffUserB?.nhanVienId,
      ].filter(Boolean) as number[];

      if (allNhanVienIds.length > 0) {
        await prisma.nhanVien.deleteMany({ where: { nhanVienId: { in: allNhanVienIds } } });
      }

      if (allTaiKhoanIds.length > 0) {
        await prisma.taiKhoan.deleteMany({ where: { taiKhoanId: { in: allTaiKhoanIds } } });
      }

      const companyIds = [busCompanyAId, busCompanyBId, busCompanySuspendedId].filter(Boolean);
      if (companyIds.length > 0) {
        await prisma.nhaXe.deleteMany({ where: { nhaXeId: { in: companyIds } } });
      }
    }

    if (app) {
      await app.close();
    }
  });

  describe('BE-08 & BE-04: Row-Level Locking & Concurrent Conversation Creation', () => {
    it('gọi đồng thời createConversation không tạo trùng hội thoại và khóa hàng an toàn qua $queryRaw FOR UPDATE', async () => {
      // 2 cuộc gọi đồng thời từ cùng 1 khách hàng tới cùng 1 nhà xe
      const [res1, res2] = await Promise.all([
        chatService.createConversation(customerUser.principal, {
          nhaXeId: busCompanyAId,
          tinNhanDauTien: 'Yêu cầu 1 từ khách hàng',
        }),
        chatService.createConversation(customerUser.principal, {
          nhaXeId: busCompanyAId,
          tinNhanDauTien: 'Yêu cầu 2 từ khách hàng',
        }),
      ]);

      expect(res1.conversation.cuocTroChuyenId).toBe(res2.conversation.cuocTroChuyenId);
      createdConversationIds.push(res1.conversation.cuocTroChuyenId);

      // Đúng 1 trong 2 là isNew = true
      const newResults = [res1.isNew, res2.isNew].filter(Boolean);
      expect(newResults.length).toBe(1);

      // Kiểm tra DB chỉ có đúng 1 record CuocTroChuyen giữa khách hàng và nhà xe này
      const dbCount = await prisma.cuocTroChuyen.count({
        where: {
          khachHangId: customerUser.khachHangId,
          nhaXeId: busCompanyAId,
          trangThai: { not: 'DA_DONG' },
        },
      });
      expect(dbCount).toBe(1);
    });
  });

  describe('BE-02: Atomic Auto-Claim Concurrency Prevention', () => {
    it('khi 2 nhân viên cùng gửi tin nhắn phản hồi hội thoại CHO_TIEP_NHAN, chỉ 1 nhân viên claim thành công và không bị ghi đè', async () => {
      // Tạo cuộc trò chuyện mới đang CHO_TIEP_NHAN
      // Đóng cuộc trò chuyện cũ trước
      if (createdConversationIds.length > 0) {
        await prisma.cuocTroChuyen.updateMany({
          where: { cuocTroChuyenId: { in: createdConversationIds } },
          data: { trangThai: 'DA_DONG', dongLuc: new Date() },
        });
      }

      const { conversation } = await chatService.createConversation(customerUser.principal, {
        nhaXeId: busCompanyAId,
        tinNhanDauTien: 'Cần hỗ trợ đổi vé gấp!',
      });
      createdConversationIds.push(conversation.cuocTroChuyenId);

      expect(conversation.trangThai).toBe('CHO_TIEP_NHAN');

      // 2 nhân viên cùng phản hồi đồng thời
      const [msg1, msg2] = await Promise.all([
        chatService.sendMessage(staffUserA1.principal, {
          cuocTroChuyenId: conversation.cuocTroChuyenId,
          noiDung: 'Chào bạn, mình là Staff A1 hỗ trợ bạn nhé.',
        }),
        chatService.sendMessage(staffUserA2.principal, {
          cuocTroChuyenId: conversation.cuocTroChuyenId,
          noiDung: 'Chào bạn, mình là Staff A2 hỗ trợ bạn nhé.',
        }),
      ]);

      expect(msg1).toBeDefined();
      expect(msg2).toBeDefined();

      // Kiểm tra trong DB: cuộc trò chuyện chuyển sang DANG_XU_LY
      const updatedConv = await prisma.cuocTroChuyen.findUnique({
        where: { cuocTroChuyenId: conversation.cuocTroChuyenId },
      });
      expect(updatedConv?.trangThai).toBe('DANG_XU_LY');

      // nhanVienId phải là A1 hoặc A2, không thể null
      expect([staffUserA1.nhanVienId, staffUserA2.nhanVienId]).toContain(updatedConv?.nhanVienId);

      // Chỉ có đúng 1 tin nhắn hệ thống ghi nhận tiếp nhận
      const systemMessages = await prisma.tinNhanHoTro.findMany({
        where: {
          cuocTroChuyenId: conversation.cuocTroChuyenId,
          loaiTinNhan: 'HE_THONG',
        },
      });
      expect(systemMessages.length).toBe(1);
      expect(systemMessages[0].noiDung).toContain('đã tiếp nhận cuộc trò chuyện');
    });
  });

  describe('BE-03: Idempotency & Payload Mismatch Protection', () => {
    it('gửi lặp cùng clientMessageId và cùng payload thì trả về tin nhắn cũ mà không tạo thêm record', async () => {
      const convId = createdConversationIds[createdConversationIds.length - 1];
      const clientMessageId = `idemp-key-${randomUUID()}`;

      const firstSend = await chatService.sendMessage(customerUser.principal, {
        cuocTroChuyenId: convId,
        noiDung: 'Tin nhắn gửi lần đầu',
        clientMessageId,
      });

      const secondSend = await chatService.sendMessage(customerUser.principal, {
        cuocTroChuyenId: convId,
        noiDung: 'Tin nhắn gửi lần đầu',
        clientMessageId,
      });

      expect(secondSend.tinNhanId).toBe(firstSend.tinNhanId);
      expect(secondSend.createdAt).toEqual(firstSend.createdAt);

      // Xác minh DB chỉ có đúng 1 record có clientMessageId này
      const count = await prisma.tinNhanHoTro.count({
        where: { clientMessageId },
      });
      expect(count).toBe(1);
    });

    it('gửi lặp cùng clientMessageId nhưng mang payload khác thì ném ConflictException(IDEMPOTENCY_PAYLOAD_MISMATCH)', async () => {
      const convId = createdConversationIds[createdConversationIds.length - 1];
      const clientMessageId = `idemp-key-${randomUUID()}`;

      await chatService.sendMessage(customerUser.principal, {
        cuocTroChuyenId: convId,
        noiDung: 'Nội dung nguyên bản',
        clientMessageId,
      });

      await expect(
        chatService.sendMessage(customerUser.principal, {
          cuocTroChuyenId: convId,
          noiDung: 'Nội dung bị sửa đổi trái phép',
          clientMessageId,
        }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('BE-06: Bus Company Status Check (HOAT_DONG only)', () => {
    it('từ chối tạo cuộc trò chuyện nếu nhà xe ở trạng thái TAM_NGUNG', async () => {
      await expect(
        chatService.createConversation(customerUser.principal, {
          nhaXeId: busCompanySuspendedId,
          tinNhanDauTien: 'Xin chào',
        }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('BE-01 & Tenant RBAC Isolation', () => {
    it('SUPER_ADMIN bị từ chối ở tất cả các chức năng chat CSKH', async () => {
      await expect(
        chatService.createConversation(superAdminUser.principal, {
          nhaXeId: busCompanyAId,
        }),
      ).rejects.toThrow(ForbiddenException);

      await expect(
        chatService.listConversations(superAdminUser.principal, {}),
      ).rejects.toThrow(ForbiddenException);
    });

    it('nhân viên Nhà xe B tuyệt đối không thể gửi tin nhắn vào cuộc trò chuyện của Nhà xe A', async () => {
      const convId = createdConversationIds[createdConversationIds.length - 1];

      await expect(
        chatService.sendMessage(staffUserB.principal, {
          cuocTroChuyenId: convId,
          noiDung: 'Nhân viên nhà xe B xâm nhập trái phép',
        }),
      ).rejects.toThrow(ForbiddenException);
    });
  });
});
