export interface AuthPrincipal {
  taiKhoanId: number;
  sessionId: string;
  roles: string[];
  permissions: string[];
  nhanVienId: number | null;
  nhaXeId: number | null;
}

export interface AuthUserSummary {
  accountId: number;
  customerId: number | null;
  fullName: string;
  phoneNumber: string;
  roles: string[];
}

export interface AuthTokenResponse {
  accessToken: string;
  refreshToken: string;
  tokenType: 'Bearer';
  expiresIn: number;
  user: AuthUserSummary;
}
