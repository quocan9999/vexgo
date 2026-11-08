export type AiKnowledgeCategory =
  | 'CHINH_SACH_HOAN_HUY'
  | 'QUY_DINH_HANH_LY'
  | 'THANH_TOAN_GIU_CHO'
  | 'VAN_CHUYEN_HANG_HOA'
  | 'KHUYEN_MAI_LOYALTY'
  | 'FAQ_CHUNG';

export type AiKnowledgeScope = 'GLOBAL' | 'TENANT';

export interface AiKnowledgeChunkItem {
  id: number;
  documentId: number;
  chunkIndex: number;
  headerPrefix: string;
  rawContent: string;
  groundedContent: string;
  embeddingModel: string;
  createdAt: string;
  updatedAt: string;
}

export interface AiKnowledgeDocumentItem {
  id: number;
  documentCode: string;
  title: string;
  category: AiKnowledgeCategory | string;
  scope: AiKnowledgeScope;
  nhaXeId: number | null;
  hierarchyPath: string;
  rawContent: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  _count?: {
    chunks: number;
  };
  chunks?: AiKnowledgeChunkItem[];
  nhaXe?: {
    nhaXeId: number;
    tenNhaXe: string;
  } | null;
}

export interface CitationItem {
  chunkId?: number;
  documentCode: string;
  title: string;
  hierarchyPath: string;
  relevanceScore: number;
}

export interface QueryKnowledgeDocumentsParams {
  page?: number;
  pageSize?: number;
  search?: string;
  keyword?: string;
  category?: string;
  scope?: AiKnowledgeScope;
  nhaXeId?: number;
  isActive?: boolean;
  sortBy?: string;
  sortDirection?: 'asc' | 'desc';
}

export interface PaginatedKnowledgeDocuments {
  data: AiKnowledgeDocumentItem[];
  meta: {
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
  };
}

export interface CreateKnowledgeDocumentInput {
  documentCode?: string;
  title: string;
  category: string;
  scope?: AiKnowledgeScope;
  nhaXeId?: number;
  hierarchyPath: string;
  rawContent: string;
  isActive?: boolean;
}

export interface UpdateKnowledgeDocumentInput {
  title?: string;
  category?: string;
  scope?: AiKnowledgeScope;
  nhaXeId?: number;
  hierarchyPath?: string;
  rawContent?: string;
  isActive?: boolean;
}

export const KNOWLEDGE_CATEGORY_LABELS: Record<string, string> = {
  CHINH_SACH_HOAN_HUY: 'Chính sách hoàn huỷ',
  QUY_DINH_HANH_LY: 'Quy định hành lý',
  THANH_TOAN_GIU_CHO: 'Thanh toán & giữ chỗ',
  VAN_CHUYEN_HANG_HOA: 'Vận chuyển hàng hóa',
  KHUYEN_MAI_LOYALTY: 'Khuyến mãi & điểm thưởng',
  FAQ_CHUNG: 'Hỏi đáp chung (FAQ)',
};

export const KNOWLEDGE_CATEGORY_OPTIONS = [
  { value: 'CHINH_SACH_HOAN_HUY', label: 'Chính sách hoàn huỷ' },
  { value: 'QUY_DINH_HANH_LY', label: 'Quy định hành lý' },
  { value: 'THANH_TOAN_GIU_CHO', label: 'Thanh toán & giữ chỗ' },
  { value: 'VAN_CHUYEN_HANG_HOA', label: 'Vận chuyển hàng hóa' },
  { value: 'KHUYEN_MAI_LOYALTY', label: 'Khuyến mãi & điểm thưởng' },
  { value: 'FAQ_CHUNG', label: 'Hỏi đáp chung (FAQ)' },
];
