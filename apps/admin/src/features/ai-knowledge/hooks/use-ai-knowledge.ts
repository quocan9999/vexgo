'use client';

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import {
  createKnowledgeDocument,
  deleteKnowledgeDocument,
  getKnowledgeDocuments,
  toggleKnowledgeDocumentStatus,
  updateKnowledgeDocument,
} from '../services/ai-knowledge-service';
import type {
  AiKnowledgeDocumentItem,
  AiKnowledgeScope,
  CreateKnowledgeDocumentInput,
  PaginatedKnowledgeDocuments,
  UpdateKnowledgeDocumentInput,
} from '../types/ai-knowledge';

export interface UseAiKnowledgeOptions {
  isTenantScope?: boolean;
}

export function useAiKnowledge(options?: UseAiKnowledgeOptions) {
  const isTenant = options?.isTenantScope ?? false;
  const [data, setData] = useState<PaginatedKnowledgeDocuments | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<string>('');
  // Với Super Admin: mặc định scope là GLOBAL (chỉ quản lý chính sách toàn sàn)
  // Với Nhà xe: mặc định scope là '' (xem tất cả nguồn: của Super Admin + của nhà xe mình)
  const [scope, setScope] = useState<AiKnowledgeScope | ''>(isTenant ? '' : 'GLOBAL');
  const [isActive, setIsActive] = useState<'' | 'true' | 'false'>('');
  const [page, setPage] = useState(1);
  const [sortBy, setSortBy] = useState('createdAt');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [refreshKey, setRefreshKey] = useState(0);

  // Đồng bộ scope khi vai trò phiên thay đổi
  useEffect(() => {
    if (!isTenant) {
      setScope('GLOBAL');
    }
  }, [isTenant]);

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setPage(1);
      setSearch(searchInput.trim());
      setLoading(true);
    }, searchInput.trim() ? 300 : 0);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const refresh = useCallback(() => {
    setLoading(true);
    setRefreshKey((k) => k + 1);
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;

    getKnowledgeDocuments(
      {
        page,
        pageSize: 10,
        search: search || undefined,
        category: category || undefined,
        scope: (scope as AiKnowledgeScope) || undefined,
        isActive:
          isActive === 'true' ? true : isActive === 'false' ? false : undefined,
        sortBy,
        sortDirection,
      },
      controller.signal,
    )
      .then((res) => {
        if (active) {
          setData(res);
          setError(null);
          setLoading(false);
        }
      })
      .catch((err: unknown) => {
        if (active && !controller.signal.aborted) {
          const msg =
            err instanceof Error ? err.message : 'Không thể tải danh sách tài liệu.';
          setError(msg);
          setLoading(false);
        }
      });

    return () => {
      active = false;
      controller.abort();
    };
  }, [page, search, category, scope, isActive, sortBy, sortDirection, refreshKey]);

  const handleToggleStatus = async (doc: AiKnowledgeDocumentItem) => {
    try {
      await toggleKnowledgeDocumentStatus(doc.id);
      toast.success(
        `Đã ${doc.isActive ? 'tạm ngưng' : 'kích hoạt'} tài liệu [${doc.documentCode}].`,
      );
      refresh();
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : 'Không thể đổi trạng thái tài liệu.';
      toast.error(msg);
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await deleteKnowledgeDocument(id);
      toast.success('Đã xóa tài liệu và các phân đoạn vector thành công.');
      refresh();
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : 'Không thể xóa tài liệu.';
      toast.error(msg);
    }
  };

  const handleCreate = async (input: CreateKnowledgeDocumentInput) => {
    try {
      const created = await createKnowledgeDocument(input);
      toast.success(
        `Đã tạo tài liệu [${created.documentCode}] và đánh chỉ mục vector thành công!`,
      );
      refresh();
      return created;
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : 'Không thể tạo mới tài liệu.';
      toast.error(msg);
      throw err;
    }
  };

  const handleUpdate = async (
    id: number,
    input: UpdateKnowledgeDocumentInput,
  ) => {
    try {
      const updated = await updateKnowledgeDocument(id, input);
      toast.success(`Đã cập nhật tài liệu [${updated.documentCode}] thành công!`);
      refresh();
      return updated;
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : 'Không thể cập nhật tài liệu.';
      toast.error(msg);
      throw err;
    }
  };

  return {
    documents: data?.data ?? [],
    meta: data?.meta ?? { page: 1, pageSize: 10, totalItems: 0, totalPages: 1 },
    loading,
    error,
    searchInput,
    setSearchInput,
    category,
    setCategory: (val: string) => {
      setLoading(true);
      setPage(1);
      setCategory(val);
    },
    scope,
    setScope: (val: AiKnowledgeScope | '') => {
      setLoading(true);
      setPage(1);
      setScope(val);
    },
    isActive,
    setIsActive: (val: '' | 'true' | 'false') => {
      setLoading(true);
      setPage(1);
      setIsActive(val);
    },
    page,
    setPage: (p: number) => {
      setLoading(true);
      setPage(p);
    },
    sortBy,
    setSortBy,
    sortDirection,
    setSortDirection,
    refresh,
    handleToggleStatus,
    handleDelete,
    handleCreate,
    handleUpdate,
  };
}
