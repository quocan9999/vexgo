export type CustomerActivityStatus =
  | 'DRAFT'
  | 'PENDING'
  | 'APPROVED'
  | 'REJECTED'
  | 'HIDDEN'
  | 'EXPIRED'
  | 'COMPLETED';

export type CustomerActivityKind = 'BUY' | 'RENT';

export interface CustomerActivity {
  id: string;
  title: string;
  needType: CustomerActivityKind;
  propertyType: string;
  location: string;
  priceRange: string;
  areaRange: string;
  createdAt: string;
  updatedAt?: string;
  status: CustomerActivityStatus;
  rejectReason?: string;
  description: string;
  contactName: string;
  contactPhone: string;
  viewsCount?: number;
}
