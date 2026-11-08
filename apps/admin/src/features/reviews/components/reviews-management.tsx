'use client';

import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Eye,
  EyeOff,
  FilterX,
  MessageSquare,
  MessageSquareQuote,
  Star,
  X,
} from 'lucide-react';
import { AdminPageHeader } from '@/components/admin/admin-page-header';
import {
  ResourceConfirmation,
  ResourcePagination,
  ResourceRefreshAction,
  ResourceState,
  ResourceStatusBadge,
  ResourceTableSkeleton,
} from '@/components/admin/resource-ui';
import {
  SearchInput,
  SelectFilter,
  type FilterOption,
} from '@/components/data-filters/resource-filters';
import { Button } from '@/components/ui/action-button';
import { Card } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { SuperAdminLayout } from '@/features/super-admin-layout/components/super-admin-layout';
import { useTranslations } from 'next-intl';
import { useReviews } from '../hooks/use-reviews';
import type { AdminReviewSortKey, ReviewStatus } from '../types/review';
import { ReviewStatsCards } from './review-stats-cards';

const RATING_OPTIONS: FilterOption[] = [
  { value: '5', label: '5 sao (Xuất sắc)' },
  { value: '4', label: '4 sao (Tốt)' },
  { value: '3', label: '3 sao (Bình thường)' },
  { value: '2', label: '2 sao (Kém)' },
  { value: '1', label: '1 sao (Rất tệ)' },
];

const STATUS_OPTIONS: FilterOption[] = [
  { value: 'HIEN_THI', label: 'Đang hiển thị' },
  { value: 'DA_AN', label: 'Đã ẩn kiểm duyệt' },
];

const COMMENT_OPTIONS: FilterOption[] = [
  { value: 'WITH_COMMENT', label: 'Có nhận xét viết kèm' },
  { value: 'WITHOUT_COMMENT', label: 'Chỉ chấm sao (không chữ)' },
];

const TIME_RANGE_OPTIONS: FilterOption[] = [
  { value: '7_DAYS', label: '7 ngày qua' },
  { value: '30_DAYS', label: '30 ngày qua' },
  { value: 'THIS_MONTH', label: 'Tháng này' },
];

function formatDate(isoString: string): string {
  try {
    const d = new Date(isoString);
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    return `${hours}:${minutes} · ${day}-${month}-${year}`;
  } catch {
    return isoString;
  }
}

function StarRating({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-1.5" title={`${rating} trên 5 sao`}>
      <div className="flex items-center text-amber-400">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            size={14}
            className={
              star <= rating
                ? 'fill-amber-400 text-amber-400'
                : 'text-muted-foreground/30'
            }
            aria-hidden="true"
          />
        ))}
      </div>
      <span className="font-semibold text-foreground text-xs">{rating}/5</span>
    </div>
  );
}

export function ReviewsManagement() {
  const tReviews = useTranslations('reviews');
  const {
    reviews,
    stats,
    meta,
    loading,
    refreshing,
    error,
    searchInput,
    setSearchInput,
    ratingFilter,
    setRatingFilter,
    statusFilter,
    setStatusFilter,
    busCompanyFilter,
    setBusCompanyFilter,
    routeFilter,
    setRouteFilter,
    hasCommentFilter,
    setHasCommentFilter,
    timeRangeFilter,
    setTimeRangeFilter,
    routeOptions,
    busCompanyOptions,
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
    refresh,
    resetFilters,
    isSuperAdmin,
  } = useReviews();

  const isFiltered = Boolean(
    searchInput ||
      ratingFilter ||
      statusFilter ||
      (isSuperAdmin && busCompanyFilter) ||
      routeFilter ||
      hasCommentFilter ||
      timeRangeFilter,
  );

  function renderSortIcon(key: AdminReviewSortKey) {
    if (sortBy !== key) {
      return (
        <span aria-hidden="true">
          <ArrowUpDown size={14} />
        </span>
      );
    }
    return (
      <span aria-hidden="true">
        {sortDirection === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />}
      </span>
    );
  }

  function getAriaSort(key: AdminReviewSortKey): 'none' | 'ascending' | 'descending' {
    if (sortBy !== key) return 'none';
    return sortDirection === 'asc' ? 'ascending' : 'descending';
  }

  return (
    <SuperAdminLayout activeSection="reviews">
      <div className="admin-page-content admin-ui space-y-6">
        <AdminPageHeader
          actions={
            <ResourceRefreshAction loading={refreshing} onClick={refresh} />
          }
          eyebrow="QUẢN TRỊ ĐÁNH GIÁ"
          title={tReviews('reviewsTitle')}
          titleId="reviews-page-title"
        />

        {/* CSAT Metric Overview */}
        <ReviewStatsCards stats={stats} />

        {/* Reviews Table & Filters */}
        <section
          className="min-w-0"
          aria-busy={loading || refreshing}
          aria-labelledby="reviews-table-heading"
        >
          <h2 id="reviews-table-heading" className="sr-only">
            Danh sách đánh giá và phản hồi của khách hàng
          </h2>

          <Card className="overflow-hidden border">
            {/* Filter toolbar (chia 2 tầng gọn gàng, cân đối) */}
            <div className="border-b border-border divide-y divide-border">
              {/* Tầng 1: Tìm kiếm từ khóa, Lọc Nhà xe (cho Super Admin) và Tuyến xe */}
              <div className="flex flex-wrap items-end gap-3 p-4 sm:p-5">
                <SearchInput
                  className="min-w-0 flex-[3_1_260px]"
                  label="Tìm kiếm đánh giá"
                  onChange={setSearchInput}
                  placeholder="Tên khách hàng, số điện thoại hoặc từ khóa trong nhận xét..."
                  value={searchInput}
                />

                {isSuperAdmin && busCompanyOptions.length > 0 && (
                  <SelectFilter
                    className="min-w-0 flex-[2_1_200px]"
                    allLabel="Tất cả nhà xe"
                    label="Nhà xe"
                    onChange={(val) =>
                      setBusCompanyFilter(val ? Number(val) : undefined)
                    }
                    options={busCompanyOptions}
                    value={
                      busCompanyFilter !== undefined
                        ? String(busCompanyFilter)
                        : ''
                    }
                  />
                )}

                {routeOptions.length > 0 && (
                  <SelectFilter
                    className="min-w-0 flex-[2_1_200px]"
                    allLabel="Tất cả tuyến xe"
                    label="Tuyến xe"
                    onChange={(val) => setRouteFilter(val ? Number(val) : undefined)}
                    options={routeOptions}
                    value={routeFilter !== undefined ? String(routeFilter) : ''}
                  />
                )}
              </div>

              {/* Tầng 2: 4 tiêu chí lọc đều nhau và Nút xóa bộ lọc */}
              <div className="flex flex-wrap items-end gap-3 p-4 sm:p-5 bg-muted/20">
                <SelectFilter
                  className="min-w-0 flex-[1_1_140px] sm:flex-[1_1_160px]"
                  allLabel="Tất cả mức sao"
                  label="Số sao đánh giá"
                  onChange={(val) => setRatingFilter(val ? Number(val) : undefined)}
                  options={RATING_OPTIONS}
                  value={ratingFilter !== undefined ? String(ratingFilter) : ''}
                />

                <SelectFilter
                  className="min-w-0 flex-[1_1_140px] sm:flex-[1_1_160px]"
                  allLabel="Tất cả nhận xét"
                  label="Nội dung nhận xét"
                  onChange={(val) =>
                    setHasCommentFilter(
                      val
                        ? (val as 'ALL' | 'WITH_COMMENT' | 'WITHOUT_COMMENT')
                        : undefined,
                    )
                  }
                  options={COMMENT_OPTIONS}
                  value={hasCommentFilter ?? ''}
                />

                <SelectFilter
                  className="min-w-0 flex-[1_1_140px] sm:flex-[1_1_160px]"
                  allLabel="Tất cả thời gian"
                  label="Thời gian gửi"
                  onChange={(val) =>
                    setTimeRangeFilter(
                      val
                        ? (val as 'ALL' | '7_DAYS' | '30_DAYS' | 'THIS_MONTH')
                        : undefined,
                    )
                  }
                  options={TIME_RANGE_OPTIONS}
                  value={timeRangeFilter ?? ''}
                />

                <SelectFilter
                  className="min-w-0 flex-[1_1_140px] sm:flex-[1_1_160px]"
                  allLabel="Tất cả trạng thái"
                  label="Trạng thái kiểm duyệt"
                  onChange={(val) =>
                    setStatusFilter(val ? (val as ReviewStatus) : undefined)
                  }
                  options={STATUS_OPTIONS}
                  value={statusFilter ?? ''}
                />

                {isFiltered && (
                  <div className="flex items-end pb-0.5">
                    <Button
                      onClick={resetFilters}
                      size="sm"
                      variant="outline"
                      className="h-10 gap-1.5 whitespace-nowrap"
                    >
                      <FilterX size={14} />
                      Xóa bộ lọc
                    </Button>
                  </div>
                )}
              </div>
            </div>

            {/* Table Content */}
            {loading && !refreshing ? (
              <ResourceTableSkeleton resourceLabel="đánh giá" />
            ) : error ? (
              <ResourceState error>
                <p>{error}</p>
                <Button onClick={refresh} size="sm" variant="outline">
                  Thử lại
                </Button>
              </ResourceState>
            ) : reviews.length === 0 ? (
              <ResourceState>
                <p>
                  {isFiltered
                    ? 'Không tìm thấy đánh giá nào phù hợp với bộ lọc hiện tại.'
                    : 'Chưa có đánh giá nào từ hành khách.'}
                </p>
                {isFiltered && (
                  <Button onClick={resetFilters} size="sm" variant="outline">
                    Xóa bộ lọc
                  </Button>
                )}
              </ResourceState>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[180px]">Khách hàng</TableHead>
                        <TableHead className="min-w-[200px]">Chuyến xe & Tuyến đường</TableHead>
                        <TableHead
                          aria-sort={getAriaSort('mucDanhGia')}
                          className="w-[150px] cursor-pointer select-none"
                          onClick={() => handleSort('mucDanhGia')}
                        >
                          <div className="flex items-center gap-1">
                            <span>Đánh giá</span>
                            {renderSortIcon('mucDanhGia')}
                          </div>
                        </TableHead>
                        <TableHead className="min-w-[260px]">Nội dung phản hồi</TableHead>
                        <TableHead
                          aria-sort={getAriaSort('thoiGian')}
                          className="w-[170px] cursor-pointer select-none"
                          onClick={() => handleSort('thoiGian')}
                        >
                          <div className="flex items-center gap-1">
                            <span>Thời gian</span>
                            {renderSortIcon('thoiGian')}
                          </div>
                        </TableHead>
                        <TableHead className="w-[130px]">Trạng thái</TableHead>
                        <TableHead className="w-[110px] text-right">Thao tác</TableHead>
                      </TableRow>
                    </TableHeader>

                    <TableBody>
                      {reviews.map((review) => (
                        <TableRow key={review.id} className="text-[13px]">
                          {/* Customer */}
                          <TableCell className="align-top">
                            <div className="font-semibold text-foreground">
                              {review.customer.fullName}
                            </div>
                            <div className="font-mono text-xs text-muted-foreground">
                              {review.customer.phoneNumber}
                            </div>
                            {review.customer.email && (
                              <div className="truncate text-xs text-muted-foreground/80 max-w-[160px]">
                                {review.customer.email}
                              </div>
                            )}
                          </TableCell>

                          {/* Trip */}
                          <TableCell className="align-top">
                            {review.trip ? (
                              <div className="space-y-1">
                                <p className="font-medium text-foreground">
                                  {review.trip.routeName}
                                </p>
                                <div className="text-xs text-muted-foreground">
                                  <span>
                                    {review.trip.departureTime} · {review.trip.departureDate}
                                  </span>
                                  {review.trip.licensePlate && (
                                    <>
                                      <span className="mx-1.5">·</span>
                                      <span className="font-mono font-medium text-foreground">
                                        {review.trip.licensePlate}
                                      </span>
                                    </>
                                  )}
                                </div>
                                {isSuperAdmin && review.trip.busCompanyName && (
                                  <div className="text-xs text-muted-foreground">
                                    Nhà xe: <span className="text-foreground">{review.trip.busCompanyName}</span>
                                  </div>
                                )}
                              </div>
                            ) : (
                              <span className="text-xs text-muted-foreground italic">
                                Không có thông tin chuyến
                              </span>
                            )}
                          </TableCell>

                          {/* Rating */}
                          <TableCell className="align-top">
                            <StarRating rating={review.rating} />
                          </TableCell>

                          {/* Comment & Reply */}
                          <TableCell className="align-top">
                            {review.comment ? (
                              <p className="line-clamp-3 leading-relaxed text-foreground">
                                {review.comment}
                              </p>
                            ) : (
                              <span className="text-xs italic text-muted-foreground">
                                (Không có nội dung nhận xét)
                              </span>
                            )}
                            {review.reply && (
                              <div className="mt-2 rounded-lg border border-blue-200/80 bg-blue-50/70 p-2.5 text-xs text-slate-800">
                                <div className="flex items-center justify-between gap-2 font-semibold text-blue-900 mb-1">
                                  <span className="flex items-center gap-1.5">
                                    <MessageSquare size={13} className="text-[#0060c4]" />
                                    {review.reply.responderName || 'Nhà xe phản hồi'}:
                                  </span>
                                  {review.reply.createdAt && (
                                    <span className="text-[10px] text-muted-foreground font-normal">
                                      {formatDate(review.reply.createdAt)}
                                    </span>
                                  )}
                                </div>
                                <p className="line-clamp-2 italic text-slate-700">
                                  “{review.reply.content}”
                                </p>
                              </div>
                            )}
                          </TableCell>

                          {/* Created at */}
                          <TableCell className="align-top whitespace-nowrap text-muted-foreground">
                            <div>{formatDate(review.createdAt)}</div>
                            {review.isEdited && (
                              <div className="text-[11px] text-muted-foreground/75 italic">
                                (Đã chỉnh sửa)
                              </div>
                            )}
                          </TableCell>

                          {/* Status */}
                          <TableCell className="align-top">
                            {review.status === 'HIEN_THI' ? (
                              <ResourceStatusBadge tone="active">
                                Hiển thị
                              </ResourceStatusBadge>
                            ) : (
                              <ResourceStatusBadge tone="muted">
                                Đã ẩn
                              </ResourceStatusBadge>
                            )}
                          </TableCell>

                          {/* Actions */}
                          <TableCell className="align-top text-right whitespace-nowrap">
                            <div className="flex items-center justify-end gap-1">
                              {/* Chỉ Admin Nhà xe mới được phản hồi đánh giá */}
                              {!isSuperAdmin && (
                                <Button
                                  aria-label={`Phản hồi đánh giá của ${review.customer.fullName}`}
                                  onClick={() => openReplyModal(review)}
                                  size="sm"
                                  variant="ghost"
                                  className={`h-8 gap-1.5 ${review.reply ? 'text-primary font-semibold' : 'text-muted-foreground hover:text-foreground'}`}
                                  title={review.reply ? 'Xem hoặc chỉnh sửa phản hồi' : 'Gửi phản hồi từ nhà xe'}
                                >
                                  <MessageSquareQuote size={14} />
                                  {review.reply ? 'Sửa phản hồi' : 'Phản hồi'}
                                </Button>
                              )}

                              {/* Chỉ Super Admin mới có quyền kiểm duyệt Ẩn/Hiện đánh giá */}
                              {isSuperAdmin && (
                                review.status === 'HIEN_THI' ? (
                                  <Button
                                    aria-label={`Ẩn đánh giá của ${review.customer.fullName}`}
                                    onClick={() => setModeratingReview(review)}
                                    size="sm"
                                    variant="ghost"
                                    className="h-8 gap-1.5 text-muted-foreground hover:text-destructive"
                                  >
                                    <EyeOff size={14} />
                                    Ẩn
                                  </Button>
                                ) : (
                                  <Button
                                    aria-label={`Hiển thị lại đánh giá của ${review.customer.fullName}`}
                                    onClick={() => setModeratingReview(review)}
                                    size="sm"
                                    variant="ghost"
                                    className="h-8 gap-1.5 text-muted-foreground hover:text-primary"
                                  >
                                    <Eye size={14} />
                                    Hiện lại
                                  </Button>
                                )
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                {/* Pagination */}
                <ResourcePagination
                  currentPage={meta.page}
                  disabled={loading || refreshing}
                  onPageChange={setPage}
                  pageSize={meta.pageSize}
                  summaryLabel="đánh giá"
                  totalItems={meta.totalItems}
                  totalPages={meta.totalPages}
                />
              </>
            )}
          </Card>
        </section>

        {/* Confirmation Dialog for Hiding / Unhiding Review */}
        {moderatingReview && (
          <ResourceConfirmation
            busy={modifyingStatus}
            description={
              moderatingReview.status === 'HIEN_THI'
                ? `Đánh giá của "${moderatingReview.customer.fullName}" (${moderatingReview.rating} sao) sẽ bị ẩn khỏi hệ thống và khách hàng khác sẽ không nhìn thấy nhận xét này nữa. Bạn có chắc chắn muốn ẩn?`
                : `Đánh giá của "${moderatingReview.customer.fullName}" (${moderatingReview.rating} sao) sẽ được công khai trở lại trên trang thông tin nhà xe/chuyến xe. Bạn có chắc chắn muốn bỏ ẩn?`
            }
            footer={
              <div className="flex items-center justify-end gap-3">
                <Button
                  disabled={modifyingStatus}
                  onClick={() => setModeratingReview(null)}
                  variant="outline"
                >
                  Hủy
                </Button>
                <Button
                  disabled={modifyingStatus}
                  onClick={handleToggleStatus}
                  variant={
                    moderatingReview.status === 'HIEN_THI'
                      ? 'destructive'
                      : 'default'
                  }
                >
                  {moderatingReview.status === 'HIEN_THI'
                    ? 'Xác nhận ẩn'
                    : 'Xác nhận hiển thị'}
                </Button>
              </div>
            }
            onClose={() => setModeratingReview(null)}
            title={
              moderatingReview.status === 'HIEN_THI'
                ? 'Ẩn đánh giá khỏi trang công khai'
                : 'Mở lại hiển thị đánh giá'
            }
          >
            <div className="rounded-md border bg-muted/40 p-3 text-xs space-y-1">
              <div className="flex items-center justify-between font-semibold text-foreground">
                <span>{moderatingReview.customer.fullName}</span>
                <span className="font-mono">{moderatingReview.customer.phoneNumber}</span>
              </div>
              <div className="flex items-center gap-1 text-amber-500 font-medium">
                <span>{moderatingReview.rating} sao</span>
              </div>
              {moderatingReview.comment && (
                <p className="italic text-muted-foreground line-clamp-2">
                  &ldquo;{moderatingReview.comment}&rdquo;
                </p>
              )}
            </div>
          </ResourceConfirmation>
        )}

        {/* Reply Modal Dialog for Bus Company */}
        {replyingReview && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150"
            onClick={closeReplyModal}
          >
            <div
              className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-4"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center">
                    <MessageSquareQuote size={18} />
                  </div>
                  <h3 className="text-base font-bold text-slate-900">
                    {replyingReview.reply ? 'Chỉnh sửa phản hồi' : 'Phản hồi đánh giá của khách'}
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={closeReplyModal}
                  className="p-1 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Customer review preview */}
              <div className="rounded-xl bg-slate-50 border border-slate-200/80 p-3.5 space-y-1.5 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-800">
                    {replyingReview.customer.fullName} · {replyingReview.rating}/5★
                  </span>
                  <span className="text-slate-400">
                    {formatDate(replyingReview.createdAt)}
                  </span>
                </div>
                {replyingReview.trip?.routeName && (
                  <p className="text-slate-500">
                    Tuyến: {replyingReview.trip.routeName}
                  </p>
                )}
                <p className="text-slate-700 italic border-t border-slate-200/60 pt-1.5">
                  {replyingReview.comment ? `“${replyingReview.comment}”` : '(Khách chỉ chấm sao, không để lại lời nhận xét)'}
                </p>
              </div>

              {/* Textarea */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 block">
                  Nội dung phản hồi từ Nhà xe:
                </label>
                <textarea
                  rows={4}
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  maxLength={1000}
                  placeholder="Cảm ơn quý khách đã tin tưởng và góp ý cho nhà xe. Chúng tôi sẽ tiếp tục cải thiện chất lượng phục vụ..."
                  className="w-full p-3 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 text-sm resize-none"
                />
                <div className="flex justify-end text-[11px] text-slate-400 font-medium">
                  {replyText.length}/1000 ký tự
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center justify-between pt-2 border-t border-slate-100 gap-2">
                {replyingReview.reply ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={handleDeleteReply}
                    disabled={submittingReply}
                    className="text-rose-600 hover:bg-rose-50"
                  >
                    Xóa phản hồi
                  </Button>
                ) : (
                  <div />
                )}
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={closeReplyModal}
                    disabled={submittingReply}
                  >
                    Hủy
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    onClick={handleSaveReply}
                    disabled={submittingReply || !replyText.trim()}
                    className="bg-primary hover:bg-primary/90 text-white font-bold"
                  >
                    {submittingReply ? 'Đang lưu...' : 'Lưu phản hồi'}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </SuperAdminLayout>
  );
}
