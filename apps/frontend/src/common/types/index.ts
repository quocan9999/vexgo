// frontend/src/common/types/index.ts
import { PostStatus, PropertyType, NeedType, MemberStatus } from '../../config/enums';

export interface UserProfile {
  id: string;
  memberCode: string;
  fullName: string;
  phone: string;
  email?: string;
  address?: string;
  avatarUrl?: string;
  status: MemberStatus;
  createdAt: string;
}

export interface PostItem {
  id: string;
  title: string;
  description: string;
  needType: NeedType;
  propertyType: PropertyType;
  provinceCode?: string;
  districtCode?: string;
  wardCode?: string;
  location: string;
  minPrice: number;
  maxPrice: number;
  priceDisplay: string;
  areaDisplay: string;
  minArea?: number;
  maxArea?: number;
  contactName: string;
  contactPhone: string;
  contactZalo?: string;
  status: PostStatus;
  rejectReason?: string;
  viewsCount: number;
  createdAt: string;
  authorId: string;
}

export interface ContactSubmission {
  fullName: string;
  phone: string;
  email?: string;
  subject: string;
  message: string;
}

export interface ApiResponse<T> {
  success: boolean;
  message?: string;
  data: T;
  total?: number;
  page?: number;
  limit?: number;
}
