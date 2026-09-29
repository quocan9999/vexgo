import { Trip } from './trips.mock';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1';

export const tripsApi = {
  async searchTrips(origin: string, destination: string, date: string): Promise<Trip[]> {
    const query = new URLSearchParams();
    if (origin) query.set('origin', origin);
    if (destination) query.set('destination', destination);
    if (date) query.set('date', date);

    const res = await fetch(`${API_BASE_URL}/trips/search?${query.toString()}`);
    if (!res.ok) {
      throw new Error('Failed to fetch trips');
    }
    const json = await res.json();
    return json.data || [];
  },

  async getTripDetails(tripId: number): Promise<Trip | null> {
    const res = await fetch(`${API_BASE_URL}/trips/${tripId}`);
    if (!res.ok) {
      if (res.status === 404) return null;
      throw new Error('Failed to fetch trip details');
    }
    const json = await res.json();
    return json.data;
  },
  
  async getTripSeats(tripId: number) {
    const res = await fetch(`${API_BASE_URL}/trips/${tripId}/seats`);
    if (!res.ok) {
      throw new Error('Failed to fetch trip seats');
    }
    const json = await res.json();
    return json.data;
  }
};
