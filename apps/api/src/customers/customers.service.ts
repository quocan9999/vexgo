import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { normalizeEmail } from '../common/normalize-email.js';
import type { AuthPrincipal } from '../auth/tokens/auth-principal.js';
import type { UpdateMeDto } from './dto/update-me.dto.js';
import type { AdminCustomerQueryDto } from './dto/admin-customer-query.dto.js';
import type { AdminCustomerTransactionsQueryDto } from './dto/admin-customer-transactions-query.dto.js';
import type { AdminCustomerTicketsQueryDto } from './dto/admin-customer-tickets-query.dto.js';

const customerProfileInclude = {
  khachHang: true,
  taiKhoanVaiTros: {
    include: { vaiTro: { select: { tenVaiTro: true } } },
  },
} satisfies Prisma.TaiKhoanInclude;

type CustomerAccount = Prisma.TaiKhoanGetPayload<{
  include: typeof customerProfileInclude;
}>;

function formatSqlDate(date: Date | string | null | undefined): string {
  if (!date) return '';
  if (typeof date === 'string') {
    return date.slice(0, 10);
  }
  try {
    return date.toISOString().slice(0, 10);
  } catch {
    return String(date);
  }
}

function formatSqlTime(time: Date | string | null | undefined): string {
  if (!time) return '';
  if (typeof time === 'string') {
    if (time.length === 8 && time.includes(':')) return time;
    try {
      return new Date(time).toISOString().slice(11, 19);
    } catch {
      return time;
    }
  }
  try {
    return time.toISOString().slice(11, 19);
  } catch {
    return String(time);
  }
}

@Injectable()
export class CustomersService {
  constructor(private readonly prisma: PrismaService) {}

  async getMe(taiKhoanId: number) {
    const account = await this.findCustomerAccount(taiKhoanId);
    return this.mapProfile(account);
  }

  async updateMe(taiKhoanId: number, dto: UpdateMeDto) {
    await this.findCustomerAccount(taiKhoanId);
    let account: CustomerAccount;
    try {
      account = await this.prisma.taiKhoan.update({
        where: { taiKhoanId },
        data: {
          ...(dto.fullName !== undefined ? { hoTen: dto.fullName } : {}),
          ...(dto.dateOfBirth !== undefined
            ? {
                ngaySinh: dto.dateOfBirth
                  ? new Date(`${dto.dateOfBirth}T00:00:00.000Z`)
                  : null,
              }
            : {}),
          ...(dto.email !== undefined
            ? { email: normalizeEmail(dto.email) }
            : {}),
          ...(dto.citizenId !== undefined ? { cccd: dto.citizenId } : {}),
        },
        include: customerProfileInclude,
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002' &&
        JSON.stringify(error.meta?.target ?? '').includes('email')
      ) {
        throw new ConflictException({
          error: 'EMAIL_ALREADY_REGISTERED',
          message: 'Email đã được đăng ký.',
        });
      }
      throw error;
    }
    return this.mapProfile(account);
  }

  private async findCustomerAccount(taiKhoanId: number) {
    const account = await this.prisma.taiKhoan.findUnique({
      where: { taiKhoanId },
      include: customerProfileInclude,
    });
    if (!account) {
      throw new NotFoundException({
        error: 'CUSTOMER_PROFILE_NOT_FOUND',
        message: 'Không tìm thấy hồ sơ khách hàng.',
      });
    }
    const roles = account.taiKhoanVaiTros.map(({ vaiTro }) => vaiTro.tenVaiTro);
    if (!roles.includes('KHACH_HANG')) {
      throw new ForbiddenException({
        error: 'CUSTOMER_ROLE_REQUIRED',
        message: 'Tài khoản không có quyền khách hàng.',
      });
    }
    if (!account.khachHang) {
      throw new NotFoundException({
        error: 'CUSTOMER_PROFILE_NOT_FOUND',
        message: 'Không tìm thấy hồ sơ khách hàng.',
      });
    }
    return account;
  }

  private mapProfile(account: CustomerAccount) {
    const customer = account.khachHang;
    if (!customer) {
      throw new NotFoundException({
        error: 'CUSTOMER_PROFILE_NOT_FOUND',
        message: 'Không tìm thấy hồ sơ khách hàng.',
      });
    }
    return {
      accountId: account.taiKhoanId,
      customerId: customer.khachHangId,
      customerCode: customer.maKhachHang,
      loyaltyPoints: customer.diemTichLuy,
      fullName: account.hoTen,
      phoneNumber: account.soDienThoai,
      dateOfBirth: account.ngaySinh?.toISOString().slice(0, 10) ?? null,
      citizenId: account.cccd,
      email: account.email,
      phoneVerified: account.daXacThucSoDienThoai,
      status: account.trangThai,
      createdAt: account.createdAt.toISOString(),
      updatedAt: account.updatedAt.toISOString(),
    };
  }

  async listAdminCustomers(
    principal: AuthPrincipal,
    query: AdminCustomerQueryDto,
  ) {
    const nhaXeId = this.requireTenantId(principal);
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 10;
    const sortDirection = query.sortDirection ?? 'asc';
    const sortBy = query.sortBy ?? 'customerCode';

    const andConditions: Prisma.KhachHangWhereInput[] = [
      {
        donGiaoDichs: {
          some: {
            nhaXeId,
          },
        },
      },
    ];

    const trimmedSearch = query.search?.trim();
    if (trimmedSearch) {
      andConditions.push({
        OR: [
          { maKhachHang: { contains: trimmedSearch } },
          { taiKhoan: { hoTen: { contains: trimmedSearch } } },
          { taiKhoan: { soDienThoai: { contains: trimmedSearch } } },
          { taiKhoan: { email: { contains: trimmedSearch } } },
        ],
      });
    }

    if (query.accountStatus) {
      andConditions.push({
        taiKhoan: {
          trangThai: query.accountStatus,
        },
      });
    }

    const where: Prisma.KhachHangWhereInput = {
      AND: andConditions,
    };

    let orderBy: Prisma.KhachHangOrderByWithRelationInput[];
    switch (sortBy) {
      case 'customerCode':
        orderBy = [{ maKhachHang: sortDirection }, { khachHangId: 'asc' }];
        break;
      case 'fullName':
        orderBy = [
          { taiKhoan: { hoTen: sortDirection } },
          { khachHangId: 'asc' },
        ];
        break;
      case 'loyaltyPoints':
        orderBy = [{ diemTichLuy: sortDirection }, { khachHangId: 'asc' }];
        break;
      case 'createdAt':
        orderBy = [{ createdAt: sortDirection }, { khachHangId: 'asc' }];
        break;
      case 'updatedAt':
        orderBy = [{ updatedAt: sortDirection }, { khachHangId: 'asc' }];
        break;
      default:
        orderBy = [{ maKhachHang: 'asc' }, { khachHangId: 'asc' }];
    }

    const [totalItems, items] = await Promise.all([
      this.prisma.khachHang.count({ where }),
      this.prisma.khachHang.findMany({
        where,
        include: {
          taiKhoan: true,
        },
        orderBy,
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    const totalPages = Math.ceil(totalItems / pageSize) || 1;

    return {
      data: items.map((item) => ({
        customerId: item.khachHangId,
        customerCode: item.maKhachHang,
        fullName: item.taiKhoan.hoTen,
        phoneNumber: item.taiKhoan.soDienThoai,
        email: item.taiKhoan.email,
        loyaltyPoints: item.diemTichLuy,
        account: {
          accountId: item.taiKhoan.taiKhoanId,
          status: item.taiKhoan.trangThai,
          phoneVerified: item.taiKhoan.daXacThucSoDienThoai,
        },
        createdAt: item.createdAt.toISOString(),
        updatedAt: item.updatedAt.toISOString(),
      })),
      meta: {
        page,
        pageSize,
        totalItems,
        totalPages,
      },
    };
  }

  async getAdminCustomerById(principal: AuthPrincipal, customerId: number) {
    const nhaXeId = this.requireTenantId(principal);

    const customer = await this.prisma.khachHang.findFirst({
      where: {
        khachHangId: customerId,
        donGiaoDichs: {
          some: {
            nhaXeId,
          },
        },
      },
      include: {
        taiKhoan: true,
      },
    });

    if (!customer) {
      throw new NotFoundException({
        error: 'CUSTOMER_NOT_FOUND',
        message: 'Không tìm thấy khách hàng.',
      });
    }

    return {
      data: {
        customerId: customer.khachHangId,
        customerCode: customer.maKhachHang,
        fullName: customer.taiKhoan.hoTen,
        phoneNumber: customer.taiKhoan.soDienThoai,
        email: customer.taiKhoan.email,
        loyaltyPoints: customer.diemTichLuy,
        account: {
          accountId: customer.taiKhoan.taiKhoanId,
          status: customer.taiKhoan.trangThai,
          phoneVerified: customer.taiKhoan.daXacThucSoDienThoai,
          createdAt: customer.taiKhoan.createdAt.toISOString(),
          updatedAt: customer.taiKhoan.updatedAt.toISOString(),
        },
        createdAt: customer.createdAt.toISOString(),
        updatedAt: customer.updatedAt.toISOString(),
      },
    };
  }

  async listAdminCustomerTransactions(
    principal: AuthPrincipal,
    customerId: number,
    query: AdminCustomerTransactionsQueryDto,
  ) {
    const nhaXeId = this.requireTenantId(principal);

    // Verify tenant visibility
    const customer = await this.prisma.khachHang.findFirst({
      where: {
        khachHangId: customerId,
        donGiaoDichs: {
          some: {
            nhaXeId,
          },
        },
      },
      select: {
        khachHangId: true,
      },
    });

    if (!customer) {
      throw new NotFoundException({
        error: 'CUSTOMER_NOT_FOUND',
        message: 'Không tìm thấy khách hàng.',
      });
    }

    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 10;
    const sortDirection = query.sortDirection ?? 'desc';

    const where: Prisma.DonGiaoDichWhereInput = {
      khachHangId: customerId,
      nhaXeId,
    };

    if (query.search?.trim()) {
      where.maDonGiaoDich = {
        contains: query.search.trim(),
      };
    }

    const orderBy: Prisma.DonGiaoDichOrderByWithRelationInput[] =
      query.sortBy === 'totalAmount'
        ? [
            { tongTien: sortDirection },
            { donGiaoDichId: sortDirection },
          ]
        : [
            { ngayTao: sortDirection },
            { donGiaoDichId: sortDirection },
          ];

    const [totalItems, items] = await Promise.all([
      this.prisma.donGiaoDich.count({ where }),
      this.prisma.donGiaoDich.findMany({
        where,
        orderBy,
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          phieuDatVe: {
            select: {
              phieuDatVeId: true,
              maPhieuDatVe: true,
              trangThai: true,
            },
          },
          phieuGuiHang: {
            select: {
              phieuGuiHangId: true,
              maPhieuGuiHang: true,
              trangThai: true,
            },
          },
        },
      }),
    ]);

    const totalPages = Math.ceil(totalItems / pageSize) || 1;

    return {
      data: items.map((item) => ({
        transactionId: item.donGiaoDichId,
        code: item.maDonGiaoDich,
        createdDate: item.ngayTao.toISOString(),
        totalAmount: Number(item.tongTien),
        status: item.trangThai,
        customerSnapshot: {
          fullName: item.tenKhachHang,
          phoneNumber: item.soDienThoaiKhachHang,
          email: item.emailKhachHang,
        },
        booking: item.phieuDatVe
          ? {
              bookingId: item.phieuDatVe.phieuDatVeId,
              code: item.phieuDatVe.maPhieuDatVe,
              status: item.phieuDatVe.trangThai,
            }
          : null,
        shipment: item.phieuGuiHang
          ? {
              shipmentId: item.phieuGuiHang.phieuGuiHangId,
              code: item.phieuGuiHang.maPhieuGuiHang,
              status: item.phieuGuiHang.trangThai,
            }
          : null,
        createdAt: item.createdAt.toISOString(),
        updatedAt: item.updatedAt.toISOString(),
      })),
      meta: {
        page,
        pageSize,
        totalItems,
        totalPages,
      },
    };
  }

  async listAdminCustomerTickets(
    principal: AuthPrincipal,
    customerId: number,
    query: AdminCustomerTicketsQueryDto,
  ) {
    const nhaXeId = this.requireTenantId(principal);

    // Verify tenant visibility: customer must have at least one transaction with this tenant
    const customer = await this.prisma.khachHang.findFirst({
      where: {
        khachHangId: customerId,
        donGiaoDichs: {
          some: {
            nhaXeId,
          },
        },
      },
      select: {
        khachHangId: true,
      },
    });

    if (!customer) {
      throw new NotFoundException({
        error: 'CUSTOMER_NOT_FOUND',
        message: 'Không tìm thấy khách hàng.',
      });
    }

    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 10;
    const sortDirection = query.sortDirection ?? 'desc';

    const andConditions: Prisma.VeWhereInput[] = [
      {
        phieuDatVe: {
          donGiaoDich: {
            khachHangId: customerId,
            nhaXeId,
          },
        },
      },
    ];

    if (query.search?.trim()) {
      const search = query.search.trim();
      andConditions.push({
        OR: [
          { maVe: { contains: search } },
          { phieuDatVe: { maPhieuDatVe: { contains: search } } },
          {
            gheChuyenXe: {
              chuyenXe: {
                maChuyenXe: { contains: search },
              },
            },
          },
        ],
      });
    }

    const where: Prisma.VeWhereInput = {
      AND: andConditions,
    };

    const orderBy: Prisma.VeOrderByWithRelationInput[] = [
      { phieuDatVe: { ngayDat: sortDirection } },
      { veId: sortDirection },
    ];

    const [totalItems, items] = await Promise.all([
      this.prisma.ve.count({ where }),
      this.prisma.ve.findMany({
        where,
        orderBy,
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          phieuDatVe: true,
          gheChuyenXe: {
            include: {
              ghe: true,
              chuyenXe: {
                include: {
                  tuyenXe: true,
                  xe: true,
                },
              },
            },
          },
        },
      }),
    ]);

    const totalPages = Math.ceil(totalItems / pageSize) || 1;

    return {
      data: items.map((t) => ({
        ticketId: t.veId,
        ticketCode: t.maVe,
        status: t.trangThai,
        pickupPoint: t.diemDon ?? null,
        listedPrice: Number(t.giaNiemYet),
        actualPrice: Number(t.giaThucTe),
        booking: {
          bookingId: t.phieuDatVe.phieuDatVeId,
          code: t.phieuDatVe.maPhieuDatVe,
          bookedAt: t.phieuDatVe.ngayDat.toISOString(),
          status: t.phieuDatVe.trangThai,
        },
        trip: {
          tripId: t.gheChuyenXe.chuyenXe.chuyenXeId,
          code: t.gheChuyenXe.chuyenXe.maChuyenXe,
          departureDate: formatSqlDate(t.gheChuyenXe.chuyenXe.ngayKhoiHanh),
          departureTime: formatSqlTime(t.gheChuyenXe.chuyenXe.gioKhoiHanh),
          status: t.gheChuyenXe.chuyenXe.trangThai,
          route: {
            routeId: t.gheChuyenXe.chuyenXe.tuyenXe.tuyenXeId,
            code: t.gheChuyenXe.chuyenXe.tuyenXe.maTuyenXe,
            origin: t.gheChuyenXe.chuyenXe.tuyenXe.diemDi,
            destination: t.gheChuyenXe.chuyenXe.tuyenXe.diemDen,
          },
          vehicle: {
            vehicleId: t.gheChuyenXe.chuyenXe.xe.xeId,
            licensePlate: t.gheChuyenXe.chuyenXe.xe.bienSoXe,
          },
        },
        seat: {
          seatId: t.gheChuyenXe.ghe.gheId,
          code: t.gheChuyenXe.ghe.soGhe,
          position: t.gheChuyenXe.ghe.viTri ?? null,
        },
      })),
      meta: {
        page,
        pageSize,
        totalItems,
        totalPages,
      },
    };
  }

  private requireTenantId(principal: AuthPrincipal): number {
    const nhaXeId = principal.nhaXeId;
    if (!Number.isSafeInteger(nhaXeId) || (nhaXeId ?? 0) <= 0) {
      throw new ForbiddenException({
        error: 'TENANT_SCOPE_REQUIRED',
        message: 'Yêu cầu quyền truy cập trong phạm vi nhà xe.',
      });
    }
    return nhaXeId as number;
  }
}
