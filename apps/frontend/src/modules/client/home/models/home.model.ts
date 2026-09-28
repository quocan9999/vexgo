// frontend/src/modules/client/home/models/home.model.ts

export interface CategoryItem {
  id: string;
  title: string;
  desc: string;
  icon: React.ReactNode;
  bgGradient: string;
}

export interface DemandPostItem {
  id: string;
  title: string;
  needType: 'BUY' | 'RENT';
  propertyType: string;
  price: string;
  area: string;
  location: string;
  timeAgo: string;
  contactPhone?: string;
}
