const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1';

export type ReviewReply = {
  content: string;
  createdAt: string | null;
  responderName: string;
};

export type ReviewItem = {
  id: number;
  rating: number;
  comment: string | null;
  customerName: string;
  createdAt: string;
  isEdited?: boolean;
  isEditable?: boolean;
  tripDate?: string | null;
  tripTime?: string | null;
  tripCode?: string | null;
  routeName?: string | null;
  reply?: ReviewReply | null;
};

export type ReviewsResponse = {
  rating: number | null;
  reviewsCount: number;
  reviews: ReviewItem[];
};

export type CreateReviewPayload = {
  tripId: number;
  rating: number;
  comment?: string;
};

export type UpdateReviewPayload = {
  rating?: number;
  comment?: string;
};

export const reviewsApi = {
  async createReview(
    accessToken: string,
    payload: CreateReviewPayload,
  ): Promise<{ data: ReviewItem }> {
    const res = await fetch(`${API_BASE_URL}/reviews`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const error = await res.json().catch(() => ({}));
      throw new Error(error.message || 'Gửi đánh giá không thành công.');
    }

    return res.json();
  },

  async getBusCompanyReviews(
    busCompanyId: number,
  ): Promise<{ data: ReviewsResponse }> {
    const res = await fetch(
      `${API_BASE_URL}/reviews/bus-companies/${busCompanyId}`,
    );
    if (!res.ok) {
      return { data: { rating: null, reviewsCount: 0, reviews: [] } };
    }
    return res.json();
  },

  async getTripReviews(tripId: number): Promise<{ data: ReviewsResponse }> {
    const res = await fetch(`${API_BASE_URL}/reviews/trips/${tripId}`);
    if (!res.ok) {
      return { data: { rating: null, reviewsCount: 0, reviews: [] } };
    }
    return res.json();
  },

  async getMyReviews(
    accessToken: string,
  ): Promise<{ data: { reviews: (ReviewItem & { tripId: number })[] } }> {
    const res = await fetch(`${API_BASE_URL}/reviews/my`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });
    if (!res.ok) {
      return { data: { reviews: [] } };
    }
    return res.json();
  },

  async deleteTripReview(
    accessToken: string,
    tripId: number,
  ): Promise<{ data: { success: boolean; message: string } }> {
    const res = await fetch(`${API_BASE_URL}/reviews/trip/${tripId}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || 'Không thể xóa đánh giá.');
    }
    return res.json();
  },

  async deleteReview(
    accessToken: string,
    reviewId: number,
  ): Promise<{ data: { success: boolean; message: string } }> {
    const res = await fetch(`${API_BASE_URL}/reviews/${reviewId}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || 'Không thể xóa đánh giá.');
    }
    return res.json();
  },

  async updateTripReview(
    accessToken: string,
    tripId: number,
    payload: UpdateReviewPayload,
  ): Promise<{ data: { success: boolean; message: string; review: any } }> {
    const res = await fetch(`${API_BASE_URL}/reviews/trip/${tripId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || 'Không thể cập nhật đánh giá.');
    }
    return res.json();
  },

  async updateReview(
    accessToken: string,
    reviewId: number,
    payload: UpdateReviewPayload,
  ): Promise<{ data: { success: boolean; message: string; review: any } }> {
    const res = await fetch(`${API_BASE_URL}/reviews/${reviewId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || 'Không thể cập nhật đánh giá.');
    }
    return res.json();
  },
};
