'use client';

import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react';
import { useState } from 'react';
import { AdminPageHeader } from '@/components/admin/admin-page-header';
import {
  ResourceDetailAction,
  ResourceRefreshAction,
  ResourcePagination,
  ResourceStatusBadge,
  ResourceTableSkeleton,
  ResourceState,
} from '@/components/admin/resource-ui';
import {
  FilterToolbar,
  SearchInput,
  SelectFilter,
  type FilterOption,
} from '@/components/data-filters/resource-filters';
import { Button } from '@/components/ui/action-button';
import { Card } from '@/components/ui/card';
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
import { useCustomers } from '../hooks/use-customers';
import type { CustomerAccountStatus, CustomerSortKey } from '../types/customer';
import { CustomerDetails } from './customer-details';

const STATUS_OPTIONS: FilterOption[] = [
  { value: 'HOAT_DONG', label: 'Đang hoạt động' },
  { value: 'TAM_KHOA', label: 'Tạm khóa' },
];

export function CustomersManagement() {
  const {
    customers,
    meta,
    loading,
    refreshing,
    error,
    searchInput,
    setSearchInput,
    page,
    setPage,
    accountStatus,
    setAccountStatus,
    sortBy,
    sortDirection,
    handleSort,
    refresh,
    resetFilters,
  } = useCustomers();

  const [selectedCustomerId, setSelectedCustomerId] = useState<number | null>(
    null,
  );

  function renderSortIcon(key: CustomerSortKey) {
    if (sortBy !== key) {
      return (
        <span aria-hidden="true">
          <ArrowUpDown size={14} />
        </span>
      );
    }
    return (
      <span aria-hidden="true">
        {sortDirection === 'asc' ? (
          <ArrowUp size={14} />
        ) : (
          <ArrowDown size={14} />
        )}
      </span>
    );
  }

  function getAriaSort(
    key: CustomerSortKey,
  ): 'none' | 'ascending' | 'descending' {
    if (sortBy !== key) return 'none';
    return sortDirection === 'asc' ? 'ascending' : 'descending';
  }

  const isFiltered = Boolean(searchInput || accountStatus);

  return (
    <SuperAdminLayout activeSection="customers">
      <div className="admin-page-content admin-ui space-y-6">
        <AdminPageHeader
          actions={
            <ResourceRefreshAction loading={refreshing} onClick={refresh} />
          }
          eyebrow="QUẢN LÝ KHÁCH HÀNG"
          title="Quản lý khách hàng"
          titleId="customers-page-title"
        />

        <section
          className="min-w-0"
          aria-busy={loading || refreshing}
          aria-labelledby="customers-table-heading"
        >
          <h2 id="customers-table-heading" className="sr-only">
            Danh sách khách hàng
          </h2>

          <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
            <FilterToolbar>
              <SearchInput
                label="Tìm kiếm khách hàng"
                onChange={setSearchInput}
                placeholder="Tìm theo mã, tên, SĐT, email..."
                value={searchInput}
              />
              <SelectFilter
                allLabel="Tất cả trạng thái"
                label="Trạng thái tài khoản"
                onChange={(val) =>
                  setAccountStatus(val as CustomerAccountStatus | '')
                }
                options={STATUS_OPTIONS}
                value={accountStatus}
              />
            </FilterToolbar>

            <div className="flex items-end gap-3 border-b p-4 min-[901px]:hidden">
              <SelectFilter
                label="Sắp xếp theo"
                allLabel="Mã khách hàng"
                value={sortBy}
                options={[
                  { value: 'customerCode', label: 'Mã khách hàng' },
                  { value: 'fullName', label: 'Họ tên' },
                  { value: 'loyaltyPoints', label: 'Điểm tích lũy' },
                  { value: 'createdAt', label: 'Ngày tạo' },
                  { value: 'updatedAt', label: 'Cập nhật' },
                ]}
                onChange={(value) => {
                  const key = (value || 'customerCode') as CustomerSortKey;
                  if (key !== sortBy) handleSort(key);
                }}
              />
              <Button
                variant="outline"
                aria-label={`Đổi thứ tự sắp xếp, hiện tại ${sortDirection === 'asc' ? 'tăng dần' : 'giảm dần'}`}
                onClick={() => handleSort(sortBy)}
              >
                {sortDirection === 'asc' ? (
                  <ArrowUp aria-hidden />
                ) : (
                  <ArrowDown aria-hidden />
                )}
                {sortDirection === 'asc' ? 'Tăng dần' : 'Giảm dần'}
              </Button>
            </div>

            {error && (
              <ResourceState error>
                <p>{error}</p>
                <Button onClick={refresh} type="button" variant="outline">
                  Thử lại
                </Button>
              </ResourceState>
            )}

            {!error &&
              (loading && customers.length === 0 ? (
                <ResourceTableSkeleton resourceLabel="khách hàng" />
              ) : customers.length === 0 ? (
                <ResourceState>
                  <p>
                    {isFiltered
                      ? 'Không tìm thấy khách hàng phù hợp với bộ lọc.'
                      : 'Chưa có khách hàng nào trong hệ thống nhà xe.'}
                  </p>
                  {isFiltered && (
                    <Button
                      onClick={resetFilters}
                      type="button"
                      variant="outline"
                    >
                      Đặt lại bộ lọc
                    </Button>
                  )}
                </ResourceState>
              ) : (
                <>
                  <div
                    className="hidden min-[901px]:block"
                    aria-busy={loading || refreshing}
                  >
                    <Table className="text-[13px]">
                      <TableCaption className="sr-only">
                        Danh sách khách hàng
                      </TableCaption>
                      <TableHeader>
                        <TableRow>
                          <TableHead
                            scope="col"
                            aria-sort={getAriaSort('customerCode')}
                          >
                            <Button
                              type="button"
                              className="-ml-3 font-semibold"
                              variant="ghost"
                              size="sm"
                              onClick={() => handleSort('customerCode')}
                            >
                              <span>Mã KH</span>
                              {renderSortIcon('customerCode')}
                            </Button>
                          </TableHead>
                          <TableHead
                            scope="col"
                            aria-sort={getAriaSort('fullName')}
                          >
                            <Button
                              type="button"
                              className="-ml-3 font-semibold"
                              variant="ghost"
                              size="sm"
                              onClick={() => handleSort('fullName')}
                            >
                              <span>Họ tên</span>
                              {renderSortIcon('fullName')}
                            </Button>
                          </TableHead>
                          <TableHead scope="col">Số điện thoại</TableHead>
                          <TableHead scope="col">Email</TableHead>
                          <TableHead
                            scope="col"
                            aria-sort={getAriaSort('loyaltyPoints')}
                          >
                            <Button
                              type="button"
                              className="-ml-3 font-semibold"
                              variant="ghost"
                              size="sm"
                              onClick={() => handleSort('loyaltyPoints')}
                            >
                              <span>Điểm tích lũy</span>
                              {renderSortIcon('loyaltyPoints')}
                            </Button>
                          </TableHead>
                          <TableHead scope="col">
                            Trạng thái tài khoản
                          </TableHead>
                          <TableHead scope="col">
                            <span className="sr-only">Thao tác</span>
                          </TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {customers.map((customer) => (
                          <TableRow key={customer.customerId}>
                            <TableCell>
                              <span className="admin-data-mono text-xs text-muted-foreground">
                                {customer.customerCode}
                              </span>
                            </TableCell>
                            <TableHead
                              scope="row"
                              className="bg-transparent py-3 text-[13px]"
                            >
                              <span>{customer.fullName}</span>
                            </TableHead>
                            <TableCell>{customer.phoneNumber}</TableCell>
                            <TableCell>{customer.email || '—'}</TableCell>
                            <TableCell>
                              <strong>
                                {customer.loyaltyPoints.toLocaleString('vi-VN')}
                              </strong>
                            </TableCell>
                            <TableCell>
                              <ResourceStatusBadge
                                tone={
                                  customer.account.status === 'HOAT_DONG'
                                    ? 'active'
                                    : 'muted'
                                }
                              >
                                {customer.account.status === 'HOAT_DONG'
                                  ? 'Đang hoạt động'
                                  : 'Tạm khóa'}
                              </ResourceStatusBadge>
                            </TableCell>
                            <TableCell>
                              <ResourceDetailAction
                                resourceName={`khách hàng ${customer.customerCode}`}
                                onClick={() =>
                                  setSelectedCustomerId(customer.customerId)
                                }
                              />
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>

                  <div
                    className="grid gap-4 p-4 min-[901px]:hidden"
                    aria-label="Danh sách khách hàng dạng thẻ"
                    aria-busy={loading || refreshing}
                  >
                    {customers.map((customer) => (
                      <Card key={customer.customerId} className="gap-4 p-4">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <span className="admin-data-mono text-xs text-muted-foreground">
                              {customer.customerCode}
                            </span>
                            <h3 className="mt-1 text-base font-semibold break-words">
                              {customer.fullName}
                            </h3>
                          </div>
                          <ResourceStatusBadge
                            tone={
                              customer.account.status === 'HOAT_DONG'
                                ? 'active'
                                : 'muted'
                            }
                          >
                            {customer.account.status === 'HOAT_DONG'
                              ? 'Đang hoạt động'
                              : 'Tạm khóa'}
                          </ResourceStatusBadge>
                        </div>
                        <dl className="grid grid-cols-2 gap-4 text-[13px] [&_dt]:text-xs [&_dt]:text-muted-foreground [&_dd]:mt-1 [&_dd]:break-words">
                          <div>
                            <dt>Số điện thoại</dt>
                            <dd>{customer.phoneNumber}</dd>
                          </div>
                          <div>
                            <dt>Email</dt>
                            <dd>{customer.email || '—'}</dd>
                          </div>
                          <div>
                            <dt>Điểm tích lũy</dt>
                            <dd>
                              {customer.loyaltyPoints.toLocaleString('vi-VN')}{' '}
                              điểm
                            </dd>
                          </div>
                        </dl>
                        <div className="flex justify-end border-t pt-3">
                          <ResourceDetailAction
                            resourceName={`khách hàng ${customer.customerCode}`}
                            onClick={() =>
                              setSelectedCustomerId(customer.customerId)
                            }
                          />
                        </div>
                      </Card>
                    ))}
                  </div>

                  {
                    <ResourcePagination
                      currentPage={page}
                      disabled={loading}
                      onPageChange={setPage}
                      pageSize={meta.pageSize}
                      summaryLabel="khách hàng"
                      totalItems={meta.totalItems}
                      totalPages={meta.totalPages}
                    />
                  }
                </>
              ))}
          </div>
        </section>
      </div>

      {selectedCustomerId !== null && (
        <CustomerDetails
          key={selectedCustomerId}
          customerId={selectedCustomerId}
          onClose={() => setSelectedCustomerId(null)}
        />
      )}
    </SuperAdminLayout>
  );
}
