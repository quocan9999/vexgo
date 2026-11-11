const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1';

export interface CreateContactPayload {
  fullName: string;
  phoneNumber: string;
  email?: string;
  subject: string;
  message: string;
}

export interface ContactItem {
  contactId: number;
  fullName: string;
  phoneNumber: string;
  email: string | null;
  subject: string;
  message: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export const contactApi = {
  async submitContact(payload: CreateContactPayload): Promise<{ data: ContactItem }> {
    const res = await fetch(`${API_BASE_URL}/contacts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || 'Gửi yêu cầu liên hệ thất bại.');
    }

    return res.json();
  },
};
