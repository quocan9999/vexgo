// frontend/src/modules/client/property/models/property.model.ts

export type NeedType = 'BUY' | 'RENT';

export interface PropertyDemand {
  id: string;
  title: string;
  needType: NeedType;
  propertyType: string;
  price: string;
  minPriceNum?: number;
  maxPriceNum?: number;
  area: string;
  minAreaNum?: number;
  location: string;
  province: string;
  district: string;
  legal?: string;
  direction?: string;
  note?: string;
  description: string;
  timeAgo: string;
  createdAt: string;
  authorName: string;
  authorCode: string;
  authorPhone: string;
  isVerified?: boolean;
}

export interface PropertyFilterState {
  keyword: string;
  needType: 'ALL' | 'BUY' | 'RENT';
  propertyType: string;
  province: string;
  district: string;
  priceRange: string;
  areaRange: string;
  legal: string;
  direction: string;
  sortBy: 'NEWEST' | 'PRICE_ASC' | 'PRICE_DESC' | 'AREA_DESC';
}

export const INITIAL_FILTER_STATE: PropertyFilterState = {
  keyword: '',
  needType: 'ALL',
  propertyType: '',
  province: '',
  district: '',
  priceRange: '',
  areaRange: '',
  legal: '',
  direction: '',
  sortBy: 'NEWEST',
};
