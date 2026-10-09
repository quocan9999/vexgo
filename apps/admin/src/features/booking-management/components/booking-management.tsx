'use client';

import { ArrowDown, ArrowUp, ArrowUpDown, Search } from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';
import { AdminPageHeader } from '@/components/admin/admin-page-header';
import { AdminPagination } from '@/components/admin/admin-pagination';
import { AdminStatusBadge } from '@/components/admin/admin-status-badge';
import { AdminTableSkeleton } from '@/components/admin/admin-table-skeleton';
import {
  FilterToolbar,
  SearchInput,
  SelectFilter,
} from '@/components/data-filters/data-filters';
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
import styles from './booking-management.module.css';

type BookingPage = AdminPage<AdminBookingListItem>;
type TicketPage = AdminPage<AdminTicketListItem>;
type ResultPage = BookingPage | TicketPage;

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
      const url = pathWithState(nextState);
      if (history === 'push') router.push(url, { scroll: false });
      else router.replace(url, { scroll: false });
    },
    [router],
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

  function handleTabKeyDown(
    event: KeyboardEvent<HTMLButtonElement>,
    currentTab: BookingManagementTab,
  ) {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const nextTab =
      event.key === 'Home'
        ? 'bookings'
        : event.key === 'End'
          ? 'tickets'
          : currentTab === 'bookings'
            ? 'tickets'
            : 'bookings';
    switchTab(nextTab);
    document.getElementById(`booking-management-${nextTab}-tab`)?.focus();
  }

  function changeDateRange(
    key: 'booked' | 'departure',
    edge: 'From' | 'To',
    value: string,
  ) {
    const fromKey = key === 'booked' ? 'bookedFrom' : 'departureFrom';
    const toKey = key === 'booked' ? 'bookedTo' : 'departureTo';
    updateListState((current) => {
      const from = edge === 'From' ? value : (current[fromKey] ?? '');
      const to = edge === 'To' ? value : (current[toKey] ?? '');
      const invalidRange = Boolean(from && to && from > to);
      return {
        ...current,
        [fromKey]: invalidRange ? undefined : from || undefined,
        [toKey]: invalidRange ? undefined : to || undefined,
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

  function changeSortDirection(sortDirection: 'asc' | 'desc') {
    updateListState((current) => ({
      ...current,
      sortDirection,
      page: 1,
    }));
  }

  const items = resultPage?.data ?? [];
  const totalItems = requestError
    ? null
    : loading
      ? null
      : (resultPage?.meta.totalItems ?? null);
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
      <div className="admin-page-content">
        <AdminPageHeader
          eyebrow="QUẢN LÝ VẬN HÀNH"
          title="Quản lý phiếu đặt vé & vé"
          titleId="booking-management-title"
        />

        <section
          aria-labelledby="booking-management-title"
          aria-busy={loading}
          className={styles.section}
        >
          <div className="panel admin-resource-panel">
            <div
              aria-label="Loại dữ liệu đặt vé"
              className={styles.tabs}
              role="tablist"
            >
              <button
                aria-controls="booking-management-panel"
                aria-selected={urlState.tab === 'bookings'}
                className={styles.tab}
                id="booking-management-bookings-tab"
                onClick={() => switchTab('bookings')}
                onKeyDown={(event) => handleTabKeyDown(event, 'bookings')}
                role="tab"
                tabIndex={urlState.tab === 'bookings' ? 0 : -1}
                type="button"
              >
                Phiếu đặt vé
              </button>
              <button
                aria-controls="booking-management-panel"
                aria-selected={urlState.tab === 'tickets'}
                className={styles.tab}
                id="booking-management-tickets-tab"
                onClick={() => switchTab('tickets')}
                onKeyDown={(event) => handleTabKeyDown(event, 'tickets')}
                role="tab"
                tabIndex={urlState.tab === 'tickets' ? 0 : -1}
                type="button"
              >
                Vé
              </button>
            </div>

            <div
              aria-labelledby={`booking-management-${urlState.tab}-tab`}
              className={styles.panel}
              id="booking-management-panel"
              role="tabpanel"
              tabIndex={0}
            >
              <FilterToolbar totalItems={totalItems}>
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
                  label="Lọc theo trạng thái"
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
                <label className={styles.dateFilter}>
                  <span>Ngày đặt từ</span>
                  <input
                    aria-label="Ngày đặt từ"
                    max={activeState.bookedTo}
                    onChange={(event) =>
                      changeDateRange('booked', 'From', event.target.value)
                    }
                    type="date"
                    value={activeState.bookedFrom ?? ''}
                  />
                </label>
                <label className={styles.dateFilter}>
                  <span>Đến</span>
                  <input
                    aria-label="Ngày đặt đến"
                    min={activeState.bookedFrom}
                    onChange={(event) =>
                      changeDateRange('booked', 'To', event.target.value)
                    }
                    type="date"
                    value={activeState.bookedTo ?? ''}
                  />
                </label>
                <label className={styles.dateFilter}>
                  <span>Khởi hành từ</span>
                  <input
                    aria-label="Ngày khởi hành từ"
                    max={activeState.departureTo}
                    onChange={(event) =>
                      changeDateRange('departure', 'From', event.target.value)
                    }
                    type="date"
                    value={activeState.departureFrom ?? ''}
                  />
                </label>
                <label className={styles.dateFilter}>
                  <span>Đến</span>
                  <input
                    aria-label="Ngày khởi hành đến"
                    min={activeState.departureFrom}
                    onChange={(event) =>
                      changeDateRange('departure', 'To', event.target.value)
                    }
                    type="date"
                    value={activeState.departureTo ?? ''}
                  />
                </label>
                <label className={styles.pageSize}>
                  <span>Số dòng</span>
                  <select
                    aria-label="Số dòng mỗi trang"
                    onChange={(event) =>
                      updateListState((current) => ({
                        ...current,
                        pageSize: Number(event.target.value),
                        page: 1,
                      }))
                    }
                    value={activeState.pageSize}
                  >
                    {[10, 25, 50, 100].map((size) => (
                      <option key={size} value={size}>
                        {size}
                      </option>
                    ))}
                  </select>
                </label>
                <label className={styles.pageSize}>
                  <span>Sắp xếp theo</span>
                  <select
                    aria-label="Sắp xếp theo"
                    onChange={(event) =>
                      changeSort(event.target.value as BookingManagementSortKey)
                    }
                    value={activeState.sortBy}
                  >
                    {sortOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className={styles.pageSize}>
                  <span>Hướng sắp xếp</span>
                  <select
                    aria-label="Hướng sắp xếp"
                    onChange={(event) =>
                      changeSortDirection(event.target.value as 'asc' | 'desc')
                    }
                    value={activeState.sortDirection}
                  >
                    <option value="desc">Giảm dần</option>
                    <option value="asc">Tăng dần</option>
                  </select>
                </label>
                {hasFilters && (
                  <button
                    className={styles.resetButton}
                    onClick={resetFilters}
                    type="button"
                  >
                    Xóa bộ lọc
                  </button>
                )}
              </FilterToolbar>

              {loading && !resultPage && (
                <AdminTableSkeleton
                  resourceLabel={
                    urlState.tab === 'bookings' ? 'phiếu đặt vé' : 'vé'
                  }
                />
              )}

              {Boolean(requestError) && (
                <div className={styles.error} role="alert">
                  <p>{getErrorMessage(requestError)}</p>
                  <button
                    className={styles.retryButton}
                    onClick={() => setRetryKey((key) => key + 1)}
                    type="button"
                  >
                    Thử lại
                  </button>
                </div>
              )}

              {!requestError &&
                !loading &&
                resultPage &&
                items.length === 0 && (
                  <div className={styles.empty} role="status">
                    <Search aria-hidden="true" size={21} />
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
                      <button
                        className={styles.resetButton}
                        onClick={resetFilters}
                        type="button"
                      >
                        Xóa bộ lọc
                      </button>
                    )}
                  </div>
                )}

              {resultPage && items.length > 0 && (
                <>
                  <div aria-busy={loading} className={styles.tableWrap}>
                    {urlState.tab === 'bookings' ? (
                      <BookingTable
                        items={(resultPage as BookingPage).data}
                        onSort={changeSort}
                        state={urlState}
                      />
                    ) : (
                      <TicketTable
                        items={(resultPage as TicketPage).data}
                        onSort={changeSort}
                        state={urlState}
                      />
                    )}
                  </div>
                  {urlState.tab === 'bookings' ? (
                    <BookingCards
                      items={(resultPage as BookingPage).data}
                      state={urlState}
                    />
                  ) : (
                    <TicketCards
                      items={(resultPage as TicketPage).data}
                      state={urlState}
                    />
                  )}
                </>
              )}
              {resultPage && resultPage.meta.totalItems > 0 && (
                <AdminPagination
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
            </div>
          </div>
        </section>
        <footer className="admin-page-footer">
          <span>© 2026 VexGo Platform</span>
        </footer>
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
    <button
      className="admin-resource-sort-button"
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
    </button>
  );
}

function BookingTable({
  items,
  onSort,
  state,
}: {
  items: AdminBookingListItem[];
  onSort: (sortBy: BookingManagementSortKey) => void;
  state: BookingManagementUrlState;
}) {
  const sortState = state.bookings;
  return (
    <table className="admin-resource-table">
      <caption className="sr-only">Danh sách phiếu đặt vé</caption>
      <thead>
        <tr>
          <th
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
          </th>
          <th scope="col">Khách hàng</th>
          <th
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
          </th>
          <th scope="col">Số vé</th>
          <th
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
          </th>
          <th scope="col">Trạng thái phiếu</th>
          <th scope="col">
            <span className="sr-only">Chi tiết</span>
          </th>
        </tr>
      </thead>
      <tbody>
        {items.map((item) => (
          <tr key={item.bookingId}>
            <th scope="row">
              <Link
                className="admin-data-mono"
                href={detailHref('bookings', item.bookingId, state)}
              >
                {item.bookingCode}
              </Link>
              <small className={styles.secondary}>
                {formatTimestamp(item.bookedAt)}
              </small>
            </th>
            <td>
              {item.customer.name}
              <small className={styles.secondary}>
                {item.customer.phoneNumber}
              </small>
            </td>
            <td>
              {item.trip ? (
                <>
                  {item.trip.origin} → {item.trip.destination}
                  <small className={styles.secondary}>
                    {formatTimestamp(item.trip.departureAt)}
                  </small>
                </>
              ) : (
                <span title={item.tripIntegrity}>Chuyến chưa xác định</span>
              )}
            </td>
            <td>
              {item.activeTicketCount}/{item.ticketCount} còn hiệu lực
              {item.isPartiallyCancelled && (
                <small className={styles.partial}>
                  Hủy {item.cancelledTicketCount}/{item.ticketCount} vé
                </small>
              )}
            </td>
            <td>{formatVnd(item.initialTicketAmount)}</td>
            <td>
              <AdminStatusBadge
                tone={statusIsActive(item.status) ? 'active' : 'muted'}
              >
                {statusLabel(item.status)}
              </AdminStatusBadge>
            </td>
            <td>
              <Link
                className={styles.detailLink}
                href={detailHref('bookings', item.bookingId, state)}
              >
                Xem chi tiết
                <span className="sr-only"> phiếu {item.bookingCode}</span>
              </Link>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function TicketTable({
  items,
  onSort,
  state,
}: {
  items: AdminTicketListItem[];
  onSort: (sortBy: BookingManagementSortKey) => void;
  state: BookingManagementUrlState;
}) {
  const sortState = state.tickets;
  return (
    <table className="admin-resource-table">
      <caption className="sr-only">Danh sách vé</caption>
      <thead>
        <tr>
          <th scope="col">Mã vé</th>
          <th scope="col">Phiếu đặt</th>
          <th scope="col">Khách hàng</th>
          <th
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
          </th>
          <th scope="col">Ghế</th>
          <th
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
          </th>
          <th scope="col">Trạng thái vé</th>
          <th scope="col">
            <span className="sr-only">Chi tiết</span>
          </th>
        </tr>
      </thead>
      <tbody>
        {items.map((item) => (
          <tr key={item.ticketId}>
            <th scope="row">
              <Link
                className="admin-data-mono"
                href={detailHref('tickets', item.ticketId, state)}
              >
                {item.ticketCode}
              </Link>
              <small className={styles.secondary}>
                Đặt {formatTimestamp(item.bookedAt)}
              </small>
            </th>
            <td>
              <Link
                href={detailHref('bookings', item.bookingId, {
                  ...state,
                  tab: 'bookings',
                })}
              >
                {item.bookingCode}
              </Link>
            </td>
            <td>
              {item.customer.name}
              <small className={styles.secondary}>
                {item.customer.phoneNumber}
              </small>
            </td>
            <td>
              {item.trip ? (
                <>
                  {item.trip.origin} → {item.trip.destination}
                  <small className={styles.secondary}>
                    {formatTimestamp(item.trip.departureAt)}
                  </small>
                </>
              ) : (
                <span title={item.tripIntegrity}>Chuyến chưa xác định</span>
              )}
            </td>
            <td>{item.seatNumber ?? '—'}</td>
            <td>{formatVnd(item.actualPrice)}</td>
            <td>
              <AdminStatusBadge
                tone={item.status === 'DA_DAT' ? 'active' : 'muted'}
              >
                {statusLabel(item.status)}
              </AdminStatusBadge>
            </td>
            <td>
              <Link
                className={styles.detailLink}
                href={detailHref('tickets', item.ticketId, state)}
              >
                Chi tiết<span className="sr-only"> vé {item.ticketCode}</span>
              </Link>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function BookingCards({
  items,
  state,
}: {
  items: AdminBookingListItem[];
  state: BookingManagementUrlState;
}) {
  return (
    <ul
      aria-label="Danh sách phiếu đặt vé dạng thẻ"
      className={styles.mobileCards}
    >
      {items.map((item) => (
        <li className={styles.mobileCard} key={item.bookingId}>
          <div className={styles.cardHeader}>
            <div>
              <Link
                className="admin-data-mono"
                href={detailHref('bookings', item.bookingId, state)}
              >
                {item.bookingCode}
              </Link>
              <p>{item.customer.name}</p>
            </div>
            <AdminStatusBadge
              tone={statusIsActive(item.status) ? 'active' : 'muted'}
            >
              {statusLabel(item.status)}
            </AdminStatusBadge>
          </div>
          <dl className={styles.cardDetails}>
            <div>
              <dt>Điện thoại</dt>
              <dd>{item.customer.phoneNumber}</dd>
            </div>
            <div>
              <dt>Ngày đặt</dt>
              <dd>{formatTimestamp(item.bookedAt)}</dd>
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
          <Link
            className={styles.detailLink}
            href={detailHref('bookings', item.bookingId, state)}
          >
            Xem chi tiết
          </Link>
        </li>
      ))}
    </ul>
  );
}

function TicketCards({
  items,
  state,
}: {
  items: AdminTicketListItem[];
  state: BookingManagementUrlState;
}) {
  return (
    <ul aria-label="Danh sách vé dạng thẻ" className={styles.mobileCards}>
      {items.map((item) => (
        <li className={styles.mobileCard} key={item.ticketId}>
          <div className={styles.cardHeader}>
            <div>
              <Link
                className="admin-data-mono"
                href={detailHref('tickets', item.ticketId, state)}
              >
                {item.ticketCode}
              </Link>
              <p>{item.customer.name}</p>
            </div>
            <AdminStatusBadge
              tone={item.status === 'DA_DAT' ? 'active' : 'muted'}
            >
              {statusLabel(item.status)}
            </AdminStatusBadge>
          </div>
          <dl className={styles.cardDetails}>
            <div>
              <dt>Phiếu đặt</dt>
              <dd>
                <Link
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
              <dd>{formatTimestamp(item.trip?.departureAt)}</dd>
            </div>
            <div>
              <dt>Ghế</dt>
              <dd>{item.seatNumber ?? '—'}</dd>
            </div>
            <div>
              <dt>Giá thực tế</dt>
              <dd>{formatVnd(item.actualPrice)}</dd>
            </div>
          </dl>
          <Link
            className={styles.detailLink}
            href={detailHref('tickets', item.ticketId, state)}
          >
            Xem chi tiết
          </Link>
        </li>
      ))}
    </ul>
  );
}
