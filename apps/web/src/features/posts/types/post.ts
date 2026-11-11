/* eslint-disable */
export type NeedType = 'BUY' | 'RENT';

export interface PostStopPoint {
  id: string;
  name: string;
  time?: string;
  address: string;
  type?: string;
  isDefault?: boolean;
}

export interface Post {
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
  pickupPoints?: PostStopPoint[];
  dropoffPoints?: PostStopPoint[];
}

export interface PostFilterState {
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

export const INITIAL_POST_FILTER_STATE: PostFilterState = {
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
