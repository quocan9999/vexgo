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
