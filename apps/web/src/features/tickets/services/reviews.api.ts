const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1';

export type ReviewItem = {
  id: number;
  rating: number;
  comment: string | null;
  customerName: string;
  createdAt: string;
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
};
