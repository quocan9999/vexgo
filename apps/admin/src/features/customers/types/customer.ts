export type CustomerAccountStatus = 'HOAT_DONG' | 'TAM_KHOA';

export interface CustomerAccount {
  accountId: number;
  status: CustomerAccountStatus;
  phoneVerified: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface CustomerSummary {
  customerId: number;
  customerCode: string;
  fullName: string;
  phoneNumber: string;
  email: string | null;
  loyaltyPoints: number;
  account: CustomerAccount;
  createdAt: string;
  updatedAt: string;
}

export interface CustomerDetail extends CustomerSummary {
  account: CustomerAccount & {
    createdAt: string;
    updatedAt: string;
  };
}

export type CustomerSortKey =
  | 'customerCode'
  | 'fullName'
  | 'loyaltyPoints'
  | 'createdAt'
  | 'updatedAt';

export interface CustomerQuery {
  page?: number;
  pageSize?: number;
  search?: string;
  accountStatus?: CustomerAccountStatus;
  sortBy?: CustomerSortKey;
  sortDirection?: 'asc' | 'desc';
}

export interface CustomerPageResponse {
  data: CustomerSummary[];
  meta: {
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
  };
}

export interface CustomerDetailResponse {
  data: CustomerDetail;
}
