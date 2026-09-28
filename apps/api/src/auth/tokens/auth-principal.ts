export interface AuthPrincipal {
  taiKhoanId: number;
  sessionId: string;
  roles: string[];
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
