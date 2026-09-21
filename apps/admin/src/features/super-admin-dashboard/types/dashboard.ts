export type AccountStatus = 'ACTIVE' | 'INACTIVE';

export type DashboardOverview = {
  generatedAt: string;
  totals: {
    busCompanies: number;
    operatorAdminAccounts: number;
    customerAccounts: number;
    accounts: number;
  };
  accountsByRole: Array<{
    roleId: string;
    roleName: string;
    assignedAccountCount: number;
  }>;
  accountsByStatus: Array<{
    status: AccountStatus;
    label: string;
    count: number;
  }>;
};

export type BusCompany = {
  busCompanyId: string;
  name: string;
  contactInfo: string;
  operatorAdminAccountCount: number;
  /** Counts all employee accounts for the company, including operator admins. */
  employeeAccountCount: number;
  routeCount: number;
};

export type CompanySortKey =
  'name' | 'operatorAdminAccountCount' | 'employeeAccountCount' | 'routeCount';

export type SortDirection = 'asc' | 'desc';

export type CompanyListQuery = {
  search: string;
  page: number;
  pageSize: number;
  sortBy: CompanySortKey;
  sortDirection: SortDirection;
};

export type PaginatedBusCompanies = {
  items: BusCompany[];
  meta: {
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
  };
};
