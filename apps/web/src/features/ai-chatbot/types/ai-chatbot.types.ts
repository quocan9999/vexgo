export interface CitationItem {
  documentCode: string;
  title: string;
  hierarchyPath: string;
  relevanceScore: number;
}

export interface TripSearchResultItem {
  tripId: number;
  code: string;
  operator: string;
  origin: string;
  destination: string;
  departureDate: string;
  departureTime: string;
  arrivalTime: string | null;
  vehicleType: string;
  price: number | null;
  availableSeats: number;
  bookingUrl: string;
}

export interface ChatbotMessageResponse {
  sessionToken: string;
  reply: string;
  intent: string;
  citations: CitationItem[];
  suggestedTrips?: TripSearchResultItem[];
  suggestedReturnTrips?: TripSearchResultItem[];
  isRoundTrip?: boolean;
  roundTripBookingUrl?: string;
  suggestedQuestions?: string[];
  requiresHumanHandoff: boolean;
  handoffReason?: string;
  latencyMs: number;
}

export interface AiChatMessageItem {
  id: string | number;
  text: string;
  sender: 'bot' | 'user';
  time: string;
  citations?: CitationItem[];
  suggestedTrips?: TripSearchResultItem[];
  suggestedReturnTrips?: TripSearchResultItem[];
  isRoundTrip?: boolean;
  roundTripBookingUrl?: string;
  requiresHumanHandoff?: boolean;
  handoffReason?: string;
}

export interface AiSuggestionItem {
  id: string;
  category: string;
  question: string;
  description: string;
}
