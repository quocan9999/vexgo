import {
  BadRequestException,
  ConflictException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { normalizeEmail } from '../common/normalize-email.js';
import {
  businessDateStartUtc,
  resolveBusinessTimeZone,
} from '../common/time/business-date.js';
import { TENANT_PRINCIPAL_ROLES } from '../auth/principal-scope.js';
import type { AdminAccountQueryDto } from './dto/admin-account-query.dto.js';
import type { CreateAdminAccountDto } from './dto/create-admin-account.dto.js';
import type { UpdateAdminAccountDto } from './dto/update-admin-account.dto.js';
import type { UpdateAdminAccountStatusDto } from './dto/update-admin-account-status.dto.js';

const ADMIN_ACCOUNT_ROLE = 'NHA_XE_ADMIN';
const TENANT_PRINCIPAL_ROLE_SET = new Set<string>(TENANT_PRINCIPAL_ROLES);

function addCalendarDays(dateOnly: string, days: number): string {
  const [year, month, day] = dateOnly.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day + days))
    .toISOString()
    .slice(0, 10);
}

const ADMIN_ACCOUNT_SELECT = {
  taiKhoanId: true,
  hoTen: true,
  soDienThoai: true,
  ngaySinh: true,
  cccd: true,
  email: true,
  daXacThucSoDienThoai: true,
  trangThai: true,
  createdAt: true,
  updatedAt: true,
  taiKhoanVaiTros: {
    select: { vaiTro: { select: { tenVaiTro: true } } },
  },
  nhanVien: {
    select: {
      nhanVienId: true,
      maNhanVien: true,
      trangThaiLamViec: true,
      nhaXe: {
        select: {
          nhaXeId: true,
          maNhaXe: true,
          tenNhaXe: true,
          trangThai: true,
        },
      },
    },
  },
} satisfies Prisma.TaiKhoanSelect;

type AdminAccountRecord = Prisma.TaiKhoanGetPayload<{
  select: typeof ADMIN_ACCOUNT_SELECT;
}>;

const sortFieldMap = {
  fullName: 'hoTen',
  phoneNumber: 'soDienThoai',
  status: 'trangThai',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt',
} as const satisfies Record<
  NonNullable<AdminAccountQueryDto['sortBy']>,
  keyof Prisma.TaiKhoanOrderByWithRelationInput
>;

function managedAdminAccountWhere(
  taiKhoanId?: number,
): Prisma.TaiKhoanWhereInput {
  return {
    ...(taiKhoanId === undefined ? {} : { taiKhoanId }),
    nhanVien: { isNot: null },
    taiKhoanVaiTros: {
      every: {
        vaiTro: {
          is: { tenVaiTro: { in: [...TENANT_PRINCIPAL_ROLES] } },
        },
      },
    },
  };
}

function accountNotFound(): NotFoundException {
  return new NotFoundException({
    error: 'ADMIN_ACCOUNT_NOT_FOUND',
    message: 'Không tìm thấy tài khoản quản trị nhà xe.',
  });
}

function phoneAlreadyRegistered(): ConflictException {
  return new ConflictException({
    error: 'PHONE_ALREADY_REGISTERED',
    message: 'Số điện thoại đã được đăng ký.',
  });
}

function emailAlreadyRegistered(): ConflictException {
  return new ConflictException({
    error: 'EMAIL_ALREADY_REGISTERED',
    message: 'Email đã được đăng ký.',
  });
}

function employeeCodeExists(): ConflictException {
  return new ConflictException({
    error: 'EMPLOYEE_CODE_EXISTS',
    message: 'Mã nhân viên đã tồn tại trong nhà xe.',
  });
}

function createRoleNames(input: CreateAdminAccountDto): string[] {
  const requestedRoleNames: unknown = input.roleNames;
  if (requestedRoleNames === undefined) return [ADMIN_ACCOUNT_ROLE];

  if (
    !Array.isArray(requestedRoleNames) ||
    requestedRoleNames.length === 0 ||
    new Set(requestedRoleNames).size !== requestedRoleNames.length ||
    requestedRoleNames.some(
      (roleName) =>
        typeof roleName !== 'string' ||
        !TENANT_PRINCIPAL_ROLE_SET.has(roleName),
    )
  ) {
    throw new BadRequestException({
      error: 'VALIDATION_ERROR',
      message: 'Danh sách vai trò nhà xe không hợp lệ.',
    });
  }

  return requestedRoleNames;
}

function replacementRoleNames(input: unknown): string[] {
  if (
    !Array.isArray(input) ||
    new Set(input).size !== input.length ||
    input.some(
      (roleName) =>
        typeof roleName !== 'string' ||
        !TENANT_PRINCIPAL_ROLE_SET.has(roleName),
    )
  ) {
    throw new BadRequestException({
      error: 'VALIDATION_ERROR',
      message: 'Danh sách vai trò nhà xe không hợp lệ.',
    });
  }

  return input;
}

function busCompanyNotFound(): NotFoundException {
  return new NotFoundException({
    error: 'BUS_COMPANY_NOT_FOUND',
    message: 'Không tìm thấy nhà xe.',
  });
}

function isUniqueConstraintError(
  error: unknown,
): error is Prisma.PrismaClientKnownRequestError {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === 'P2002'
  );
}

function isUniqueConstraintOn(error: unknown, field: string): boolean {
  return (
    isUniqueConstraintError(error) &&
    JSON.stringify(error.meta?.target ?? '').includes(field)
  );
}

function toDateOnly(value: string | null | undefined): Date | null {
  return value ? new Date(`${value}T00:00:00.000Z`) : null;
}

function mapAdminAccount(account: AdminAccountRecord) {
  const employee = account.nhanVien;
  if (!employee) throw accountNotFound();

  return {
    accountId: account.taiKhoanId,
    fullName: account.hoTen,
    phoneNumber: account.soDienThoai,
    dateOfBirth: account.ngaySinh?.toISOString().slice(0, 10) ?? null,
    citizenId: account.cccd,
    email: account.email,
    phoneVerified: account.daXacThucSoDienThoai,
    status: account.trangThai,
    roles: account.taiKhoanVaiTros.map(({ vaiTro }) => vaiTro.tenVaiTro),
    employee: {
      employeeId: employee.nhanVienId,
      employeeCode: employee.maNhanVien,
      employmentStatus: employee.trangThaiLamViec,
    },
    busCompany: {
      busCompanyId: employee.nhaXe.nhaXeId,
      code: employee.nhaXe.maNhaXe,
      name: employee.nhaXe.tenNhaXe,
      status: employee.nhaXe.trangThai,
    },
    createdAt: account.createdAt.toISOString(),
    updatedAt: account.updatedAt.toISOString(),
  };
}

@Injectable()
export class AdminAccountsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  async findAll(query: AdminAccountQueryDto) {
    const conditions: Prisma.TaiKhoanWhereInput[] = [
      managedAdminAccountWhere(),
    ];
    const search = query.search?.trim();

    if (query.status) conditions.push({ trangThai: query.status });
    if (query.busCompanyId !== undefined) {
      conditions.push({ nhanVien: { is: { nhaXeId: query.busCompanyId } } });
    }
    if (query.roleName) {
      conditions.push({
        taiKhoanVaiTros: {
          some: { vaiTro: { is: { tenVaiTro: query.roleName } } },
        },
      });
    }
    if (query.createdFrom || query.createdTo) {
      const businessTimeZone = resolveBusinessTimeZone(
        this.config.get<string>('BUSINESS_TIME_ZONE'),
      );
      conditions.push({
        createdAt: {
          ...(query.createdFrom
            ? { gte: businessDateStartUtc(query.createdFrom, businessTimeZone) }
            : {}),
          ...(query.createdTo
            ? {
                lt: businessDateStartUtc(
                  addCalendarDays(query.createdTo, 1),
                  businessTimeZone,
                ),
              }
            : {}),
        },
      });
    }
    if (search) {
      conditions.push({
        OR: [
          { hoTen: { contains: search } },
          { soDienThoai: { contains: search } },
          { email: { contains: search } },
          { nhanVien: { is: { maNhanVien: { contains: search } } } },
          {
            nhanVien: {
              is: {
                nhaXe: { is: { maNhaXe: { contains: search } } },
              },
            },
          },
          {
            nhanVien: {
              is: {
                nhaXe: { is: { tenNhaXe: { contains: search } } },
              },
            },
          },
        ],
      });
    }

    const where: Prisma.TaiKhoanWhereInput = { AND: conditions };
    const sortDirection = query.sortDirection ?? 'desc';
    const [accounts, totalItems] = await Promise.all([
      this.prisma.taiKhoan.findMany({
        where,
        orderBy: [
          { [sortFieldMap[query.sortBy]]: sortDirection },
          { taiKhoanId: 'asc' },
        ],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        select: ADMIN_ACCOUNT_SELECT,
      }),
      this.prisma.taiKhoan.count({ where }),
    ]);

    return {
      data: accounts.map(mapAdminAccount),
      meta: {
        page: query.page,
        pageSize: query.pageSize,
        totalItems,
        totalPages: Math.ceil(totalItems / query.pageSize),
      },
    };
  }

  async findOne(taiKhoanId: number) {
    const account = await this.prisma.taiKhoan.findFirst({
      where: managedAdminAccountWhere(taiKhoanId),
      select: ADMIN_ACCOUNT_SELECT,
    });
    if (!account) throw accountNotFound();

    return { data: mapAdminAccount(account) };
  }

  async create(input: CreateAdminAccountDto) {
    const roleNames = createRoleNames(input);
    const passwordHash = await bcrypt.hash(input.password, 10);

    return this.prisma.$transaction(async (tx) => {
      const [busCompany, roles, existingPhone] = await Promise.all([
        tx.nhaXe.findUnique({
          where: { nhaXeId: input.busCompanyId },
          select: { nhaXeId: true },
        }),
        tx.vaiTro.findMany({
          where: { tenVaiTro: { in: roleNames } },
          select: { vaiTroId: true, tenVaiTro: true },
        }),
        tx.taiKhoan.findUnique({
          where: { soDienThoai: input.phoneNumber },
          select: { taiKhoanId: true },
        }),
      ]);

      if (!busCompany) throw busCompanyNotFound();
      if (roles.length !== roleNames.length) {
        throw new InternalServerErrorException({
          error: 'AUTH_ROLE_NOT_CONFIGURED',
          message: 'Một hoặc nhiều vai trò nhà xe chưa được cấu hình.',
        });
      }
      if (existingPhone) throw phoneAlreadyRegistered();

      let accountId: number;
      try {
        const account = await tx.taiKhoan.create({
          data: {
            hoTen: input.fullName,
            soDienThoai: input.phoneNumber,
            matKhau: passwordHash,
            ngaySinh: toDateOnly(input.dateOfBirth),
            email: normalizeEmail(input.email),
            cccd: input.citizenId ?? null,
            daXacThucSoDienThoai: true,
            trangThai: 'HOAT_DONG',
          },
          select: { taiKhoanId: true },
        });
        accountId = account.taiKhoanId;
      } catch (error) {
        if (isUniqueConstraintOn(error, 'email')) {
          throw emailAlreadyRegistered();
        }
        if (isUniqueConstraintOn(error, 'soDienThoai')) {
          throw phoneAlreadyRegistered();
        }
        if (isUniqueConstraintError(error)) throw phoneAlreadyRegistered();
        throw error;
      }

      try {
        await tx.nhanVien.create({
          data: {
            maNhanVien: input.employeeCode,
            trangThaiLamViec: 'DANG_LAM_VIEC',
            nhaXeId: busCompany.nhaXeId,
            taiKhoanId: accountId,
          },
        });
      } catch (error) {
        if (isUniqueConstraintError(error)) throw employeeCodeExists();
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === 'P2003'
        ) {
          const fieldName = error.meta?.field_name;
          if (typeof fieldName === 'string' && fieldName.includes('nhaXeId')) {
            throw busCompanyNotFound();
          }
        }
        throw error;
      }

      for (const role of roles) {
        await tx.taiKhoanVaiTro.create({
          data: { taiKhoanId: accountId, vaiTroId: role.vaiTroId },
        });
      }
      const created = await tx.taiKhoan.findFirst({
        where: managedAdminAccountWhere(accountId),
        select: ADMIN_ACCOUNT_SELECT,
      });
      if (!created) {
        throw new InternalServerErrorException({
          error: 'ADMIN_ACCOUNT_CREATE_FAILED',
          message: 'Không thể đọc lại tài khoản quản trị nhà xe vừa tạo.',
        });
      }

      return { data: mapAdminAccount(created) };
    });
  }

  async update(taiKhoanId: number, input: UpdateAdminAccountDto) {
    const existing = await this.prisma.taiKhoan.findFirst({
      where: managedAdminAccountWhere(taiKhoanId),
      select: ADMIN_ACCOUNT_SELECT,
    });
    if (!existing) throw accountNotFound();

    const data: Prisma.TaiKhoanUpdateManyMutationInput = {
      ...(input.fullName !== undefined ? { hoTen: input.fullName } : {}),
      ...(input.dateOfBirth !== undefined
        ? { ngaySinh: toDateOnly(input.dateOfBirth) }
        : {}),
      ...(input.email !== undefined ? { email: input.email } : {}),
      ...(input.citizenId !== undefined ? { cccd: input.citizenId } : {}),
    };

    if (Object.keys(data).length === 0) {
      return { data: mapAdminAccount(existing) };
    }

    try {
      const result = await this.prisma.taiKhoan.updateMany({
        where: managedAdminAccountWhere(taiKhoanId),
        data: {
          ...data,
          ...(input.email !== undefined
            ? { email: normalizeEmail(input.email) }
            : {}),
        },
      });
      if (result.count !== 1) throw accountNotFound();
    } catch (error) {
      if (isUniqueConstraintOn(error, 'email')) {
        throw emailAlreadyRegistered();
      }
      throw error;
    }

    return this.findOne(taiKhoanId);
  }

  async updateStatus(taiKhoanId: number, input: UpdateAdminAccountStatusDto) {
    return this.prisma.$transaction(async (tx) => {
      const current = await tx.taiKhoan.findFirst({
        where: managedAdminAccountWhere(taiKhoanId),
        select: { taiKhoanId: true, trangThai: true },
      });
      if (!current) throw accountNotFound();

      if (current.trangThai !== input.status) {
        const updated = await tx.taiKhoan.updateMany({
          where: managedAdminAccountWhere(taiKhoanId),
          data: { trangThai: input.status },
        });
        if (updated.count !== 1) throw accountNotFound();
      }

      if (input.status === 'TAM_KHOA') {
        const lockedAt = new Date();
        await tx.phienDangNhap.updateMany({
          where: {
            taiKhoanId,
            thuHoiLuc: null,
            hetHanLuc: { gt: lockedAt },
          },
          data: { thuHoiLuc: lockedAt },
        });
      }

      const account = await tx.taiKhoan.findFirst({
        where: managedAdminAccountWhere(taiKhoanId),
        select: ADMIN_ACCOUNT_SELECT,
      });
      if (!account) throw accountNotFound();

      return { data: mapAdminAccount(account) };
    });
  }

  async replaceRoles(taiKhoanId: number, roleNames: unknown) {
    const requestedRoleNames = replacementRoleNames(roleNames);

    return this.prisma.$transaction(async (tx) => {
      const lockedAccounts = await tx.$queryRaw<Array<{ taiKhoanId: number }>>`
        SELECT taiKhoanId
        FROM TaiKhoan
        WHERE taiKhoanId = ${taiKhoanId}
        FOR UPDATE
      `;
      if (lockedAccounts.length === 0) throw accountNotFound();

      const managedAccount = await tx.taiKhoan.findFirst({
        where: managedAdminAccountWhere(taiKhoanId),
        select: { taiKhoanId: true },
      });
      if (!managedAccount) throw accountNotFound();

      const roles = requestedRoleNames.length
        ? await tx.vaiTro.findMany({
            where: { tenVaiTro: { in: requestedRoleNames } },
            select: { vaiTroId: true, tenVaiTro: true },
          })
        : [];
      if (roles.length !== requestedRoleNames.length) {
        throw new InternalServerErrorException({
          error: 'AUTH_ROLE_NOT_CONFIGURED',
          message: 'Một hoặc nhiều vai trò nhà xe chưa được cấu hình.',
        });
      }

      await tx.taiKhoanVaiTro.deleteMany({
        where: {
          taiKhoanId,
          vaiTro: {
            is: { tenVaiTro: { in: [...TENANT_PRINCIPAL_ROLES] } },
          },
        },
      });
      for (const role of roles) {
        await tx.taiKhoanVaiTro.create({
          data: { taiKhoanId, vaiTroId: role.vaiTroId },
        });
      }

      const updated = await tx.taiKhoan.findFirst({
        where: managedAdminAccountWhere(taiKhoanId),
        select: ADMIN_ACCOUNT_SELECT,
      });
      if (!updated) throw accountNotFound();

      return { data: mapAdminAccount(updated) };
    });
  }
}
