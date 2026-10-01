import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { describe, expect, it } from 'vitest';
import { AdminAccountIdParamsDto } from '../../../src/admin-accounts/dto/admin-account-id-params.dto.js';
import { AdminAccountQueryDto } from '../../../src/admin-accounts/dto/admin-account-query.dto.js';
import { CreateAdminAccountDto } from '../../../src/admin-accounts/dto/create-admin-account.dto.js';
import { UpdateAdminAccountDto } from '../../../src/admin-accounts/dto/update-admin-account.dto.js';
import { UpdateAdminAccountStatusDto } from '../../../src/admin-accounts/dto/update-admin-account-status.dto.js';
import { UpdateAdminAccountRolesDto } from '../../../src/admin-accounts/dto/update-admin-account-roles.dto.js';

const validationOptions = {
  whitelist: true,
  forbidNonWhitelisted: true,
};

const validCreateInput = {
  fullName: 'Nguyễn Minh Anh',
  phoneNumber: '+84901234567',
  password: 'VexGo@123',
  busCompanyId: '12',
  employeeCode: 'FUTA-NV-0001',
  dateOfBirth: '1990-02-28',
  email: 'admin@example.com',
  citizenId: '079123456789',
};

describe('Admin account DTO validation', () => {
  it('accepts valid provisioning data and transforms the assigned company ID', async () => {
    const dto = plainToInstance(CreateAdminAccountDto, validCreateInput);

    await expect(validate(dto, validationOptions)).resolves.toEqual([]);
    expect(dto.busCompanyId).toBe(12);
  });

  it('accepts one or more explicit tenant roles when creating an account', async () => {
    const dto = plainToInstance(CreateAdminAccountDto, {
      ...validCreateInput,
      roleNames: ['NHAN_VIEN_BAN_VE', 'NHAN_VIEN_CSKH'],
    });

    await expect(validate(dto, validationOptions)).resolves.toEqual([]);
  });

  it.each([
    ['empty list', []],
    ['null', null],
    ['non-array', 'NHAN_VIEN_BAN_VE'],
    ['platform role', ['SUPER_ADMIN']],
    ['customer role', ['KHACH_HANG']],
    ['unknown role', ['NOT_A_ROLE']],
    ['duplicate roles', ['NHA_XE_ADMIN', 'NHA_XE_ADMIN']],
    ['mixed tenant and customer roles', ['NHA_XE_ADMIN', 'KHACH_HANG']],
  ])('rejects %s for create roleNames', async (_name, roleNames) => {
    const dto = plainToInstance(CreateAdminAccountDto, {
      ...validCreateInput,
      roleNames,
    });
    const errors = await validate(dto, validationOptions);

    expect(errors.map(({ property }) => property)).toContain('roleNames');
  });

  it.each([
    'role',
    'roles',
    'status',
    'phoneVerified',
    'employmentStatus',
    'permissions',
  ])('rejects client controlled field %s during creation', async (field) => {
    const dto = plainToInstance(CreateAdminAccountDto, {
      ...validCreateInput,
      [field]: 'SUPER_ADMIN',
    });
    const errors = await validate(dto, validationOptions);

    expect(errors.map(({ property }) => property)).toContain(field);
  });

  it.each([
    ['invalid phone', { phoneNumber: '0901234567' }],
    ['invalid company ID', { busCompanyId: '12.5' }],
    ['empty employee code', { employeeCode: '' }],
    ['invalid date', { dateOfBirth: '2026-02-30' }],
    ['invalid email', { email: 'not-an-email' }],
    ['invalid citizen ID', { citizenId: '123' }],
    ['short password', { password: '1234567' }],
    ['long UTF-8 password', { password: 'ậ'.repeat(25) }],
  ])('rejects %s in creation data', async (_name, override) => {
    const dto = plainToInstance(CreateAdminAccountDto, {
      ...validCreateInput,
      ...override,
    });
    const errors = await validate(dto, validationOptions);

    expect(errors.length).toBeGreaterThan(0);
  });

  it('allows explicit null to clear optional profile fields', async () => {
    const dto = plainToInstance(UpdateAdminAccountDto, {
      dateOfBirth: null,
      email: null,
      citizenId: null,
    });

    await expect(validate(dto, validationOptions)).resolves.toEqual([]);
  });

  it.each([
    'phoneNumber',
    'password',
    'busCompanyId',
    'employeeCode',
    'roles',
    'status',
    'permissions',
  ])(
    'rejects immutable or lifecycle field %s in profile updates',
    async (field) => {
      const dto = plainToInstance(UpdateAdminAccountDto, {
        [field]: 'changed',
      });
      const errors = await validate(dto, validationOptions);

      expect(errors.map(({ property }) => property)).toContain(field);
    },
  );

  it.each(['HOAT_DONG', 'TAM_KHOA'])(
    'accepts account status %s',
    async (status) => {
      const dto = plainToInstance(UpdateAdminAccountStatusDto, { status });
      await expect(validate(dto, validationOptions)).resolves.toEqual([]);
    },
  );

  it('rejects unsupported account statuses', async () => {
    const dto = plainToInstance(UpdateAdminAccountStatusDto, {
      status: 'DA_XOA',
    });
    const errors = await validate(dto, validationOptions);

    expect(errors.map(({ property }) => property)).toContain('status');
  });

  it('requires an explicit tenant-role list for role replacement, including an empty list', async () => {
    const valid = plainToInstance(UpdateAdminAccountRolesDto, {
      roleNames: ['NHA_XE_ADMIN', 'NHAN_VIEN_BAN_VE'],
    });
    await expect(validate(valid, validationOptions)).resolves.toEqual([]);

    const revokeAll = plainToInstance(UpdateAdminAccountRolesDto, {
      roleNames: [],
    });
    await expect(validate(revokeAll, validationOptions)).resolves.toEqual([]);
  });

  it.each([
    ['missing', {}],
    ['null', { roleNames: null }],
    ['non-array', { roleNames: 'NHA_XE_ADMIN' }],
    ['platform role', { roleNames: ['SUPER_ADMIN'] }],
    ['customer role', { roleNames: ['KHACH_HANG'] }],
    ['unknown role', { roleNames: ['NOT_A_ROLE'] }],
    ['duplicate role', { roleNames: ['NHA_XE_ADMIN', 'NHA_XE_ADMIN'] }],
    ['non-string entry', { roleNames: ['NHA_XE_ADMIN', 42] }],
  ])('rejects %s in role replacement', async (_name, body) => {
    const dto = plainToInstance(UpdateAdminAccountRolesDto, body);
    const errors = await validate(dto, validationOptions);

    expect(errors.map(({ property }) => property)).toContain('roleNames');
  });

  it.each(['vaiTroId', 'roles', 'permissions', 'busCompanyId'])(
    'rejects client-controlled field %s in role replacement',
    async (field) => {
      const dto = plainToInstance(UpdateAdminAccountRolesDto, {
        roleNames: ['NHA_XE_ADMIN'],
        [field]: field === 'vaiTroId' ? 1 : 'SUPER_ADMIN',
      });
      const errors = await validate(dto, validationOptions);

      expect(errors.map(({ property }) => property)).toContain(field);
    },
  );

  it('transforms list filters and rejects malformed company IDs', async () => {
    const dto = plainToInstance(AdminAccountQueryDto, {
      page: '2',
      pageSize: '20',
      busCompanyId: '12',
      status: 'TAM_KHOA',
      roleName: 'NHAN_VIEN_CSKH',
      createdFrom: '2026-09-01',
      createdTo: '2026-09-30',
      sortBy: 'fullName',
      sortDirection: 'desc',
    });

    await expect(validate(dto, validationOptions)).resolves.toEqual([]);
    expect(dto.busCompanyId).toBe(12);
    expect(dto.roleName).toBe('NHAN_VIEN_CSKH');

    const invalid = plainToInstance(AdminAccountQueryDto, {
      busCompanyId: '1.2',
    });
    const errors = await validate(invalid, validationOptions);
    expect(errors.map(({ property }) => property)).toContain('busCompanyId');
  });

  it.each([
    ['unknown role', { roleName: 'SUPER_ADMIN' }],
    ['invalid creation date', { createdFrom: '2026-02-30' }],
    [
      'reversed creation range',
      { createdFrom: '2026-09-30', createdTo: '2026-09-01' },
    ],
  ])('rejects an invalid account-list filter: %s', async (_label, filter) => {
    const dto = plainToInstance(AdminAccountQueryDto, filter);

    const errors = await validate(dto, validationOptions);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('transforms only positive integer account IDs', async () => {
    const valid = plainToInstance(AdminAccountIdParamsDto, { id: '42' });
    await expect(validate(valid, validationOptions)).resolves.toEqual([]);
    expect(valid.id).toBe(42);

    const invalid = plainToInstance(AdminAccountIdParamsDto, { id: '4.2' });
    const errors = await validate(invalid, validationOptions);
    expect(errors.map(({ property }) => property)).toContain('id');
  });
});
