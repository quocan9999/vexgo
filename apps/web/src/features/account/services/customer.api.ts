export type CustomerProfile = {
  accountId: number;
  customerId: number;
  customerCode: string;
  loyaltyPoints: number;
  fullName: string;
  phoneNumber: string;
  dateOfBirth: string | null;
  citizenId: string | null;
  email: string | null;
  phoneVerified: boolean;
  status: string;
  createdAt: string;
};

export type UpdateProfileDto = {
  fullName?: string;
  dateOfBirth?: string | null;
  email?: string | null;
  citizenId?: string | null;
};

export class ApiError extends Error {
  constructor(message: string, public status: number) {
    super(message);
    this.name = 'ApiError';
  }
}

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1';

export const customerApi = {
  async getMe(accessToken: string): Promise<{ data: CustomerProfile }> {
    const res = await fetch(`${API_BASE_URL}/me`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!res.ok) {
      const error = await res.json().catch(() => ({}));
      throw new ApiError(error.message || 'Lấy thông tin thất bại', res.status);
    }

    return res.json();
  },

  async updateMe(
    accessToken: string,
    dto: UpdateProfileDto,
  ): Promise<{ data: CustomerProfile }> {
    const res = await fetch(`${API_BASE_URL}/me`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(dto),
    });

    if (!res.ok) {
      const error = await res.json().catch(() => ({}));
      throw new ApiError(error.message || 'Cập nhật thất bại', res.status);
    }

    return res.json();
  },
};

export const authApi = {
  async refresh(refreshToken: string): Promise<{ data: { accessToken: string; refreshToken: string; } }> {
    const res = await fetch(`${API_BASE_URL}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });
    if (!res.ok) {
      throw new ApiError('Phiên đăng nhập hết hạn', 401);
    }
    return res.json();
  }
};
