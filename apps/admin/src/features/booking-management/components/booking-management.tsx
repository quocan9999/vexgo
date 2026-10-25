'use client';

import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AdminPageHeader } from '@/components/admin/admin-page-header';
import {
  ResourcePagination,
  ResourceStatusBadge,
  ResourceDetailAction,
  ResourceTableSkeleton,
  ResourceState,
  ResourceRefreshAction,
} from '@/components/admin/resource-ui';
import {
  DateRangeFilter,
  LabeledSelectFilter,
  type DateRangeValue,
} from '@/components/data-filters/data-filters';
import {
  FilterToolbar,
  SearchInput,
  SelectFilter,
} from '@/components/data-filters/resource-filters';
import { Button } from '@/components/ui/action-button';
import { Card } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { SuperAdminLayout } from '@/features/super-admin-layout/components/super-admin-layout';
import { useAdminSession } from '@/features/admin-auth/hooks/use-admin-session';
import {
  BookingManagementApiError,
  getAdminBookings,
  getAdminTickets,
} from '../services/booking-management-service';
import {
  formatTimestamp,
  formatVnd,
  statusIsActive,
  statusLabel,
} from '../services/booking-management-format';
import {
  BOOKING_STATUS_OPTIONS,
  TICKET_STATUS_OPTIONS,
  parseBookingManagementUrlState,
  serializeBookingManagementUrlState,
  type BookingManagementListState,
  type BookingManagementSortKey,
  type BookingManagementTab,
  type BookingManagementUrlState,
} from '../services/booking-management-query';
import type {
  AdminBookingListItem,
  AdminPage,
  AdminTicketListItem,
} from '../types/booking-management';

type BookingPage = AdminPage<AdminBookingListItem>;
type TicketPage = AdminPage<AdminTicketListItem>;
type ResultPage = BookingPage | TicketPage;
type DetailKind = 'bookings' | 'tickets';
type OpenDetail = (
  kind: DetailKind,
  id: number,
  state: BookingManagementUrlState,
) => void;

function formatDisplayTimestamp(value: string | null | undefined) {
  if (!value || formatTimestamp(value) === '—') return '—';
  return new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
    .format(new Date(value))
    .replaceAll('/', '-');
}

function displayStatusLabel(status: string) {
  return status === 'CHO_THAN_TOAN' ? 'Chờ thanh toán' : statusLabel(status);
}

function dateRangeValue(
  from?: string,
  to?: string,
): Partial<DateRangeValue> | null {
  if (!from && !to) return null;
  return { from: from ?? '', to: to ?? '' };
}

function pathWithState(state: BookingManagementUrlState) {
  const query = serializeBookingManagementUrlState(state).toString();
  return query ? `/booking-management?${query}` : '/booking-management';
}

function detailHref(
  kind: 'bookings' | 'tickets',
  id: number,
  state: BookingManagementUrlState,
) {
  const params = new URLSearchParams({ from: pathWithState(state) });
  return `/booking-management/${kind}/${id}?${params.toString()}`;
}

function getErrorMessage(error: unknown) {
  if (!(error instanceof BookingManagementApiError)) {
    return 'Không thể tải dữ liệu. Hãy thử lại.';
  }
  if (error.status === 401) {
    return 'Phiên quản trị đã hết hạn. Hãy đăng nhập lại để tiếp tục.';
  }
  if (error.status === 403) {
    return 'Tài khoản hiện không có quyền xem phiếu đặt vé và vé.';
  }
  if (error.status === 404) return 'Không tìm thấy dữ liệu yêu cầu.';
  return error.message;
}

function getSessionKey(authState: ReturnType<typeof useAdminSession>) {
  if (authState.status !== 'authenticated') return authState.status;
  const session = authState.session;
  return [
    session.accountId,
    session.employee?.employeeId ?? 'platform',
    session.busCompanyId ?? 'no-tenant',
    [...session.permissions].sort().join(','),
  ].join(':');
}

export function BookingManagement() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryString = searchParams.toString();
  const parsedUrl = useMemo(
    () => parseBookingManagementUrlState(new URLSearchParams(queryString)),
    [queryString],
  );
  const { state: urlState, needsCanonicalization } = parsedUrl;
  const activeState = urlState[urlState.tab];
  const authState = useAdminSession();
  const sessionKey = getSessionKey(authState);
  const queryKey = JSON.stringify([sessionKey, urlState.tab, activeState]);
  const latestUrlState = useRef(urlState);
  const searchDirty = useRef(false);
  const observedSearch = useRef({
    tab: urlState.tab,
    value: activeState.search,
  });
  const [searchDraft, setSearchDraft] = useState(activeState.search);
  const [resultState, setResultState] = useState<{
    key: string;
    page: ResultPage;
  } | null>(null);
  const [loadState, setLoadState] = useState<{ key: string } | null>(null);
  const [requestErrorState, setRequestErrorState] = useState<{
    key: string;
    error: unknown;
  } | null>(null);
  const [retryKey, setRetryKey] = useState(0);
  const [extraFiltersOpen, setExtraFiltersOpen] = useState(false);
  const requestKey = JSON.stringify([queryKey, retryKey]);
  const loading =
    authState.status === 'authenticated' && loadState?.key !== requestKey;
  const requestError =
    requestErrorState?.key === requestKey ? requestErrorState.error : null;
  const resultPage = resultState?.key === requestKey ? resultState.page : null;

  useEffect(() => {
    latestUrlState.current = urlState;
  }, [urlState]);

  const writeUrlState = useCallback(
    (nextState: BookingManagementUrlState, history: 'push' | 'replace') => {
      const nextQuery =
        serializeBookingManagementUrlState(nextState).toString();
      latestUrlState.current = nextState;
      if (nextQuery === queryString) return;
      const url = pathWithState(nextState);
      if (history === 'push') router.push(url, { scroll: false });
      else router.replace(url, { scroll: false });
    },
    [queryString, router],
  );

  useEffect(() => {
    if (!needsCanonicalization) return;
    writeUrlState(urlState, 'replace');
  }, [needsCanonicalization, urlState, writeUrlState]);

  useEffect(() => {
    const previous = observedSearch.current;
    if (
      previous.tab !== urlState.tab ||
      previous.value !== activeState.search
    ) {
      searchDirty.current = false;
      setSearchDraft(activeState.search);
      observedSearch.current = { tab: urlState.tab, value: activeState.search };
    }
  }, [activeState.search, urlState.tab]);

  useEffect(() => {
    if (!searchDirty.current) return;
    const tab = urlState.tab;
    const timeout = window.setTimeout(() => {
      const latest = latestUrlState.current;
      const current = latest[tab];
      searchDirty.current = false;
      observedSearch.current = { tab, value: searchDraft };
      writeUrlState(
        {
          ...latest,
          [tab]: { ...current, search: searchDraft, page: 1 },
        },
        'replace',
      );
    }, 350);
    return () => window.clearTimeout(timeout);
  }, [searchDraft, urlState.tab, writeUrlState]);

  useEffect(() => {
    if (authState.status !== 'authenticated') return;

    const controller = new AbortController();
    let active = true;
    const load =
      urlState.tab === 'bookings'
        ? getAdminBookings(
            activeState as BookingManagementListState & {
              sortBy: 'bookedAt' | 'departureTime' | 'totalTicketAmount';
            },
            controller.signal,
          )
        : getAdminTickets(
            activeState as BookingManagementListState & {
              sortBy: 'bookedAt' | 'departureTime' | 'ticketPrice';
            },
            controller.signal,
          );

    void load
      .then((page) => {
        if (active && !controller.signal.aborted) {
          setResultState({ key: requestKey, page });
        }
      })
      .catch((error: unknown) => {
        if (active && !controller.signal.aborted) {
          setRequestErrorState({ key: requestKey, error });
        }
      })
      .finally(() => {
        if (active && !controller.signal.aborted)
          setLoadState({ key: requestKey });
      });

    return () => {
      active = false;
      controller.abort();
    };
  }, [authState.status, activeState, requestKey, sessionKey, urlState.tab]);

  const updateListState = useCallback(
    (
      change: (
        current: BookingManagementListState,
      ) => BookingManagementListState,
      history: 'push' | 'replace' = 'push',
    ) => {
      const currentState = latestUrlState.current;
      const tab = currentState.tab;
      writeUrlState(
        { ...currentState, [tab]: change(currentState[tab]) },
        history,
      );
    },
    [writeUrlState],
  );

  function switchTab(tab: BookingManagementTab) {
    searchDirty.current = false;
    setSearchDraft(latestUrlState.current[tab].search);
    writeUrlState({ ...latestUrlState.current, tab }, 'push');
  }

  function openDetail(
    kind: DetailKind,
    id: number,
    state: BookingManagementUrlState,
  ) {
    router.push(detailHref(kind, id, state));
  }

  function changeDateRange(
    key: 'booked' | 'departure',
    value: DateRangeValue | null,
  ) {
    const fromKey = key === 'booked' ? 'bookedFrom' : 'departureFrom';
    const toKey = key === 'booked' ? 'bookedTo' : 'departureTo';

    updateListState((current) => {
      return {
        ...current,
        [fromKey]: value?.from || undefined,
        [toKey]: value?.to || undefined,
        page: 1,
      };
    });
  }

  function resetFilters() {
    searchDirty.current = false;
    setSearchDraft('');
    updateListState((current) => ({
      ...current,
      search: '',
      status: undefined,
      bookedFrom: undefined,
      bookedTo: undefined,
      departureFrom: undefined,
      departureTo: undefined,
      page: 1,
    }));
  }

  function changeSort(sortBy: BookingManagementSortKey) {
    updateListState((current) => ({
      ...current,
      sortBy,
      sortDirection:
        current.sortBy === sortBy && current.sortDirection === 'asc'
          ? 'desc'
          : current.sortBy === sortBy
            ? 'asc'
            : 'desc',
      page: 1,
    }));
  }

  const items = resultPage?.data ?? [];
  const hasFilters = Boolean(
    activeState.search ||
    activeState.status ||
    activeState.bookedFrom ||
    activeState.bookedTo ||
    activeState.departureFrom ||
    activeState.departureTo,
  );
  const statusOptions =
    urlState.tab === 'bookings'
      ? BOOKING_STATUS_OPTIONS
      : TICKET_STATUS_OPTIONS;
  const sortOptions: Array<{
    value: BookingManagementSortKey;
    label: string;
  }> =
    urlState.tab === 'bookings'
      ? [
          { value: 'bookedAt', label: 'Ngày đặt' },
          { value: 'departureTime', label: 'Khởi hành' },
          { value: 'totalTicketAmount', label: 'Tiền vé ban đầu' },
        ]
      : [
          { value: 'bookedAt', label: 'Ngày đặt' },
          { value: 'departureTime', label: 'Khởi hành' },
          { value: 'ticketPrice', label: 'Giá thực tế' },
        ];

  return (
    <SuperAdminLayout activeSection="booking-management">
      <div className="admin-page-content admin-ui space-y-6">
        <AdminPageHeader
          eyebrow="QUẢN LÝ VẬN HÀNH"
          title="Quản lý phiếu đặt vé & vé"
          titleId="booking-management-title"
          actions={
            <ResourceRefreshAction
              loading={loading}
              onClick={() => setRetryKey((key) => key + 1)}
            />
          }
        />

        <section
          aria-labelledby="booking-management-title"
          aria-busy={loading}
          className="min-w-0"
        >
          <Tabs
            value={urlState.tab}
            onValueChange={(value) => switchTab(value as BookingManagementTab)}
            className="min-w-0 gap-4"
          >
            <TabsList
              aria-label="Loại dữ liệu đặt vé"
              activateOnFocus
              className="w-full sm:w-fit"
            >
              <TabsTrigger
                id="booking-management-bookings-tab"
                value="bookings"
              >
                Phiếu đặt vé
              </TabsTrigger>
              <TabsTrigger id="booking-management-tickets-tab" value="tickets">
                Vé
              </TabsTrigger>
            </TabsList>
            <TabsContent
              value={urlState.tab}
              className="min-w-0 overflow-hidden rounded-xl border bg-card shadow-sm"
              id="booking-management-panel"
            >
              <FilterToolbar>
                <SearchInput
                  label={
                    urlState.tab === 'bookings' ? 'Tìm phiếu đặt vé' : 'Tìm vé'
                  }
                  onChange={(value) => {
                    searchDirty.current = true;
                    setSearchDraft(value.slice(0, 100));
                  }}
                  placeholder="Tìm mã, tên khách hoặc số điện thoại…"
                  value={searchDraft}
                />
                <SelectFilter
                  allLabel="Tất cả trạng thái"
                  label="Trạng thái"
                  onChange={(value) =>
                    updateListState((current) => ({
                      ...current,
                      status: value || undefined,
                      page: 1,
                    }))
                  }
                  options={statusOptions.map(({ value, label }) => ({
                    value,
                    label,
                  }))}
                  value={activeState.status ?? ''}
                />
                <Button
                  variant="outline"
                  className="min-[901px]:hidden"
                  aria-expanded={extraFiltersOpen}
                  aria-controls="booking-extra-filters"
                  onClick={() => setExtraFiltersOpen((open) => !open)}
                >
                  {extraFiltersOpen ? 'Thu gọn' : 'Lọc nâng cao'}
                  {activeState.bookedFrom ||
                  activeState.bookedTo ||
                  activeState.departureFrom ||
                  activeState.departureTo
                    ? ' · Có lọc ngày'
                    : ''}
                </Button>
                <div
                  id="booking-extra-filters"
                  className={`${extraFiltersOpen ? 'flex' : 'hidden'} w-full flex-wrap items-end gap-3 min-[901px]:flex`}
                >
                  <DateRangeFilter
                    appearance="resource"
                    fromLabel="Ngày đặt từ"
                    label="Ngày đặt"
                    onApply={(value) => changeDateRange('booked', value)}
                    title="Ngày đặt"
                    toLabel="Ngày đặt đến"
                    value={dateRangeValue(
                      activeState.bookedFrom,
                      activeState.bookedTo,
                    )}
                  />
                  <DateRangeFilter
                    appearance="resource"
                    fromLabel="Khởi hành từ"
                    label="Ngày khởi hành"
                    onApply={(value) => changeDateRange('departure', value)}
                    title="Ngày khởi hành"
                    toLabel="Khởi hành đến"
                    value={dateRangeValue(
                      activeState.departureFrom,
                      activeState.departureTo,
                    )}
                  />
                  <LabeledSelectFilter
                    appearance="resource"
                    accessibleLabel="Số dòng mỗi trang"
                    label="Số dòng"
                    onChange={(value) =>
                      updateListState((current) => ({
                        ...current,
                        pageSize: Number(value),
                        page: 1,
                      }))
                    }
                    options={[10, 25, 50, 100].map((size) => ({
                      value: String(size),
                      label: String(size),
                    }))}
                    value={String(activeState.pageSize)}
                  />
                  <LabeledSelectFilter
                    appearance="resource"
                    label="Sắp xếp theo"
                    onChange={(value) =>
                      changeSort(value as BookingManagementSortKey)
                    }
                    options={sortOptions}
                    sortDirection={activeState.sortDirection}
                    value={activeState.sortBy}
                  />
                </div>
                {hasFilters && (
                  <Button
                    variant="outline"
                    onClick={resetFilters}
                    type="button"
                  >
                    Xóa bộ lọc
                  </Button>
                )}
              </FilterToolbar>

              {loading && !resultPage && (
                <ResourceTableSkeleton
                  resourceLabel={
                    urlState.tab === 'bookings' ? 'phiếu đặt vé' : 'vé'
                  }
                />
              )}

              {Boolean(requestError) && (
                <ResourceState error>
                  <p>{getErrorMessage(requestError)}</p>
                  <Button
                    variant="outline"
                    onClick={() => setRetryKey((key) => key + 1)}
                    type="button"
                  >
                    Thử lại
                  </Button>
                </ResourceState>
              )}

              {!requestError &&
                !loading &&
                resultPage &&
                items.length === 0 && (
                  <ResourceState>
                    <p>
                      {resultPage.meta.totalItems > 0
                        ? 'Trang hiện tại không có dữ liệu. Hãy quay về trang trước.'
                        : hasFilters
                          ? 'Không tìm thấy kết quả phù hợp với bộ lọc.'
                          : urlState.tab === 'bookings'
                            ? 'Chưa có phiếu đặt vé trong nhà xe.'
                            : 'Chưa có vé trong nhà xe.'}
                    </p>
                    {hasFilters && (
                      <Button
                        variant="outline"
                        onClick={resetFilters}
                        type="button"
                      >
                        Xóa bộ lọc
                      </Button>
                    )}
                  </ResourceState>
                )}

              {resultPage && items.length > 0 && (
                <>
                  <div aria-busy={loading} className="hidden min-[901px]:block">
                    {urlState.tab === 'bookings' ? (
                      <BookingTable
                        items={(resultPage as BookingPage).data}
                        onOpenDetail={openDetail}
                        onSort={changeSort}
                        state={urlState}
                      />
                    ) : (
                      <TicketTable
                        items={(resultPage as TicketPage).data}
                        onOpenDetail={openDetail}
                        onSort={changeSort}
                        state={urlState}
                      />
                    )}
                  </div>
                  {urlState.tab === 'bookings' ? (
                    <BookingCards
                      items={(resultPage as BookingPage).data}
                      onOpenDetail={openDetail}
                      state={urlState}
                    />
                  ) : (
                    <TicketCards
                      items={(resultPage as TicketPage).data}
                      onOpenDetail={openDetail}
                      state={urlState}
                    />
                  )}
                </>
              )}
              {resultPage && resultPage.meta.totalItems > 0 && (
                <ResourcePagination
                  currentPage={resultPage.meta.page}
                  disabled={loading}
                  onPageChange={(page) =>
                    updateListState((current) => ({ ...current, page }))
                  }
                  pageSize={resultPage.meta.pageSize}
                  summaryLabel={
                    urlState.tab === 'bookings' ? 'phiếu đặt vé' : 'vé'
                  }
                  totalItems={resultPage.meta.totalItems}
                  totalPages={resultPage.meta.totalPages}
                />
              )}
            </TabsContent>
          </Tabs>
        </section>
      </div>
    </SuperAdminLayout>
  );
}

function SortHeader({
  children,
  active,
  direction,
  onClick,
}: {
  children: string;
  active: boolean;
  direction: 'asc' | 'desc';
  onClick: () => void;
}) {
  return (
    <Button
      className="-ml-3 font-semibold"
      variant="ghost"
      size="sm"
      onClick={onClick}
      type="button"
    >
      {children}
      {active ? (
        direction === 'asc' ? (
          <ArrowUp aria-hidden="true" size={14} />
        ) : (
          <ArrowDown aria-hidden="true" size={14} />
        )
      ) : (
        <ArrowUpDown aria-hidden="true" size={14} />
      )}
    </Button>
  );
}

function BookingTable({
  items,
  onOpenDetail,
  onSort,
  state,
}: {
  items: AdminBookingListItem[];
  onOpenDetail: OpenDetail;
  onSort: (sortBy: BookingManagementSortKey) => void;
  state: BookingManagementUrlState;
}) {
  const sortState = state.bookings;
  return (
    <Table className="text-[13px]">
      <TableCaption className="sr-only">Danh sách phiếu đặt vé</TableCaption>
      <TableHeader>
        <TableRow>
          <TableHead
            aria-sort={
              sortState.sortBy === 'bookedAt'
                ? sortState.sortDirection === 'asc'
                  ? 'ascending'
                  : 'descending'
                : 'none'
            }
            scope="col"
          >
            <SortHeader
              active={sortState.sortBy === 'bookedAt'}
              direction={sortState.sortDirection}
              onClick={() => onSort('bookedAt')}
            >
              Mã phiếu / Ngày đặt
            </SortHeader>
          </TableHead>
          <TableHead scope="col">Khách hàng</TableHead>
          <TableHead
            aria-sort={
              sortState.sortBy === 'departureTime'
                ? sortState.sortDirection === 'asc'
                  ? 'ascending'
                  : 'descending'
                : 'none'
            }
            scope="col"
          >
            <SortHeader
              active={sortState.sortBy === 'departureTime'}
              direction={sortState.sortDirection}
              onClick={() => onSort('departureTime')}
            >
              Chuyến xe
            </SortHeader>
          </TableHead>
          <TableHead scope="col">Số vé</TableHead>
          <TableHead
            aria-sort={
              sortState.sortBy === 'totalTicketAmount'
                ? sortState.sortDirection === 'asc'
                  ? 'ascending'
                  : 'descending'
                : 'none'
            }
            scope="col"
          >
            <SortHeader
              active={sortState.sortBy === 'totalTicketAmount'}
              direction={sortState.sortDirection}
              onClick={() => onSort('totalTicketAmount')}
            >
              Tiền vé ban đầu
            </SortHeader>
          </TableHead>
          <TableHead scope="col">Trạng thái phiếu</TableHead>
          <TableHead scope="col">
            <span className="sr-only">Chi tiết</span>
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {items.map((item) => (
          <TableRow key={item.bookingId}>
            <TableHead scope="row" className="bg-transparent py-3 text-[13px]">
              <Link
                className="admin-data-mono"
                href={detailHref('bookings', item.bookingId, state)}
              >
                {item.bookingCode}
              </Link>
              <small className="mt-1 block text-xs text-muted-foreground">
                {formatDisplayTimestamp(item.bookedAt)}
              </small>
            </TableHead>
            <TableCell>
              {item.customer.name}
              <small className="mt-1 block text-xs text-muted-foreground">
                {item.customer.phoneNumber}
              </small>
            </TableCell>
            <TableCell>
              {item.trip ? (
                <>
                  {item.trip.origin} → {item.trip.destination}
                  <small className="mt-1 block text-xs text-muted-foreground">
                    {formatDisplayTimestamp(item.trip.departureAt)}
                  </small>
                </>
              ) : (
                <span title={item.tripIntegrity}>Chuyến chưa xác định</span>
              )}
            </TableCell>
            <TableCell>
              {item.activeTicketCount}/{item.ticketCount} còn hiệu lực
              {item.isPartiallyCancelled && (
                <small className="mt-1 block text-xs text-destructive">
                  Hủy {item.cancelledTicketCount}/{item.ticketCount} vé
                </small>
              )}
            </TableCell>
            <TableCell>{formatVnd(item.initialTicketAmount)}</TableCell>
            <TableCell>
              <ResourceStatusBadge
                tone={statusIsActive(item.status) ? 'active' : 'muted'}
              >
                {displayStatusLabel(item.status)}
              </ResourceStatusBadge>
            </TableCell>
            <TableCell>
              <ResourceDetailAction
                onClick={() => onOpenDetail('bookings', item.bookingId, state)}
                resourceName={`phiếu ${item.bookingCode}`}
              />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function TicketTable({
  items,
  onOpenDetail,
  onSort,
  state,
}: {
  items: AdminTicketListItem[];
  onOpenDetail: OpenDetail;
  onSort: (sortBy: BookingManagementSortKey) => void;
  state: BookingManagementUrlState;
}) {
  const sortState = state.tickets;
  return (
    <Table className="text-[13px]">
      <TableCaption className="sr-only">Danh sách vé</TableCaption>
      <TableHeader>
        <TableRow>
          <TableHead scope="col">Mã vé</TableHead>
          <TableHead scope="col">Phiếu đặt</TableHead>
          <TableHead scope="col">Khách hàng</TableHead>
          <TableHead
            aria-sort={
              sortState.sortBy === 'departureTime'
                ? sortState.sortDirection === 'asc'
                  ? 'ascending'
                  : 'descending'
                : 'none'
            }
            scope="col"
          >
            <SortHeader
              active={sortState.sortBy === 'departureTime'}
              direction={sortState.sortDirection}
              onClick={() => onSort('departureTime')}
            >
              Chuyến / Khởi hành
            </SortHeader>
          </TableHead>
          <TableHead scope="col">Ghế</TableHead>
          <TableHead
            aria-sort={
              sortState.sortBy === 'ticketPrice'
                ? sortState.sortDirection === 'asc'
                  ? 'ascending'
                  : 'descending'
                : 'none'
            }
            scope="col"
          >
            <SortHeader
              active={sortState.sortBy === 'ticketPrice'}
              direction={sortState.sortDirection}
              onClick={() => onSort('ticketPrice')}
            >
              Giá thực tế
            </SortHeader>
          </TableHead>
          <TableHead scope="col">Trạng thái vé</TableHead>
          <TableHead scope="col">
            <span className="sr-only">Chi tiết</span>
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {items.map((item) => (
          <TableRow key={item.ticketId}>
            <TableHead scope="row" className="bg-transparent py-3 text-[13px]">
              <Link
                className="admin-data-mono"
                href={detailHref('tickets', item.ticketId, state)}
              >
                {item.ticketCode}
              </Link>
              <small className="mt-1 block text-xs text-muted-foreground">
                Đặt {formatDisplayTimestamp(item.bookedAt)}
              </small>
            </TableHead>
            <TableCell>
              <Link
                className="admin-data-mono"
                href={detailHref('bookings', item.bookingId, {
                  ...state,
                  tab: 'bookings',
                })}
              >
                {item.bookingCode}
              </Link>
            </TableCell>
            <TableCell>
              {item.customer.name}
              <small className="mt-1 block text-xs text-muted-foreground">
                {item.customer.phoneNumber}
              </small>
            </TableCell>
            <TableCell>
              {item.trip ? (
                <>
                  {item.trip.origin} → {item.trip.destination}
                  <small className="mt-1 block text-xs text-muted-foreground">
                    {formatDisplayTimestamp(item.trip.departureAt)}
                  </small>
                </>
              ) : (
                <span title={item.tripIntegrity}>Chuyến chưa xác định</span>
              )}
            </TableCell>
            <TableCell className="admin-data-mono">
              {item.seatNumber ?? '—'}
            </TableCell>
            <TableCell>{formatVnd(item.actualPrice)}</TableCell>
            <TableCell>
              <ResourceStatusBadge
                tone={statusIsActive(item.status) ? 'active' : 'muted'}
              >
                {displayStatusLabel(item.status)}
              </ResourceStatusBadge>
            </TableCell>
            <TableCell>
              <ResourceDetailAction
                onClick={() => onOpenDetail('tickets', item.ticketId, state)}
                resourceName={`vé ${item.ticketCode}`}
              />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function BookingCards({
  items,
  onOpenDetail,
  state,
}: {
  items: AdminBookingListItem[];
  onOpenDetail: OpenDetail;
  state: BookingManagementUrlState;
}) {
  return (
    <ul
      aria-label="Danh sách phiếu đặt vé dạng thẻ"
      className="grid gap-4 p-4 min-[901px]:hidden"
    >
      {items.map((item) => (
        <li key={item.bookingId}>
          <Card className="gap-4 p-4">
            <div className="flex min-w-0 flex-wrap items-start justify-between gap-3 [&>div]:min-w-0 [&_a]:break-all [&_p]:mt-1 [&_p]:text-sm [&_p]:font-semibold">
              <div>
                <Link
                  className="admin-data-mono"
                  href={detailHref('bookings', item.bookingId, state)}
                >
                  {item.bookingCode}
                </Link>
                <p>{item.customer.name}</p>
              </div>
              <ResourceStatusBadge
                tone={statusIsActive(item.status) ? 'active' : 'muted'}
              >
                {displayStatusLabel(item.status)}
              </ResourceStatusBadge>
            </div>
            <dl className="grid grid-cols-2 gap-4 text-[13px] [&_dt]:text-xs [&_dt]:text-muted-foreground [&_dd]:mt-1 [&_dd]:break-words [&_a]:break-all">
              <div>
                <dt>Điện thoại</dt>
                <dd>{item.customer.phoneNumber}</dd>
              </div>
              <div>
                <dt>Ngày đặt</dt>
                <dd>{formatDisplayTimestamp(item.bookedAt)}</dd>
              </div>
              <div>
                <dt>Chuyến xe</dt>
                <dd>
                  {item.trip
                    ? `${item.trip.origin} → ${item.trip.destination}`
                    : 'Chuyến chưa xác định'}
                </dd>
              </div>
              <div>
                <dt>Vé còn hiệu lực</dt>
                <dd>
                  {item.activeTicketCount}/{item.ticketCount}
                  {item.isPartiallyCancelled
                    ? ` · Hủy ${item.cancelledTicketCount}/${item.ticketCount}`
                    : ''}
                </dd>
              </div>
              <div>
                <dt>Tiền vé ban đầu</dt>
                <dd>{formatVnd(item.initialTicketAmount)}</dd>
              </div>
            </dl>
            <ResourceDetailAction
              onClick={() => onOpenDetail('bookings', item.bookingId, state)}
              resourceName={`phiếu ${item.bookingCode}`}
            />
          </Card>
        </li>
      ))}
    </ul>
  );
}

function TicketCards({
  items,
  onOpenDetail,
  state,
}: {
  items: AdminTicketListItem[];
  onOpenDetail: OpenDetail;
  state: BookingManagementUrlState;
}) {
  return (
    <ul
      aria-label="Danh sách vé dạng thẻ"
      className="grid gap-4 p-4 min-[901px]:hidden"
    >
      {items.map((item) => (
        <li key={item.ticketId}>
          <Card className="gap-4 p-4">
            <div className="flex min-w-0 flex-wrap items-start justify-between gap-3 [&>div]:min-w-0 [&_a]:break-all [&_p]:mt-1 [&_p]:text-sm [&_p]:font-semibold">
              <div>
                <Link
                  className="admin-data-mono"
                  href={detailHref('tickets', item.ticketId, state)}
                >
                  {item.ticketCode}
                </Link>
                <p>{item.customer.name}</p>
              </div>
              <ResourceStatusBadge
                tone={statusIsActive(item.status) ? 'active' : 'muted'}
              >
                {displayStatusLabel(item.status)}
              </ResourceStatusBadge>
            </div>
            <dl className="grid grid-cols-2 gap-4 text-[13px] [&_dt]:text-xs [&_dt]:text-muted-foreground [&_dd]:mt-1 [&_dd]:break-words [&_a]:break-all">
              <div>
                <dt>Phiếu đặt</dt>
                <dd>
                  <Link
                    className="admin-data-mono"
                    href={detailHref('bookings', item.bookingId, {
                      ...state,
                      tab: 'bookings',
                    })}
                  >
                    {item.bookingCode}
                  </Link>
                </dd>
              </div>
              <div>
                <dt>Điện thoại</dt>
                <dd>{item.customer.phoneNumber}</dd>
              </div>
              <div>
                <dt>Chuyến xe</dt>
                <dd>
                  {item.trip
                    ? `${item.trip.origin} → ${item.trip.destination}`
                    : 'Chuyến chưa xác định'}
                </dd>
              </div>
              <div>
                <dt>Khởi hành</dt>
                <dd>{formatDisplayTimestamp(item.trip?.departureAt)}</dd>
              </div>
              <div>
                <dt>Ghế</dt>
                <dd className="admin-data-mono">{item.seatNumber ?? '—'}</dd>
              </div>
              <div>
                <dt>Giá thực tế</dt>
                <dd>{formatVnd(item.actualPrice)}</dd>
              </div>
            </dl>
            <ResourceDetailAction
              onClick={() => onOpenDetail('tickets', item.ticketId, state)}
              resourceName={`vé ${item.ticketCode}`}
            />
          </Card>
        </li>
      ))}
    </ul>
  );
}
