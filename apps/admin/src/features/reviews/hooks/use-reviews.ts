/* eslint-disable react-hooks/set-state-in-effect */
'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { useAdminSession } from '@/features/admin-auth/hooks/use-admin-session';
import { getRoutes } from '@/features/routes/services/route-service';
import { getBusCompanies } from '@/features/bus-companies/services/bus-company-service';
import {
  getAdminReviews,
  getAdminReviewStats,
  replyAdminReview,
  ReviewApiError,
  updateAdminReviewStatus,
} from '../services/reviews-service';
import type {
  AdminReviewItem,
  AdminReviewSortKey,
  AdminReviewStats,
  PaginationMeta,
  ReviewStatus,
} from '../types/review';

export function useReviews() {
  const authState = useAdminSession();
  const session =
    authState.status === 'authenticated' ? authState.session : null;
  const isSuperAdmin = Boolean(
    session &&
      (session.busCompanyId === null || session.roles.includes('SUPER_ADMIN')),
  );

  const [reviews, setReviews] = useState<AdminReviewItem[]>([]);
  const [stats, setStats] = useState<AdminReviewStats | null>(null);
  const [meta, setMeta] = useState<PaginationMeta>({
    page: 1,
    pageSize: 10,
    totalItems: 0,
    totalPages: 1,
  });

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [searchInput, setSearchInput] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [ratingFilter, setRatingFilter] = useState<number | undefined>(undefined);
  const [statusFilter, setStatusFilter] = useState<ReviewStatus | undefined>(
    undefined,
  );
  const [busCompanyFilter, setBusCompanyFilter] = useState<number | undefined>(
    undefined,
  );
  const [routeFilter, setRouteFilter] = useState<number | undefined>(undefined);
  const [hasCommentFilter, setHasCommentFilter] = useState<
    'ALL' | 'WITH_COMMENT' | 'WITHOUT_COMMENT' | undefined
  >(undefined);
  const [timeRangeFilter, setTimeRangeFilter] = useState<
    'ALL' | '7_DAYS' | '30_DAYS' | 'THIS_MONTH' | undefined
  >(undefined);

  const [routeOptions, setRouteOptions] = useState<
    Array<{ value: string; label: string }>
  >([]);
  const [busCompanyOptions, setBusCompanyOptions] = useState<
    Array<{ value: string; label: string }>
  >([]);

  const [page, setPage] = useState(1);
  const [sortBy, setSortBy] = useState<AdminReviewSortKey>('thoiGian');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  // Confirmation modal state for moderating review
  const [moderatingReview, setModeratingReview] =
    useState<AdminReviewItem | null>(null);
  const [modifyingStatus, setModifyingStatus] = useState(false);

  // Reply modal state for bus company replies
  const [replyingReview, setReplyingReview] =
    useState<AdminReviewItem | null>(null);
  const [replyText, setReplyText] = useState('');
  const [submittingReply, setSubmittingReply] = useState(false);

  // Fetch routes catalog once on mount
  useEffect(() => {
    let active = true;
    getRoutes({
      page: 1,
      pageSize: 100,
      search: '',
      sortBy: 'origin',
      sortDirection: 'asc',
      status: 'HOAT_DONG',
    })
      .then((res) => {
        if (!active) return;
        const options = res.data.map((r) => ({
          value: String(r.routeId),
          label: `${r.origin} - ${r.destination}`,
        }));
        setRouteOptions(options);
      })
      .catch(() => {
        // Silent catch for routes catalog
      });
    return () => {
      active = false;
    };
  }, []);

  // Fetch bus companies catalog once on mount (only for Super Admin)
  useEffect(() => {
    if (!isSuperAdmin) {
      setBusCompanyOptions([]);
      return;
    }
    let active = true;
    getBusCompanies({
      page: 1,
      pageSize: 100,
      search: '',
      sortBy: 'name',
      sortDirection: 'asc',
      status: 'HOAT_DONG',
    })
      .then((res) => {
        if (!active) return;
        const options = res.data.map((b) => ({
          value: String(b.busCompanyId),
          label: b.name,
        }));
        setBusCompanyOptions(options);
      })
      .catch(() => {
        // Silent catch for bus companies catalog
      });
    return () => {
      active = false;
    };
  }, [isSuperAdmin]);

  // Debounce search input (350ms)
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchInput);
      setPage(1);
    }, 350);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const abortControllerRef = useRef<AbortController | null>(null);

  const fetchData = useCallback(
    async (isManualRefresh = false) => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      const controller = new AbortController();
      abortControllerRef.current = controller;

      if (isManualRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setError(null);

      try {
        const effectiveBusCompanyId = isSuperAdmin ? busCompanyFilter : undefined;
        const [reviewsRes, statsRes] = await Promise.all([
          getAdminReviews(
            {
              page,
              pageSize: 10,
              search: debouncedSearch,
              rating: ratingFilter,
              status: statusFilter,
              busCompanyId: effectiveBusCompanyId,
              routeId: routeFilter,
              hasComment: hasCommentFilter,
              timeRange: timeRangeFilter,
              sortBy,
              sortDirection,
            },
            controller.signal,
          ),
          getAdminReviewStats(effectiveBusCompanyId, controller.signal),
        ]);

        setReviews(reviewsRes.data);
        setMeta(reviewsRes.meta);
        setStats(statsRes.data);
      } catch (err: unknown) {
        if (err instanceof Error && err.name === 'AbortError') {
          return;
        }
        const message =
          err instanceof ReviewApiError
            ? err.message
            : 'Đã xảy ra lỗi khi tải danh sách đánh giá.';
        setError(message);
        toast.error(message);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [
      page,
      debouncedSearch,
      ratingFilter,
      statusFilter,
      busCompanyFilter,
      routeFilter,
      hasCommentFilter,
      timeRangeFilter,
      sortBy,
      sortDirection,
      isSuperAdmin,
    ],
  );

  useEffect(() => {
    fetchData();
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [fetchData]);

  const handleSort = (key: AdminReviewSortKey) => {
    if (sortBy === key) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortBy(key);
      setSortDirection('desc');
    }
    setPage(1);
  };

  const handleToggleStatus = async () => {
    if (!moderatingReview) return;
    const targetStatus: ReviewStatus =
      moderatingReview.status === 'HIEN_THI' ? 'DA_AN' : 'HIEN_THI';

    setModifyingStatus(true);
    try {
      const response = await updateAdminReviewStatus(
        moderatingReview.id,
        targetStatus,
      );
      toast.success(response.message);
      setModeratingReview(null);
      // Refresh current list and stats
      await fetchData(true);
    } catch (err: unknown) {
      const message =
        err instanceof ReviewApiError
          ? err.message
          : 'Không thể cập nhật trạng thái đánh giá.';
      toast.error(message);
    } finally {
      setModifyingStatus(false);
    }
  };

  const openReplyModal = (review: AdminReviewItem) => {
    setReplyingReview(review);
    setReplyText(review.reply?.content || '');
  };

  const closeReplyModal = () => {
    setReplyingReview(null);
    setReplyText('');
  };

  const handleSaveReply = async () => {
    if (!replyingReview) return;
    if (!replyText.trim()) {
      toast.error('Vui lòng nhập nội dung phản hồi.');
      return;
    }
    setSubmittingReply(true);
    try {
      const res = await replyAdminReview(replyingReview.id, replyText.trim());
      toast.success(res.message);
      closeReplyModal();
      await fetchData(true);
    } catch (err: unknown) {
      const message =
        err instanceof ReviewApiError
          ? err.message
          : 'Không thể gửi phản hồi.';
      toast.error(message);
    } finally {
      setSubmittingReply(false);
    }
  };

  const handleDeleteReply = async () => {
    if (!replyingReview) return;
    setSubmittingReply(true);
    try {
      const res = await replyAdminReview(replyingReview.id, '');
      toast.success(res.message);
      closeReplyModal();
      await fetchData(true);
    } catch (err: unknown) {
      const message =
        err instanceof ReviewApiError
          ? err.message
          : 'Không thể xóa phản hồi.';
      toast.error(message);
    } finally {
      setSubmittingReply(false);
    }
  };

  const resetFilters = () => {
    setSearchInput('');
    setDebouncedSearch('');
    setRatingFilter(undefined);
    setStatusFilter(undefined);
    setBusCompanyFilter(undefined);
    setRouteFilter(undefined);
    setHasCommentFilter(undefined);
    setTimeRangeFilter(undefined);
    setPage(1);
    setSortBy('thoiGian');
    setSortDirection('desc');
  };

  return {
    reviews,
    stats,
    meta,
    loading,
    refreshing,
    error,
    searchInput,
    setSearchInput,
    ratingFilter,
    setRatingFilter: (r: number | undefined) => {
      setRatingFilter(r);
      setPage(1);
    },
    statusFilter,
    setStatusFilter: (s: ReviewStatus | undefined) => {
      setStatusFilter(s);
      setPage(1);
    },
    busCompanyFilter,
    setBusCompanyFilter: (b: number | undefined) => {
      setBusCompanyFilter(b);
      setPage(1);
    },
    routeFilter,
    setRouteFilter: (r: number | undefined) => {
      setRouteFilter(r);
      setPage(1);
    },
    hasCommentFilter,
    setHasCommentFilter: (c: 'ALL' | 'WITH_COMMENT' | 'WITHOUT_COMMENT' | undefined) => {
      setHasCommentFilter(c);
      setPage(1);
    },
    timeRangeFilter,
    setTimeRangeFilter: (t: 'ALL' | '7_DAYS' | '30_DAYS' | 'THIS_MONTH' | undefined) => {
      setTimeRangeFilter(t);
      setPage(1);
    },
    routeOptions,
    busCompanyOptions,
    page,
    setPage,
    sortBy,
    sortDirection,
    handleSort,
    moderatingReview,
    setModeratingReview,
    modifyingStatus,
    handleToggleStatus,
    replyingReview,
    replyText,
    setReplyText,
    submittingReply,
    openReplyModal,
    closeReplyModal,
    handleSaveReply,
    handleDeleteReply,
    refresh: () => fetchData(true),
    resetFilters,
    isSuperAdmin,
  };
}
