import type { TenantRbacRoleName } from '@/features/tenant-rbac/types/tenant-rbac';

export const ADMIN_ACCOUNT_STATUSES = ['HOAT_DONG', 'TAM_KHOA'] as const;
export type AdminAccountStatus = (typeof ADMIN_ACCOUNT_STATUSES)[number];

export const ADMIN_ACCOUNT_SORT_KEYS = [
  'fullName',
  'phoneNumber',
  'status',
  'createdAt',
  'updatedAt',
] as const;
export type AdminAccountSortKey = (typeof ADMIN_ACCOUNT_SORT_KEYS)[number];
export type AdminAccountSortDirection = 'asc' | 'desc';

export type AdminAccount = {
  accountId: number;
  fullName: string;
  phoneNumber: string;
  dateOfBirth: string | null;
  citizenId: string | null;
  email: string | null;
  phoneVerified: boolean;
  status: AdminAccountStatus;
  roles: TenantRbacRoleName[];
  employee: {
    employeeId: number;
    employeeCode: string;
    employmentStatus: string;
  };
  busCompany: {
    busCompanyId: number;
    code: string;
    name: string;
    status: 'HOAT_DONG' | 'TAM_NGUNG';
  };
  createdAt: string;
  updatedAt: string;
};

export type AdminAccountListQuery = {
  page: number;
  pageSize: number;
  search: string;
  sortBy: AdminAccountSortKey;
  sortDirection: AdminAccountSortDirection;
  status?: AdminAccountStatus;
  busCompanyId?: number;
  roleName?: TenantRbacRoleName;
  createdFrom?: string;
  createdTo?: string;
};

export type PaginatedAdminAccounts = {
  data: AdminAccount[];
  meta: {
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
  };
};

export type CreateAdminAccountInput = {
  fullName: string;
  phoneNumber: string;
  password: string;
  busCompanyId: number;
  employeeCode: string;
  roleNames: readonly TenantRbacRoleName[];
  dateOfBirth?: string | null;
  email?: string | null;
  citizenId?: string | null;
};

export type UpdateAdminAccountInput = {
  fullName?: string;
  dateOfBirth?: string | null;
  email?: string | null;
  citizenId?: string | null;
};
