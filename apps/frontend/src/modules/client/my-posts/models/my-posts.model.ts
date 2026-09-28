// /src/modules/client/my-posts/models/my-posts.model.ts

export type MyPostStatus =
  | 'DRAFT'
  | 'PENDING'
  | 'APPROVED'
  | 'REJECTED'
  | 'HIDDEN'
  | 'EXPIRED'
  | 'COMPLETED';

export type MyPostNeedType = 'BUY' | 'RENT';

export interface MyPostItem {
  id: string;
  title: string;
  needType: MyPostNeedType;
  propertyType: string;
  location: string;
  priceRange: string;
  areaRange: string;
  createdAt: string;
  updatedAt?: string;
  status: MyPostStatus;
  rejectReason?: string;
  description: string;
  contactName: string;
  contactPhone: string;
  viewsCount?: number;
}
