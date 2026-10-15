import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { AuthPrincipal } from '../auth/tokens/auth-principal.js';
import {
  CloseConversationDto,
  CreateConversationDto,
  GetMessagesQueryDto,
  ListConversationsQueryDto,
  MarkReadDto,
  SendMessageDto,
  TrangThaiCuocTroChuyen,
} from './dto/index.js';

export interface ConversationSummaryResponse {
  cuocTroChuyenId: number;
  maCuocTroChuyen: string;
  tieuDe: string | null;
  trangThai: string;
  kenhHoTro: string;
  cheDoChat: string;
  khachHangId: number;
  nhanVienId: number | null;
  nhaXeId: number;
  dongLuc: Date | null;
  createdAt: Date;
  updatedAt: Date;
  nhaXe: {
    nhaXeId: number;
    tenNhaXe: string;
    logo: string | null;
    hotline: string;
  };
  khachHang: {
    khachHangId: number;
    maKhachHang: string;
    taiKhoan: {
      hoTen: string;
      soDienThoai: string;
      avatarUrl: string | null;
    };
  };
  nhanVien?: {
    nhanVienId: number;
    maNhanVien: string;
    taiKhoan: {
      hoTen: string;
      avatarUrl: string | null;
    };
  } | null;
  tinNhanCuoi?: {
    tinNhanId: number;
    taiKhoanGuiId: number;
    loaiNguoiGui: string;
    loaiTinNhan: string;
    noiDung: string;
    trangThai: string;
    createdAt: Date;
  } | null;
  soTinChuaDoc?: number;
}

@Injectable()
export class SupportChatService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Đảm bảo tài khoản khách hàng có bản ghi KhachHang tương ứng
   */
  async ensureKhachHang(taiKhoanId: number) {
    const existing = await this.prisma.khachHang.findUnique({
      where: { taiKhoanId },
    });
    if (existing) {
      return existing;
    }

    const taiKhoan = await this.prisma.taiKhoan.findUnique({
      where: { taiKhoanId },
      include: {
        taiKhoanVaiTros: {
          include: { vaiTro: true },
        },
        nhanVien: true,
      },
    });

    if (!taiKhoan || taiKhoan.nhanVien !== null) {
      throw new ForbiddenException({
        error: 'CUSTOMER_ROLE_REQUIRED',
        message: 'Tài khoản nhân viên không được phép tạo bản ghi khách hàng.',
      });
    }

    const hasCustomerRole = taiKhoan.taiKhoanVaiTros.some(
      (r) => r.vaiTro.tenVaiTro === 'KHACH_HANG',
    );
    if (!hasCustomerRole) {
      throw new ForbiddenException({
        error: 'CUSTOMER_ROLE_REQUIRED',
        message: 'Tài khoản không có vai trò khách hàng.',
      });
    }

    return this.prisma.khachHang.create({
      data: {
        taiKhoanId,
        maKhachHang: `KH${Date.now()}`,
      },
    });
  }

  /**
   * Super Admin không được phép truy cập bất kỳ tính năng chat CSKH nào
   */
  assertNotSuperAdmin(principal: AuthPrincipal): void {
    if (
      principal.roles.includes('SUPER_ADMIN') ||
      (principal.nhaXeId === null && !principal.roles.includes('KHACH_HANG'))
    ) {
      throw new ForbiddenException({
        error: 'SUPER_ADMIN_NOT_ALLOWED',
        message:
          'Tài khoản Quản trị hệ thống không được phép truy cập chức năng Chăm sóc khách hàng.',
      });
    }
  }

  /**
   * Tạo cuộc trò chuyện mới hoặc trả về cuộc trò chuyện đang mở (chỉ dành riêng cho Khách hàng)
   */
  async createConversation(
    principal: AuthPrincipal,
    dto: CreateConversationDto,
  ) {
    this.assertNotSuperAdmin(principal);

    // Chặn nhân viên nhà xe hoặc mạo danh khách hàng
    if (
      !principal.roles.includes('KHACH_HANG') ||
      principal.nhanVienId !== null ||
      principal.nhaXeId !== null
    ) {
      throw new ForbiddenException({
        error: 'CUSTOMER_ONLY_ACTION',
        message: 'Chỉ tài khoản khách hàng mới có quyền mở cuộc trò chuyện hỗ trợ.',
      });
    }

    // Kiểm tra nhà xe hợp lệ
    const nhaXe = await this.prisma.nhaXe.findUnique({
      where: { nhaXeId: dto.nhaXeId },
      select: { nhaXeId: true, tenNhaXe: true, trangThai: true, logo: true, hotline: true },
    });

    if (!nhaXe || nhaXe.trangThai === 'NGUNG_HOAT_DONG') {
      throw new NotFoundException({
        error: 'BUS_COMPANY_NOT_FOUND',
        message: 'Không tìm thấy nhà xe hoặc nhà xe đã ngừng hoạt động.',
      });
    }

    const khachHang = await this.ensureKhachHang(principal.taiKhoanId);

    // Sử dụng transaction với row lock FOR UPDATE để ngăn ngừa 2 request đồng thời tạo 2 active conversations
    return this.prisma.$transaction(async (tx) => {
      // Row lock trên bảng KhachHang
      await tx.$executeRaw`SELECT khachHangId FROM KhachHang WHERE khachHangId = ${khachHang.khachHangId} FOR UPDATE`;

      // Kiểm tra cuộc trò chuyện đang hoạt động giữa khách hàng và nhà xe này
      const existingConversation = await tx.cuocTroChuyen.findFirst({
        where: {
          khachHangId: khachHang.khachHangId,
          nhaXeId: dto.nhaXeId,
          trangThai: { in: [TrangThaiCuocTroChuyen.CHO_TIEP_NHAN, TrangThaiCuocTroChuyen.DANG_XU_LY] },
        },
        include: {
          nhaXe: {
            select: { nhaXeId: true, tenNhaXe: true, logo: true, hotline: true },
          },
          khachHang: {
            select: {
              khachHangId: true,
              maKhachHang: true,
              taiKhoan: { select: { hoTen: true, soDienThoai: true, avatarUrl: true } },
            },
          },
          nhanVien: {
            select: {
              nhanVienId: true,
              maNhanVien: true,
              taiKhoan: { select: { hoTen: true, avatarUrl: true } },
            },
          },
        },
      });

      if (existingConversation) {
        if (dto.tinNhanDauTien) {
          await tx.tinNhanHoTro.create({
            data: {
              cuocTroChuyenId: existingConversation.cuocTroChuyenId,
              taiKhoanGuiId: principal.taiKhoanId,
              loaiNguoiGui: 'KHACH_HANG',
              loaiTinNhan: 'VAN_BAN',
              noiDung: dto.tinNhanDauTien,
              clientMessageId: dto.clientMessageId,
              trangThai: 'DA_GUI',
            },
          });
        }
        return existingConversation;
      }

      const maCuocTroChuyen = `CHAT-${Date.now()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;

      const conv = await tx.cuocTroChuyen.create({
        data: {
          maCuocTroChuyen,
          tieuDe: dto.tieuDe || `Hỗ trợ khách hàng - ${nhaXe.tenNhaXe}`,
          trangThai: TrangThaiCuocTroChuyen.CHO_TIEP_NHAN,
          kenhHoTro: 'WEB',
          cheDoChat: 'NGUOI_THAT',
          khachHangId: khachHang.khachHangId,
          nhaXeId: dto.nhaXeId,
        },
        include: {
          nhaXe: {
            select: { nhaXeId: true, tenNhaXe: true, logo: true, hotline: true },
          },
          khachHang: {
            select: {
              khachHangId: true,
              maKhachHang: true,
              taiKhoan: { select: { hoTen: true, soDienThoai: true, avatarUrl: true } },
            },
          },
        },
      });

      if (dto.tinNhanDauTien) {
        await tx.tinNhanHoTro.create({
          data: {
            cuocTroChuyenId: conv.cuocTroChuyenId,
            taiKhoanGuiId: principal.taiKhoanId,
            loaiNguoiGui: 'KHACH_HANG',
            loaiTinNhan: 'VAN_BAN',
            noiDung: dto.tinNhanDauTien,
            clientMessageId: dto.clientMessageId,
            trangThai: 'DA_GUI',
          },
        });
      }

      return conv;
    });
  }

  /**
   * Lấy danh sách cuộc trò chuyện phân trang theo phạm vi quyền
   */
  async listConversations(
    principal: AuthPrincipal,
    query: Partial<ListConversationsQueryDto> = {},
  ) {
    this.assertNotSuperAdmin(principal);

    const where: Prisma.CuocTroChuyenWhereInput = {};

    const isTenantUser = principal.nhaXeId !== null && principal.nhanVienId !== null;

    if (isTenantUser) {
      const hasRead =
        principal.permissions.includes('chat:read') ||
        principal.permissions.includes('chat:manage');
      if (!hasRead) {
        throw new ForbiddenException({
          error: 'CHAT_PERMISSION_DENIED',
          message: 'Tài khoản không có quyền xem cuộc trò chuyện hỗ trợ.',
        });
      }
      where.nhaXeId = principal.nhaXeId!;
    } else {
      // Khách hàng
      const khachHang = await this.ensureKhachHang(principal.taiKhoanId);
      where.khachHangId = khachHang.khachHangId;
      if (query.nhaXeId) {
        where.nhaXeId = query.nhaXeId;
      }
    }

    if (query.trangThai) {
      where.trangThai = query.trangThai;
    }

    const page = Math.max(1, query.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, query.pageSize ?? 20));
    const skip = (page - 1) * pageSize;

    const [totalItems, conversations] = await Promise.all([
      this.prisma.cuocTroChuyen.count({ where }),
      this.prisma.cuocTroChuyen.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { updatedAt: 'desc' },
        include: {
          nhaXe: {
            select: { nhaXeId: true, tenNhaXe: true, logo: true, hotline: true },
          },
          khachHang: {
            select: {
              khachHangId: true,
              maKhachHang: true,
              taiKhoan: { select: { hoTen: true, soDienThoai: true, avatarUrl: true } },
            },
          },
          nhanVien: {
            select: {
              nhanVienId: true,
              maNhanVien: true,
              taiKhoan: { select: { hoTen: true, avatarUrl: true } },
            },
          },
          tinNhans: {
            take: 1,
            orderBy: { createdAt: 'desc' },
            select: {
              tinNhanId: true,
              taiKhoanGuiId: true,
              loaiNguoiGui: true,
              loaiTinNhan: true,
              noiDung: true,
              trangThai: true,
              createdAt: true,
            },
          },
        },
      }),
    ]);

    const formattedData: ConversationSummaryResponse[] = conversations.map((c) => ({
      cuocTroChuyenId: c.cuocTroChuyenId,
      maCuocTroChuyen: c.maCuocTroChuyen,
      tieuDe: c.tieuDe,
      trangThai: c.trangThai,
      kenhHoTro: c.kenhHoTro,
      cheDoChat: c.cheDoChat,
      khachHangId: c.khachHangId,
      nhanVienId: c.nhanVienId,
      nhaXeId: c.nhaXeId,
      dongLuc: c.dongLuc,
      createdAt: c.createdAt,
      updatedAt: c.updatedAt,
      nhaXe: c.nhaXe,
      khachHang: c.khachHang,
      nhanVien: c.nhanVien,
      tinNhanCuoi: c.tinNhans[0] ?? null,
    }));

    return {
      data: formattedData,
      meta: {
        page,
        pageSize,
        totalItems,
        totalPages: Math.ceil(totalItems / pageSize),
      },
    };
  }

  /**
   * Lấy chi tiết cuộc trò chuyện và kiểm tra quyền
   */
  async getConversationById(
    principal: AuthPrincipal,
    cuocTroChuyenId: number,
  ) {
    this.assertNotSuperAdmin(principal);

    const conv = await this.prisma.cuocTroChuyen.findUnique({
      where: { cuocTroChuyenId },
      include: {
        nhaXe: {
          select: { nhaXeId: true, tenNhaXe: true, logo: true, hotline: true },
        },
        khachHang: {
          select: {
            khachHangId: true,
            maKhachHang: true,
            taiKhoan: { select: { hoTen: true, soDienThoai: true, avatarUrl: true } },
          },
        },
        nhanVien: {
          select: {
            nhanVienId: true,
            maNhanVien: true,
            taiKhoan: { select: { hoTen: true, avatarUrl: true } },
          },
        },
      },
    });

    if (!conv) {
      throw new NotFoundException({
        error: 'CONVERSATION_NOT_FOUND',
        message: 'Không tìm thấy cuộc trò chuyện.',
      });
    }

    const isTenantUser = principal.nhaXeId !== null && principal.nhanVienId !== null;

    if (isTenantUser) {
      const hasRead =
        principal.permissions.includes('chat:read') ||
        principal.permissions.includes('chat:manage');
      if (!hasRead || conv.nhaXeId !== principal.nhaXeId) {
        throw new ForbiddenException({
          error: 'CHAT_PERMISSION_DENIED',
          message: 'Tài khoản không có quyền truy cập cuộc trò chuyện này.',
        });
      }
    } else {
      const khachHang = await this.ensureKhachHang(principal.taiKhoanId);
      if (conv.khachHangId !== khachHang.khachHangId) {
        throw new ForbiddenException({
          error: 'CHAT_PERMISSION_DENIED',
          message: 'Tài khoản không có quyền truy cập cuộc trò chuyện này.',
        });
      }
    }

    return conv;
  }

  /**
   * Lấy cuộc trò chuyện đang hoạt động của khách hàng với một nhà xe
   */
  async getActiveConversation(
    principal: AuthPrincipal,
    nhaXeId: number,
  ) {
    this.assertNotSuperAdmin(principal);

    if (
      !principal.roles.includes('KHACH_HANG') ||
      principal.nhanVienId !== null ||
      principal.nhaXeId !== null
    ) {
      throw new ForbiddenException({
        error: 'CUSTOMER_ONLY_ACTION',
        message: 'Chỉ tài khoản khách hàng mới có thể kiểm tra cuộc trò chuyện đang hoạt động.',
      });
    }

    const khachHang = await this.ensureKhachHang(principal.taiKhoanId);

    const activeConv = await this.prisma.cuocTroChuyen.findFirst({
      where: {
        khachHangId: khachHang.khachHangId,
        nhaXeId,
        trangThai: { in: [TrangThaiCuocTroChuyen.CHO_TIEP_NHAN, TrangThaiCuocTroChuyen.DANG_XU_LY] },
      },
      include: {
        nhaXe: {
          select: { nhaXeId: true, tenNhaXe: true, logo: true, hotline: true },
        },
        nhanVien: {
          select: {
            nhanVienId: true,
            maNhanVien: true,
            taiKhoan: { select: { hoTen: true, avatarUrl: true } },
          },
        },
        tinNhans: {
          take: 1,
          orderBy: { createdAt: 'desc' },
        },
      },
      orderBy: { updatedAt: 'desc' },
    });

    return activeConv;
  }

  /**
   * Lấy danh sách tin nhắn của cuộc trò chuyện (phân trang)
   */
  async getMessages(
    principal: AuthPrincipal,
    cuocTroChuyenId: number,
    query: Partial<GetMessagesQueryDto> = {},
  ) {
    // Xác minh quyền truy cập cuộc trò chuyện trước
    await this.getConversationById(principal, cuocTroChuyenId);

    const where: Prisma.TinNhanHoTroWhereInput = {
      cuocTroChuyenId,
    };

    if (query.beforeId) {
      where.tinNhanId = { lt: query.beforeId };
    }

    const page = Math.max(1, query.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, query.pageSize ?? 30));
    const skip = query.beforeId ? 0 : (page - 1) * pageSize;

    const [totalItems, rawMessages] = await Promise.all([
      this.prisma.tinNhanHoTro.count({ where: { cuocTroChuyenId } }),
      this.prisma.tinNhanHoTro.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { tinNhanId: 'desc' },
        include: {
          taiKhoanGui: {
            select: {
              taiKhoanId: true,
              hoTen: true,
              avatarUrl: true,
            },
          },
        },
      }),
    ]);

    // Trả về theo thứ tự thời gian tăng dần cho UI dễ hiển thị
    const messages = rawMessages.reverse();

    return {
      data: messages,
      meta: {
        page,
        pageSize,
        totalItems,
        totalPages: Math.ceil(totalItems / pageSize),
      },
    };
  }

  /**
   * Gửi tin nhắn vào cuộc trò chuyện
   */
  async sendMessage(
    principal: AuthPrincipal,
    dto: SendMessageDto,
  ) {
    this.assertNotSuperAdmin(principal);

    const conv = await this.prisma.cuocTroChuyen.findUnique({
      where: { cuocTroChuyenId: dto.cuocTroChuyenId },
    });

    if (!conv) {
      throw new NotFoundException({
        error: 'CONVERSATION_NOT_FOUND',
        message: 'Không tìm thấy cuộc trò chuyện.',
      });
    }

    if (conv.trangThai === TrangThaiCuocTroChuyen.DA_DONG) {
      throw new BadRequestException({
        error: 'CONVERSATION_CLOSED',
        message: 'Cuộc trò chuyện này đã kết thúc, không thể gửi thêm tin nhắn.',
      });
    }

    const isTenantUser = principal.nhaXeId !== null && principal.nhanVienId !== null;
    let loaiNguoiGui: string;

    if (isTenantUser) {
      if (conv.nhaXeId !== principal.nhaXeId) {
        throw new ForbiddenException({
          error: 'CHAT_PERMISSION_DENIED',
          message: 'Không được phép gửi tin nhắn tới cuộc trò chuyện của nhà xe khác.',
        });
      }
      if (!principal.permissions.includes('chat:manage')) {
        throw new ForbiddenException({
          error: 'CHAT_PERMISSION_DENIED',
          message: 'Tài khoản không có quyền gửi tin nhắn phản hồi.',
        });
      }
      loaiNguoiGui = 'NHAN_VIEN';
    } else {
      const khachHang = await this.ensureKhachHang(principal.taiKhoanId);
      if (conv.khachHangId !== khachHang.khachHangId) {
        throw new ForbiddenException({
          error: 'CHAT_PERMISSION_DENIED',
          message: 'Không được phép gửi tin nhắn vào cuộc trò chuyện của khách hàng khác.',
        });
      }
      loaiNguoiGui = 'KHACH_HANG';
    }

    // Idempotency check theo clientMessageId
    if (dto.clientMessageId) {
      const existingMessage = await this.prisma.tinNhanHoTro.findUnique({
        where: { clientMessageId: dto.clientMessageId },
        include: {
          taiKhoanGui: {
            select: { taiKhoanId: true, hoTen: true, avatarUrl: true },
          },
        },
      });
      if (existingMessage) {
        if (
          existingMessage.cuocTroChuyenId !== conv.cuocTroChuyenId ||
          existingMessage.taiKhoanGuiId !== principal.taiKhoanId
        ) {
          throw new ConflictException({
            error: 'IDEMPOTENCY_CONFLICT',
            message: 'ClientMessageId đã được sử dụng cho một cuộc trò chuyện hoặc người gửi khác.',
          });
        }
        return existingMessage;
      }
    }

    return this.prisma.$transaction(async (tx) => {
      let message;
      try {
        message = await tx.tinNhanHoTro.create({
          data: {
            cuocTroChuyenId: conv.cuocTroChuyenId,
            taiKhoanGuiId: principal.taiKhoanId,
            loaiNguoiGui,
            loaiTinNhan: dto.loaiTinNhan ?? 'VAN_BAN',
            noiDung: dto.noiDung,
            tepDinhKemUrl: dto.tepDinhKemUrl,
            clientMessageId: dto.clientMessageId,
            trangThai: 'DA_GUI',
          },
          include: {
            taiKhoanGui: {
              select: { taiKhoanId: true, hoTen: true, avatarUrl: true },
            },
          },
        });
      } catch (error) {
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === 'P2002' &&
          dto.clientMessageId
        ) {
          const existing = await tx.tinNhanHoTro.findUnique({
            where: { clientMessageId: dto.clientMessageId },
            include: {
              taiKhoanGui: {
                select: { taiKhoanId: true, hoTen: true, avatarUrl: true },
              },
            },
          });
          if (
            existing &&
            existing.cuocTroChuyenId === conv.cuocTroChuyenId &&
            existing.taiKhoanGuiId === principal.taiKhoanId
          ) {
            return existing;
          }
          throw new ConflictException({
            error: 'IDEMPOTENCY_CONFLICT',
            message: 'ClientMessageId đã được sử dụng cho một cuộc trò chuyện hoặc người gửi khác.',
          });
        }
        throw error;
      }

      // Nếu nhân viên trả lời khi cuộc trò chuyện còn CHO_TIEP_NHAN, tự động tiếp nhận
      const updateData: Prisma.CuocTroChuyenUpdateInput = {
        updatedAt: new Date(),
      };
      if (isTenantUser && conv.trangThai === TrangThaiCuocTroChuyen.CHO_TIEP_NHAN) {
        updateData.trangThai = TrangThaiCuocTroChuyen.DANG_XU_LY;
        updateData.nhanVien = { connect: { nhanVienId: principal.nhanVienId! } };
      }

      await tx.cuocTroChuyen.update({
        where: { cuocTroChuyenId: conv.cuocTroChuyenId },
        data: updateData,
      });

      return message;
    });
  }

  /**
   * Nhân viên nhà xe tiếp nhận cuộc trò chuyện (Atomic Claim)
   */
  async claimConversation(
    principal: AuthPrincipal,
    cuocTroChuyenId: number,
  ) {
    this.assertNotSuperAdmin(principal);

    if (!principal.nhaXeId || !principal.nhanVienId) {
      throw new ForbiddenException({
        error: 'TENANT_STAFF_REQUIRED',
        message: 'Chỉ nhân viên nhà xe mới có thể tiếp nhận cuộc trò chuyện.',
      });
    }

    if (!principal.permissions.includes('chat:manage')) {
      throw new ForbiddenException({
        error: 'CHAT_PERMISSION_DENIED',
        message: 'Tài khoản không có quyền tiếp nhận cuộc trò chuyện.',
      });
    }

    return this.prisma.$transaction(async (tx) => {
      // Atomic update: chỉ update khi còn CHO_TIEP_NHAN, nhanVienId IS NULL, và đúng nhaXeId
      const result = await tx.cuocTroChuyen.updateMany({
        where: {
          cuocTroChuyenId,
          nhaXeId: principal.nhaXeId!,
          trangThai: TrangThaiCuocTroChuyen.CHO_TIEP_NHAN,
          nhanVienId: null,
        },
        data: {
          nhanVienId: principal.nhanVienId,
          trangThai: TrangThaiCuocTroChuyen.DANG_XU_LY,
          updatedAt: new Date(),
        },
      });

      if (result.count === 0) {
        const current = await tx.cuocTroChuyen.findUnique({
          where: { cuocTroChuyenId },
        });
        if (!current) {
          throw new NotFoundException({
            error: 'CONVERSATION_NOT_FOUND',
            message: 'Không tìm thấy cuộc trò chuyện.',
          });
        }
        if (current.nhaXeId !== principal.nhaXeId) {
          throw new ForbiddenException({
            error: 'TENANT_SCOPE_VIOLATION',
            message: 'Không thể tiếp nhận cuộc trò chuyện của nhà xe khác.',
          });
        }
        if (current.trangThai === TrangThaiCuocTroChuyen.DA_DONG) {
          throw new BadRequestException({
            error: 'CONVERSATION_CLOSED',
            message: 'Cuộc trò chuyện này đã kết thúc.',
          });
        }
        throw new ConflictException({
          error: 'CONVERSATION_ALREADY_CLAIMED',
          message: 'Cuộc trò chuyện đã được nhân viên khác tiếp nhận.',
        });
      }

      // Tạo tin nhắn hệ thống ghi nhận tiếp nhận
      await tx.tinNhanHoTro.create({
        data: {
          cuocTroChuyenId,
          taiKhoanGuiId: principal.taiKhoanId,
          loaiNguoiGui: 'HE_THONG',
          loaiTinNhan: 'VAN_BAN',
          noiDung: 'Nhân viên hỗ trợ đã tiếp nhận cuộc trò chuyện.',
          trangThai: 'DA_GUI',
        },
      });

      return tx.cuocTroChuyen.findUniqueOrThrow({
        where: { cuocTroChuyenId },
        include: {
          nhaXe: { select: { nhaXeId: true, tenNhaXe: true, logo: true, hotline: true } },
          khachHang: {
            select: {
              khachHangId: true,
              maKhachHang: true,
              taiKhoan: { select: { hoTen: true, soDienThoai: true, avatarUrl: true } },
            },
          },
          nhanVien: {
            select: {
              nhanVienId: true,
              maNhanVien: true,
              taiKhoan: { select: { hoTen: true, avatarUrl: true } },
            },
          },
        },
      });
    });
  }

  /**
   * Đóng cuộc trò chuyện
   */
  async closeConversation(
    principal: AuthPrincipal,
    cuocTroChuyenId: number,
    dto?: CloseConversationDto,
  ) {
    this.assertNotSuperAdmin(principal);

    const conv = await this.prisma.cuocTroChuyen.findUnique({
      where: { cuocTroChuyenId },
    });

    if (!conv) {
      throw new NotFoundException({
        error: 'CONVERSATION_NOT_FOUND',
        message: 'Không tìm thấy cuộc trò chuyện.',
      });
    }

    const isTenantUser = principal.nhaXeId !== null && principal.nhanVienId !== null;

    if (isTenantUser) {
      if (conv.nhaXeId !== principal.nhaXeId) {
        throw new ForbiddenException({
          error: 'TENANT_SCOPE_VIOLATION',
          message: 'Không có quyền đóng cuộc trò chuyện của nhà xe khác.',
        });
      }
      if (!principal.permissions.includes('chat:manage')) {
        throw new ForbiddenException({
          error: 'CHAT_PERMISSION_DENIED',
          message: 'Tài khoản không có quyền kết thúc cuộc trò chuyện.',
        });
      }
    } else {
      const khachHang = await this.ensureKhachHang(principal.taiKhoanId);
      if (conv.khachHangId !== khachHang.khachHangId) {
        throw new ForbiddenException({
          error: 'CHAT_PERMISSION_DENIED',
          message: 'Không có quyền kết thúc cuộc trò chuyện của khách hàng khác.',
        });
      }
    }

    if (conv.trangThai === TrangThaiCuocTroChuyen.DA_DONG) {
      return conv;
    }

    return this.prisma.$transaction(async (tx) => {
      const closedConv = await tx.cuocTroChuyen.update({
        where: { cuocTroChuyenId },
        data: {
          trangThai: TrangThaiCuocTroChuyen.DA_DONG,
          dongLuc: new Date(),
          updatedAt: new Date(),
        },
      });

      const messageContent = dto?.lyDo
        ? `Cuộc trò chuyện đã kết thúc: ${dto.lyDo}`
        : 'Cuộc trò chuyện đã kết thúc.';

      await tx.tinNhanHoTro.create({
        data: {
          cuocTroChuyenId,
          taiKhoanGuiId: principal.taiKhoanId,
          loaiNguoiGui: 'HE_THONG',
          loaiTinNhan: 'VAN_BAN',
          noiDung: messageContent,
          trangThai: 'DA_GUI',
        },
      });

      return closedConv;
    });
  }

  /**
   * Đánh dấu tin nhắn đã đọc
   */
  async markMessagesAsRead(
    principal: AuthPrincipal,
    cuocTroChuyenId: number,
    dto?: MarkReadDto,
  ) {
    this.assertNotSuperAdmin(principal);

    // Xác minh quyền truy cập
    await this.getConversationById(principal, cuocTroChuyenId);

    const where: Prisma.TinNhanHoTroWhereInput = {
      cuocTroChuyenId,
      taiKhoanGuiId: { not: principal.taiKhoanId },
      trangThai: 'DA_GUI',
    };

    if (dto?.tinNhanIds && dto.tinNhanIds.length > 0) {
      where.tinNhanId = { in: dto.tinNhanIds };
    }

    const result = await this.prisma.tinNhanHoTro.updateMany({
      where,
      data: {
        trangThai: 'DA_DOC',
        daDocLuc: new Date(),
      },
    });

    return { updatedCount: result.count };
  }
}
