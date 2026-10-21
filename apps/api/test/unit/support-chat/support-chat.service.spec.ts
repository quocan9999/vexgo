import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SupportChatService } from '../../../src/support-chat/support-chat.service.js';
import type { PrismaService } from '../../../src/prisma/prisma.service.js';
import type { AuthPrincipal } from '../../../src/auth/tokens/auth-principal.js';
import { Prisma } from '../../../src/generated/prisma/client.js';

describe('SupportChatService', () => {
  let service: SupportChatService;
  let prisma: any;

  const mockCustomerPrincipal: AuthPrincipal = {
    taiKhoanId: 101,
    sessionId: 'session-customer-101',
    roles: ['KHACH_HANG'],
    permissions: [],
    nhanVienId: null,
    nhaXeId: null,
  };

  const mockSuperAdminPrincipal: AuthPrincipal = {
    taiKhoanId: 1,
    sessionId: 'session-admin-1',
    roles: ['SUPER_ADMIN'],
    permissions: ['bus-company:read', 'admin-account:read'],
    nhanVienId: null,
    nhaXeId: null,
  };

  const mockStaffWithoutChatPermission: AuthPrincipal = {
    taiKhoanId: 201,
    sessionId: 'session-staff-201',
    roles: ['NHAN_VIEN_DIEU_HANH'],
    permissions: ['trip:read'],
    nhanVienId: 11,
    nhaXeId: 5,
  };

  const mockStaffWithChatManage: AuthPrincipal = {
    taiKhoanId: 202,
    sessionId: 'session-staff-202',
    roles: ['NHAN_VIEN_CSKH'],
    permissions: ['chat:read', 'chat:manage', 'customer:read'],
    nhanVienId: 12,
    nhaXeId: 5,
  };

  const mockStaffCompanyB: AuthPrincipal = {
    taiKhoanId: 301,
    sessionId: 'session-staff-301',
    roles: ['NHAN_VIEN_CSKH'],
    permissions: ['chat:read', 'chat:manage'],
    nhanVienId: 21,
    nhaXeId: 9, // Khác nhà xe 5
  };

  beforeEach(() => {
    prisma = {
      khachHang: {
        findUnique: vi.fn(),
        create: vi.fn(),
      },
      taiKhoan: {
        findUnique: vi.fn(),
      },
      nhaXe: {
        findUnique: vi.fn(),
      },
      cuocTroChuyen: {
        findFirst: vi.fn(),
        findUnique: vi.fn(),
        findUniqueOrThrow: vi.fn(),
        findMany: vi.fn(),
        count: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        updateMany: vi.fn(),
      },
      tinNhanHoTro: {
        findUnique: vi.fn(),
        findMany: vi.fn(),
        count: vi.fn(),
        create: vi.fn(),
        updateMany: vi.fn(),
      },
      $queryRaw: vi.fn().mockResolvedValue([{ khachHangId: 50 }]),
      $executeRaw: vi.fn().mockResolvedValue(1),
      $transaction: vi.fn(async (cb: any) => cb(prisma)),
    };

    service = new SupportChatService(prisma as unknown as PrismaService);
  });

  describe('Đảm bảo thông tin khách hàng (ensureKhachHang)', () => {
    it('trả về bản ghi khách hàng nếu đã tồn tại', async () => {
      const existing = {
        khachHangId: 50,
        taiKhoanId: 101,
        maKhachHang: 'KH101',
      };
      prisma.khachHang.findUnique.mockResolvedValue(existing);

      const result = await service.ensureKhachHang(101);

      expect(result).toEqual(existing);
      expect(prisma.khachHang.create).not.toHaveBeenCalled();
    });

    it('từ chối nếu tài khoản là nhân viên', async () => {
      prisma.khachHang.findUnique.mockResolvedValue(null);
      prisma.taiKhoan.findUnique.mockResolvedValue({
        taiKhoanId: 201,
        nhanVien: { nhanVienId: 10 },
        taiKhoanVaiTros: [{ vaiTro: { tenVaiTro: 'NHAN_VIEN' } }],
      });

      await expect(service.ensureKhachHang(201)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('xử lý race condition P2002 khi nhiều request khởi tạo cùng tài khoản khách hàng (BE-R04)', async () => {
      prisma.khachHang.findUnique
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({
          khachHangId: 77,
          taiKhoanId: 101,
          maKhachHang: 'KH123',
        });

      prisma.taiKhoan.findUnique.mockResolvedValue({
        taiKhoanId: 101,
        nhanVien: null,
        taiKhoanVaiTros: [{ vaiTro: { tenVaiTro: 'KHACH_HANG' } }],
      });

      const p2002Error = new Prisma.PrismaClientKnownRequestError(
        'Unique constraint failed on the fields: (`taiKhoanId`)',
        {
          code: 'P2002',
          clientVersion: '5.x',
        },
      );
      prisma.khachHang.create.mockRejectedValue(p2002Error);

      const result = await service.ensureKhachHang(101);

      expect(result).toEqual({
        khachHangId: 77,
        taiKhoanId: 101,
        maKhachHang: 'KH123',
      });
      expect(prisma.khachHang.findUnique).toHaveBeenCalledTimes(2);
    });
  });

  describe('Phân quyền Super Admin (LEAD RULE)', () => {
    it('SUPER_ADMIN bị chặn khi cố gắng tạo cuộc trò chuyện', async () => {
      await expect(
        service.createConversation(mockSuperAdminPrincipal, { nhaXeId: 5 }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('SUPER_ADMIN bị chặn khi cố gắng xem danh sách cuộc trò chuyện', async () => {
      await expect(
        service.listConversations(mockSuperAdminPrincipal, {}),
      ).rejects.toThrow(ForbiddenException);
    });

    it('SUPER_ADMIN bị chặn khi cố gắng gửi tin nhắn', async () => {
      await expect(
        service.sendMessage(mockSuperAdminPrincipal, {
          cuocTroChuyenId: 1,
          noiDung: 'Test',
        }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('SUPER_ADMIN bị chặn khi cố gắng tiếp nhận hoặc đóng cuộc trò chuyện', async () => {
      await expect(
        service.claimConversation(mockSuperAdminPrincipal, 1),
      ).rejects.toThrow(ForbiddenException);

      await expect(
        service.closeConversation(mockSuperAdminPrincipal, 1),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('Tạo cuộc trò chuyện (createConversation)', () => {
    it('nhân viên nhà xe không được phép tạo cuộc trò chuyện (CUSTOMER_ONLY_ACTION)', async () => {
      await expect(
        service.createConversation(mockStaffWithChatManage, { nhaXeId: 5 }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('ném lỗi NotFoundException nếu nhà xe không tồn tại hoặc đã ngừng hoạt động', async () => {
      prisma.nhaXe.findUnique.mockResolvedValue(null);

      await expect(
        service.createConversation(mockCustomerPrincipal, { nhaXeId: 999 }),
      ).rejects.toThrow(NotFoundException);
    });

    it('từ chối tạo cuộc trò chuyện nếu nhà xe ở trạng thái TAM_NGUNG (BE-06)', async () => {
      prisma.nhaXe.findUnique.mockResolvedValue({
        nhaXeId: 5,
        tenNhaXe: 'Nhà Xe Tạm Ngừng',
        trangThai: 'TAM_NGUNG',
      });

      await expect(
        service.createConversation(mockCustomerPrincipal, { nhaXeId: 5 }),
      ).rejects.toThrow(NotFoundException);
    });

    it('trả về cuộc trò chuyện đang mở nếu khách hàng đã có phiên chat chưa kết thúc với nhà xe này', async () => {
      prisma.nhaXe.findUnique.mockResolvedValue({
        nhaXeId: 5,
        tenNhaXe: 'Nhà Xe Phương Trang',
        trangThai: 'HOAT_DONG',
      });
      prisma.khachHang.findUnique.mockResolvedValue({
        khachHangId: 50,
        taiKhoanId: 101,
      });

      const existingConv = {
        cuocTroChuyenId: 10,
        maCuocTroChuyen: 'CHAT-123456',
        trangThai: 'CHO_TIEP_NHAN',
        khachHangId: 50,
        nhaXeId: 5,
      };
      prisma.cuocTroChuyen.findFirst.mockResolvedValue(existingConv);

      const result = await service.createConversation(mockCustomerPrincipal, {
        nhaXeId: 5,
      });
      expect(result).toEqual({
        conversation: existingConv,
        isNew: false,
        firstMessage: null,
      });
      expect(prisma.cuocTroChuyen.create).not.toHaveBeenCalled();
    });

    it('khi mở lại cuộc trò chuyện có sẵn và truyền tinNhanDauTien không có clientMessageId, tạo tin nhắn mới và cập nhật updatedAt (BE-R03)', async () => {
      prisma.nhaXe.findUnique.mockResolvedValue({
        nhaXeId: 5,
        tenNhaXe: 'Nhà Xe Phương Trang',
        trangThai: 'HOAT_DONG',
      });
      prisma.khachHang.findUnique.mockResolvedValue({
        khachHangId: 50,
        taiKhoanId: 101,
      });

      const existingConv = {
        cuocTroChuyenId: 10,
        maCuocTroChuyen: 'CHAT-123456',
        trangThai: 'CHO_TIEP_NHAN',
        khachHangId: 50,
        nhaXeId: 5,
        updatedAt: new Date('2026-01-01T00:00:00Z'),
      };
      prisma.cuocTroChuyen.findFirst.mockResolvedValue(existingConv);

      const createdFirstMsg = {
        tinNhanId: 888,
        cuocTroChuyenId: 10,
        taiKhoanGuiId: 101,
        loaiNguoiGui: 'KHACH_HANG',
        loaiTinNhan: 'VAN_BAN',
        noiDung: 'Tôi cần hỗ trợ thêm',
        clientMessageId: null,
        trangThai: 'DA_GUI',
      };
      prisma.tinNhanHoTro.create.mockResolvedValue(createdFirstMsg);
      const updatedConv = {
        ...existingConv,
        updatedAt: new Date('2026-10-16T00:00:00Z'),
      };
      prisma.cuocTroChuyen.update.mockResolvedValue(updatedConv);

      const result = await service.createConversation(mockCustomerPrincipal, {
        nhaXeId: 5,
        tinNhanDauTien: 'Tôi cần hỗ trợ thêm',
      });

      expect(prisma.tinNhanHoTro.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            cuocTroChuyenId: 10,
            noiDung: 'Tôi cần hỗ trợ thêm',
            clientMessageId: null,
            loaiNguoiGui: 'KHACH_HANG',
          }),
        }),
      );
      expect(prisma.cuocTroChuyen.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { cuocTroChuyenId: 10 },
          data: expect.objectContaining({
            updatedAt: expect.any(Date),
          }),
        }),
      );
      expect(result).toEqual({
        conversation: updatedConv,
        isNew: false,
        firstMessage: createdFirstMsg,
      });
    });

    it('tạo cuộc trò chuyện mới ở trạng thái CHO_TIEP_NHAN nếu chưa có cuộc trò chuyện nào', async () => {
      prisma.nhaXe.findUnique.mockResolvedValue({
        nhaXeId: 5,
        tenNhaXe: 'Nhà Xe Phương Trang',
        trangThai: 'HOAT_DONG',
      });
      prisma.khachHang.findUnique.mockResolvedValue({
        khachHangId: 50,
        taiKhoanId: 101,
      });
      prisma.cuocTroChuyen.findFirst.mockResolvedValue(null);

      const createdConv = {
        cuocTroChuyenId: 15,
        maCuocTroChuyen: 'CHAT-NEW',
        trangThai: 'CHO_TIEP_NHAN',
        khachHangId: 50,
        nhaXeId: 5,
      };
      prisma.cuocTroChuyen.create.mockResolvedValue(createdConv);
      const createdFirstMsg = {
        tinNhanId: 101,
        cuocTroChuyenId: 15,
        noiDung: 'Xin chào nhà xe',
        loaiNguoiGui: 'KHACH_HANG',
        loaiTinNhan: 'VAN_BAN',
      };
      prisma.tinNhanHoTro.create.mockResolvedValue(createdFirstMsg);

      const result = await service.createConversation(mockCustomerPrincipal, {
        nhaXeId: 5,
        tieuDe: 'Hỏi giá vé',
        tinNhanDauTien: 'Xin chào nhà xe',
      });

      expect(prisma.cuocTroChuyen.create).toHaveBeenCalled();
      expect(prisma.tinNhanHoTro.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            cuocTroChuyenId: 15,
            noiDung: 'Xin chào nhà xe',
            loaiNguoiGui: 'KHACH_HANG',
          }),
        }),
      );
      expect(result).toEqual({
        conversation: createdConv,
        isNew: true,
        firstMessage: createdFirstMsg,
      });
    });
  });

  describe('Xem danh sách cuộc trò chuyện (listConversations)', () => {
    it('nhân viên nhà xe không có quyền chat:read bị từ chối 403', async () => {
      await expect(
        service.listConversations(mockStaffWithoutChatPermission, {}),
      ).rejects.toThrow(ForbiddenException);
    });

    it('nhân viên nhà xe chỉ thấy các cuộc trò chuyện thuộc nhaXeId của mình', async () => {
      prisma.cuocTroChuyen.count.mockResolvedValue(1);
      prisma.cuocTroChuyen.findMany.mockResolvedValue([
        {
          cuocTroChuyenId: 1,
          maCuocTroChuyen: 'CHAT-1',
          tieuDe: 'Test',
          trangThai: 'DANG_XU_LY',
          kenhHoTro: 'WEB',
          cheDoChat: 'NGUOI_THAT',
          khachHangId: 50,
          nhanVienId: 12,
          nhaXeId: 5,
          dongLuc: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          nhaXe: {
            nhaXeId: 5,
            tenNhaXe: 'Phương Trang',
            logo: null,
            hotline: '19001000',
          },
          khachHang: {
            khachHangId: 50,
            maKhachHang: 'KH01',
            taiKhoan: { hoTen: 'A', soDienThoai: '0901', avatarUrl: null },
          },
          nhanVien: null,
          tinNhans: [],
        },
      ]);

      const res = await service.listConversations(mockStaffWithChatManage, {
        page: 1,
        pageSize: 10,
      });

      expect(prisma.cuocTroChuyen.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ nhaXeId: 5 }),
        }),
      );
      expect(res.data).toHaveLength(1);
      expect(res.meta.totalItems).toBe(1);
    });
  });

  describe('Gửi tin nhắn & Idempotency (sendMessage)', () => {
    it('từ chối gửi tin nhắn nếu cuộc trò chuyện đã kết thúc (DA_DONG)', async () => {
      prisma.cuocTroChuyen.findUnique.mockResolvedValue({
        cuocTroChuyenId: 1,
        trangThai: 'DA_DONG',
        nhaXeId: 5,
        khachHangId: 50,
      });

      await expect(
        service.sendMessage(mockStaffWithChatManage, {
          cuocTroChuyenId: 1,
          noiDung: 'Chào bạn',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('nhân viên Nhà xe B không được gửi tin nhắn vào cuộc trò chuyện của Nhà xe A', async () => {
      prisma.cuocTroChuyen.findUnique.mockResolvedValue({
        cuocTroChuyenId: 1,
        trangThai: 'DANG_XU_LY',
        nhaXeId: 5, // Nhà xe 5
        khachHangId: 50,
      });

      await expect(
        service.sendMessage(mockStaffCompanyB, {
          cuocTroChuyenId: 1,
          noiDung: 'Chào bạn',
        }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('idempotency: trả về tin nhắn đã có nếu clientMessageId bị gửi lặp', async () => {
      prisma.cuocTroChuyen.findUnique.mockResolvedValue({
        cuocTroChuyenId: 1,
        trangThai: 'DANG_XU_LY',
        nhaXeId: 5,
        khachHangId: 50,
      });

      const existingMsg = {
        tinNhanId: 99,
        cuocTroChuyenId: 1,
        taiKhoanGuiId: mockStaffWithChatManage.taiKhoanId,
        clientMessageId: 'idempotent-uuid-123',
        noiDung: 'Tin nhắn đã tạo trước đó',
        loaiTinNhan: 'VAN_BAN',
        tepDinhKemUrl: null,
      };
      prisma.tinNhanHoTro.findUnique.mockResolvedValue(existingMsg);

      const result = await service.sendMessage(mockStaffWithChatManage, {
        cuocTroChuyenId: 1,
        noiDung: 'Tin nhắn đã tạo trước đó',
        clientMessageId: 'idempotent-uuid-123',
      });

      expect(result).toEqual(existingMsg);
      expect(prisma.tinNhanHoTro.create).not.toHaveBeenCalled();
    });

    it('idempotency: ném ConflictException nếu clientMessageId đã được dùng cho hội thoại khác hoặc người gửi khác', async () => {
      prisma.cuocTroChuyen.findUnique.mockResolvedValue({
        cuocTroChuyenId: 1,
        trangThai: 'DANG_XU_LY',
        nhaXeId: 5,
        khachHangId: 50,
      });

      const mismatchMsg = {
        tinNhanId: 99,
        cuocTroChuyenId: 999, // Khác cuộc trò chuyện!
        taiKhoanGuiId: mockStaffWithChatManage.taiKhoanId,
        clientMessageId: 'idempotent-uuid-123',
        noiDung: 'Tin nhắn cũ',
        loaiTinNhan: 'VAN_BAN',
      };
      prisma.tinNhanHoTro.findUnique.mockResolvedValue(mismatchMsg);

      await expect(
        service.sendMessage(mockStaffWithChatManage, {
          cuocTroChuyenId: 1,
          noiDung: 'Tin nhắn mới',
          clientMessageId: 'idempotent-uuid-123',
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('idempotency: ném ConflictException (IDEMPOTENCY_PAYLOAD_MISMATCH) nếu clientMessageId trùng nhưng nội dung khác', async () => {
      prisma.cuocTroChuyen.findUnique.mockResolvedValue({
        cuocTroChuyenId: 1,
        trangThai: 'DANG_XU_LY',
        nhaXeId: 5,
        khachHangId: 50,
      });

      const existingMsg = {
        tinNhanId: 99,
        cuocTroChuyenId: 1,
        taiKhoanGuiId: mockStaffWithChatManage.taiKhoanId,
        clientMessageId: 'idempotent-uuid-123',
        noiDung: 'Nội dung ban đầu',
        loaiTinNhan: 'VAN_BAN',
      };
      prisma.tinNhanHoTro.findUnique.mockResolvedValue(existingMsg);

      await expect(
        service.sendMessage(mockStaffWithChatManage, {
          cuocTroChuyenId: 1,
          noiDung: 'Nội dung bị sửa đổi',
          clientMessageId: 'idempotent-uuid-123',
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('gửi tin nhắn thành công và tự động chuyển sang DANG_XU_LY nếu nhân viên phản hồi cuộc trò chuyện CHO_TIEP_NHAN', async () => {
      prisma.cuocTroChuyen.findUnique.mockResolvedValue({
        cuocTroChuyenId: 1,
        trangThai: 'CHO_TIEP_NHAN',
        nhaXeId: 5,
        khachHangId: 50,
      });
      prisma.tinNhanHoTro.findUnique.mockResolvedValue(null);
      prisma.cuocTroChuyen.updateMany.mockResolvedValue({ count: 1 });

      const newMsg = {
        tinNhanId: 100,
        noiDung: 'Dạ em chào anh chị',
        loaiNguoiGui: 'NHAN_VIEN',
      };
      prisma.tinNhanHoTro.create.mockResolvedValue(newMsg);

      const result = await service.sendMessage(mockStaffWithChatManage, {
        cuocTroChuyenId: 1,
        noiDung: 'Dạ em chào anh chị',
      });

      expect(result).toEqual(newMsg);
      expect(prisma.cuocTroChuyen.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            cuocTroChuyenId: 1,
            trangThai: 'CHO_TIEP_NHAN',
            nhanVienId: null,
          }),
          data: expect.objectContaining({
            trangThai: 'DANG_XU_LY',
            nhanVienId: 12,
          }),
        }),
      );
    });

    it('BE-02: nếu cuộc trò chuyện đã có nhân viên khác tiếp nhận trước đó, không ghi đè nhanVienId', async () => {
      prisma.cuocTroChuyen.findUnique.mockResolvedValue({
        cuocTroChuyenId: 1,
        trangThai: 'CHO_TIEP_NHAN',
        nhaXeId: 5,
        khachHangId: 50,
      });
      prisma.tinNhanHoTro.findUnique.mockResolvedValue(null);
      // updateMany trả về count 0 vì người khác đã nhận trước
      prisma.cuocTroChuyen.updateMany.mockResolvedValue({ count: 0 });

      const newMsg = {
        tinNhanId: 101,
        noiDung: 'Em cũng hỗ trợ ạ',
        loaiNguoiGui: 'NHAN_VIEN',
      };
      prisma.tinNhanHoTro.create.mockResolvedValue(newMsg);

      const result = await service.sendMessage(mockStaffWithChatManage, {
        cuocTroChuyenId: 1,
        noiDung: 'Em cũng hỗ trợ ạ',
      });

      expect(result).toEqual(newMsg);
      // Không tạo system message vì count === 0
      expect(prisma.tinNhanHoTro.create).toHaveBeenCalledTimes(1);
    });
  });

  describe('Tiếp nhận cuộc trò chuyện (claimConversation)', () => {
    it('nhân viên nhà xe khác không thể tiếp nhận', async () => {
      prisma.cuocTroChuyen.updateMany.mockResolvedValue({ count: 0 });
      prisma.cuocTroChuyen.findUnique.mockResolvedValue({
        cuocTroChuyenId: 1,
        trangThai: 'CHO_TIEP_NHAN',
        nhaXeId: 5,
      });

      await expect(
        service.claimConversation(mockStaffCompanyB, 1),
      ).rejects.toThrow(ForbiddenException);
    });

    it('tiếp nhận thành công chuyển trạng thái sang DANG_XU_LY và tạo tin nhắn hệ thống', async () => {
      prisma.cuocTroChuyen.updateMany.mockResolvedValue({ count: 1 });

      const updated = {
        cuocTroChuyenId: 1,
        trangThai: 'DANG_XU_LY',
        nhanVienId: 12,
      };
      prisma.cuocTroChuyen.findUniqueOrThrow.mockResolvedValue(updated);

      const result = await service.claimConversation(
        mockStaffWithChatManage,
        1,
      );
      expect(result).toEqual(updated);
      expect(prisma.tinNhanHoTro.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            loaiNguoiGui: 'HE_THONG',
            noiDung: 'Nhân viên hỗ trợ đã tiếp nhận cuộc trò chuyện.',
          }),
        }),
      );
    });

    it('ném ConflictException nếu cuộc trò chuyện đã được nhân viên khác tiếp nhận', async () => {
      // updateMany trả về 0 vì không còn ở trạng thái CHO_TIEP_NHAN / nhanVienId !== null
      prisma.cuocTroChuyen.updateMany.mockResolvedValue({ count: 0 });
      prisma.cuocTroChuyen.findUnique.mockResolvedValue({
        cuocTroChuyenId: 1,
        trangThai: 'DANG_XU_LY',
        nhanVienId: 99,
        nhaXeId: 5,
      });

      await expect(
        service.claimConversation(mockStaffWithChatManage, 1),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('Đóng cuộc trò chuyện (closeConversation)', () => {
    it('chuyển trạng thái sang DA_DONG và ghi nhận tin nhắn hệ thống', async () => {
      prisma.cuocTroChuyen.findUnique.mockResolvedValue({
        cuocTroChuyenId: 1,
        trangThai: 'DANG_XU_LY',
        nhaXeId: 5,
      });

      const closed = {
        cuocTroChuyenId: 1,
        trangThai: 'DA_DONG',
      };
      prisma.cuocTroChuyen.updateMany.mockResolvedValue({ count: 1 });
      prisma.cuocTroChuyen.findUniqueOrThrow.mockResolvedValue(closed);

      const result = await service.closeConversation(
        mockStaffWithChatManage,
        1,
        {
          lyDo: 'Khách đã giải quyết xong vấn đề',
        },
      );

      expect(result).toEqual(closed);
      expect(prisma.tinNhanHoTro.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            loaiNguoiGui: 'HE_THONG',
            noiDung:
              'Cuộc trò chuyện đã kết thúc: Khách đã giải quyết xong vấn đề',
          }),
        }),
      );
    });
  });

  it('does not append another close message when another request already closed the conversation', async () => {
    prisma.cuocTroChuyen.findUnique.mockResolvedValue({
      cuocTroChuyenId: 1,
      trangThai: 'DANG_XU_LY',
      nhaXeId: 5,
    });
    prisma.cuocTroChuyen.updateMany.mockResolvedValue({ count: 0 });
    prisma.cuocTroChuyen.findUniqueOrThrow.mockResolvedValue({
      cuocTroChuyenId: 1,
      trangThai: 'DA_DONG',
    });
    await expect(
      service.closeConversation(mockStaffWithChatManage, 1),
    ).resolves.toMatchObject({ trangThai: 'DA_DONG' });
    expect(prisma.tinNhanHoTro.create).not.toHaveBeenCalled();
  });

  describe('Đánh dấu tin nhắn đã đọc (markMessagesAsRead)', () => {
    it('cập nhật DA_DOC cho tin nhắn của đối phương', async () => {
      prisma.cuocTroChuyen.findUnique.mockResolvedValue({
        cuocTroChuyenId: 1,
        nhaXeId: 5,
        khachHangId: 50,
      });
      prisma.tinNhanHoTro.updateMany.mockResolvedValue({ count: 3 });

      const result = await service.markMessagesAsRead(
        mockStaffWithChatManage,
        1,
      );
      expect(result).toEqual({ updatedCount: 3 });
      expect(prisma.tinNhanHoTro.updateMany).toHaveBeenCalledWith({
        where: {
          cuocTroChuyenId: 1,
          taiKhoanGuiId: { not: 202 },
          trangThai: 'DA_GUI',
        },
        data: expect.objectContaining({
          trangThai: 'DA_DOC',
        }),
      });
    });
  });

  describe('authoritative detail unread count after access validation', () => {
    const conversation = { cuocTroChuyenId: 77, nhaXeId: 5, khachHangId: 50 };
    it.each([
      ['staff', mockStaffWithChatManage, mockCustomerPrincipal.taiKhoanId],
      ['customer', mockCustomerPrincipal, mockStaffWithChatManage.taiKhoanId],
    ] as const)(
      'counts the unread messages of other senders for the authorized %s',
      async (_label, principal, otherSender) => {
        prisma.cuocTroChuyen.findUnique.mockResolvedValue(conversation);
        prisma.khachHang.findUnique.mockResolvedValue({
          khachHangId: 50,
          taiKhoanId: 101,
        });
        const rows = [
          ...Array.from({ length: 15 }, () => ({
            cuocTroChuyenId: 77,
            taiKhoanGuiId: otherSender,
            trangThai: 'DA_GUI',
          })),
          {
            cuocTroChuyenId: 77,
            taiKhoanGuiId: principal.taiKhoanId,
            trangThai: 'DA_GUI',
          },
          {
            cuocTroChuyenId: 77,
            taiKhoanGuiId: otherSender,
            trangThai: 'DA_DOC',
          },
          {
            cuocTroChuyenId: 78,
            taiKhoanGuiId: otherSender,
            trangThai: 'DA_GUI',
          },
        ];
        prisma.tinNhanHoTro.count.mockImplementation(
          async ({
            where,
          }: {
            where: {
              cuocTroChuyenId: number;
              taiKhoanGuiId: { not: number };
              trangThai: string;
            };
          }) =>
            rows.filter(
              (row) =>
                row.cuocTroChuyenId === where.cuocTroChuyenId &&
                row.taiKhoanGuiId !== where.taiKhoanGuiId.not &&
                row.trangThai === where.trangThai,
            ).length,
        );
        const result = await service.getConversationById(principal, 77);
        expect(result.soTinChuaDoc).toBe(15);
        expect(prisma.tinNhanHoTro.count).toHaveBeenCalledExactlyOnceWith({
          where: {
            cuocTroChuyenId: 77,
            taiKhoanGuiId: { not: principal.taiKhoanId },
            trangThai: 'DA_GUI',
          },
        });
      },
    );

    it('does not count own outgoing or already read messages as unread', async () => {
      prisma.cuocTroChuyen.findUnique.mockResolvedValue(conversation);
      const rows = [
        { taiKhoanGuiId: 202, trangThai: 'DA_GUI' },
        { taiKhoanGuiId: 101, trangThai: 'DA_DOC' },
      ];
      prisma.tinNhanHoTro.count.mockImplementation(
        async ({
          where,
        }: {
          where: { taiKhoanGuiId: { not: number }; trangThai: string };
        }) =>
          rows.filter(
            (row) =>
              row.taiKhoanGuiId !== where.taiKhoanGuiId.not &&
              row.trangThai === where.trangThai,
          ).length,
      );
      expect(
        (await service.getConversationById(mockStaffWithChatManage, 77))
          .soTinChuaDoc,
      ).toBe(0);
    });

    it.each([
      ['different tenant', mockStaffCompanyB],
      ['staff without chat permission', mockStaffWithoutChatPermission],
      ['different customer', mockCustomerPrincipal],
    ] as const)(
      'does not query unread message counts for a %s denied access',
      async (_label, principal) => {
        prisma.cuocTroChuyen.findUnique.mockResolvedValue(conversation);
        prisma.khachHang.findUnique.mockResolvedValue({
          khachHangId: 999,
          taiKhoanId: 101,
        });
        await expect(
          service.getConversationById(principal, 77),
        ).rejects.toThrow(ForbiddenException);
        expect(prisma.tinNhanHoTro.count).not.toHaveBeenCalled();
      },
    );

    it('does not count messages for a missing conversation', async () => {
      prisma.cuocTroChuyen.findUnique.mockResolvedValue(null);
      await expect(
        service.getConversationById(mockStaffWithChatManage, 77),
      ).rejects.toThrow(NotFoundException);
      expect(prisma.tinNhanHoTro.count).not.toHaveBeenCalled();
    });
  });
});
