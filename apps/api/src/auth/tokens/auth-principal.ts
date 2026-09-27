export interface AuthPrincipal {
  taiKhoanId: number;
  sessionId: string;
  roles: string[];
}

export interface AuthUserSummary {
  taiKhoanId: number;
  khachHangId: number;
  hoTen: string;
  soDienThoai: string;
  roles: string[];
}

export interface AuthTokenResponse {
  accessToken: string;
  refreshToken: string;
  tokenType: 'Bearer';
  expiresIn: number;
  user: AuthUserSummary;
}
