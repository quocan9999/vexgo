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

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1';

export const customerApi = {
  async getMe(accessToken: string): Promise<{ data: CustomerProfile }> {
    const res = await fetch(`${API_BASE_URL}/customers/me`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!res.ok) {
      const error = await res.json().catch(() => ({}));
      throw new Error(error.message || 'Lấy thông tin thất bại');
    }

    return res.json();
  },

  async updateMe(accessToken: string, dto: UpdateProfileDto): Promise<{ data: CustomerProfile }> {
    const res = await fetch(`${API_BASE_URL}/customers/me`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(dto),
    });

    if (!res.ok) {
      const error = await res.json().catch(() => ({}));
      throw new Error(error.message || 'Cập nhật thất bại');
    }

    return res.json();
  },
};
