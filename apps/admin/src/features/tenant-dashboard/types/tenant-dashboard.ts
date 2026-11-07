export interface OperationalMetrics {
  totalTripsToday: number;
  preparingTrips: number;
  runningTrips: number;
  completedTrips: number;
  cancelledTrips: number;
  bookedTicketsToday: number;
  totalSeatsToday: number;
  loadFactorPercent: number;
  totalShipmentsToday: number;
  unassignedShipmentsToday: number;
  estimatedRevenueToday: number;
}

export interface UpcomingTripItem {
  tripId: number;
  tripCode: string;
  departureDate: string;
  departureTime: string;
  routeName: string;
  departureLocation: string;
  arrivalLocation: string;
  licensePlate: string;
  vehicleTypeName: string;
  bookedSeats: number;
  totalSeats: number;
  loadFactorPercent: number;
  status: string;
}

export interface UrgentAlerts {
  pendingBookingsCount: number;
  unassignedShipmentsCount: number;
  departingSoonLowOccupancyCount: number;
}

export interface TenantDashboardOverview {
  businessDate: string;
  timeZone: string;
  metrics: OperationalMetrics;
  upcomingTrips: UpcomingTripItem[];
  urgentAlerts: UrgentAlerts;
}
