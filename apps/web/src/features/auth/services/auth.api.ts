export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1';

export class ApiError extends Error {
  constructor(public status: number, public error: string, message: string) {
    super(message);
    this.name = 'ApiError';
  }
}

// Hàm chuẩn hóa số điện thoại Việt Nam (09... -> +849...)
function formatPhone(phone: string) {
  const cleaned = phone.replace(/\D/g, ''); // Xóa các ký tự không phải số
  if (cleaned.startsWith('0')) return '+84' + cleaned.slice(1);
  if (cleaned.startsWith('84')) return '+' + cleaned;
  return phone;
}

export const authApi = {
  async login(phone: string, password: string) {
    const formattedPhone = formatPhone(phone);
    const response = await fetch(`${API_BASE_URL}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ phoneNumber: formattedPhone, password }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new ApiError(
        response.status,
        errorData.error || 'UNKNOWN_ERROR',
        errorData.message || 'Đã có lỗi xảy ra khi đăng nhập'
      );
    }

    return response.json();
  },

  async requestOtp(phone: string) {
    const formattedPhone = formatPhone(phone);
    const response = await fetch(`${API_BASE_URL}/auth/register/request-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phoneNumber: formattedPhone }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new ApiError(
        response.status,
        errorData.error || 'UNKNOWN_ERROR',
        errorData.message || 'Đã có lỗi xảy ra khi yêu cầu OTP'
      );
    }

    return response.json();
  },

  async verifyOtp(phone: string, challengeId: string, otp: string) {
    const formattedPhone = formatPhone(phone);
    const response = await fetch(`${API_BASE_URL}/auth/register/verify-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phoneNumber: formattedPhone, challengeId, otp }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new ApiError(
        response.status,
        errorData.error || 'UNKNOWN_ERROR',
        errorData.message || 'Mã OTP không hợp lệ'
      );
    }

    return response.json();
  },

  async register(data: { phoneNumber: string; password: string; fullName: string; otpProof: string }) {
    const payload = { ...data, phoneNumber: formatPhone(data.phoneNumber) };
    const response = await fetch(`${API_BASE_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new ApiError(
        response.status,
        errorData.error || 'UNKNOWN_ERROR',
        errorData.message || 'Đã có lỗi xảy ra khi đăng ký'
      );
    }

    return response.json();
  }
};
