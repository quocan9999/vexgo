'use client';

import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react';
import { useState } from 'react';
import { AdminDetailAction } from '@/components/admin/admin-detail-action';
import { AdminRefreshAction } from '@/components/admin/admin-page-actions';
import { AdminPageHeader } from '@/components/admin/admin-page-header';
import { AdminPagination } from '@/components/admin/admin-pagination';
import { AdminStatusBadge } from '@/components/admin/admin-status-badge';
import { AdminTableSkeleton } from '@/components/admin/admin-table-skeleton';
import {
  FilterToolbar,
  SearchInput,
  SelectFilter,
  type FilterOption,
} from '@/components/data-filters/data-filters';
import { Button } from '@/components/ui/button';
import { SuperAdminLayout } from '@/features/super-admin-layout/components/super-admin-layout';
import { useCustomers } from '../hooks/use-customers';
import type { CustomerAccountStatus, CustomerSortKey } from '../types/customer';
import { CustomerDetails } from './customer-details';
import '../customers.css';

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
        <span className="sort-header-icon" aria-hidden="true">
          <ArrowUpDown size={14} />
        </span>
      );
    }
    return (
      <span className="sort-header-icon" aria-hidden="true">
        {sortDirection === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />}
      </span>
    );
  }

  function getAriaSort(key: CustomerSortKey): 'none' | 'ascending' | 'descending' {
    if (sortBy !== key) return 'none';
    return sortDirection === 'asc' ? 'ascending' : 'descending';
  }

  const isFiltered = Boolean(searchInput || accountStatus);

  return (
    <SuperAdminLayout activeSection="customers">
      <AdminPageHeader
        actions={<AdminRefreshAction loading={refreshing} onClick={refresh} />}
        eyebrow="QUẢN LÝ KHÁCH HÀNG"
        title="Quản lý khách hàng"
        titleId="customers-page-title"
      />

      <section
        className="customers-section"
        aria-labelledby="customers-table-heading"
      >
        <h2 id="customers-table-heading" className="sr-only">
          Danh sách khách hàng
        </h2>

        <FilterToolbar
          totalItems={error ? null : loading ? null : meta.totalItems}
        >
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

        {error && (
          <div className="admin-error-panel" role="alert">
            <p>{error}</p>
            <Button onClick={refresh} type="button" variant="secondary">
              Thử lại
            </Button>
          </div>
        )}

        {loading && customers.length === 0 ? (
          <AdminTableSkeleton resourceLabel="khách hàng" />
        ) : customers.length === 0 ? (
          <div className="customers-state-panel">
            <p>
              {isFiltered
                ? 'Không tìm thấy khách hàng phù hợp với bộ lọc.'
                : 'Chưa có khách hàng nào trong hệ thống nhà xe.'}
            </p>
            {isFiltered && (
              <Button onClick={resetFilters} type="button" variant="secondary">
                Đặt lại bộ lọc
              </Button>
            )}
          </div>
        ) : (
          <>
            <div className="admin-table-container">
              <table
                className="admin-table"
                aria-busy={loading || refreshing}
              >
                <thead>
                  <tr>
                    <th scope="col" aria-sort={getAriaSort('customerCode')}>
                      <button
                        type="button"
                        className="sort-header-button"
                        onClick={() => handleSort('customerCode')}
                      >
                        <span>Mã KH</span>
                        {renderSortIcon('customerCode')}
                      </button>
                    </th>
                    <th scope="col" aria-sort={getAriaSort('fullName')}>
                      <button
                        type="button"
                        className="sort-header-button"
                        onClick={() => handleSort('fullName')}
                      >
                        <span>Họ tên</span>
                        {renderSortIcon('fullName')}
                      </button>
                    </th>
                    <th scope="col">Số điện thoại</th>
                    <th scope="col">Email</th>
                    <th scope="col" aria-sort={getAriaSort('loyaltyPoints')}>
                      <button
                        type="button"
                        className="sort-header-button"
                        onClick={() => handleSort('loyaltyPoints')}
                      >
                        <span>Điểm tích lũy</span>
                        {renderSortIcon('loyaltyPoints')}
                      </button>
                    </th>
                    <th scope="col">Trạng thái tài khoản</th>
                    <th scope="col" className="text-right">
                      Thao tác
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {customers.map((customer) => (
                    <tr key={customer.customerId}>
                      <td>
                        <span className="customer-code">
                          {customer.customerCode}
                        </span>
                      </td>
                      <td>
                        <strong>{customer.fullName}</strong>
                      </td>
                      <td>{customer.phoneNumber}</td>
                      <td>{customer.email || '—'}</td>
                      <td>
                        <strong>
                          {customer.loyaltyPoints.toLocaleString('vi-VN')}
                        </strong>
                      </td>
                      <td>
                        <AdminStatusBadge
                          tone={
                            customer.account.status === 'HOAT_DONG'
                              ? 'active'
                              : 'muted'
                          }
                        >
                          {customer.account.status === 'HOAT_DONG'
                            ? 'Đang hoạt động'
                            : 'Tạm khóa'}
                        </AdminStatusBadge>
                      </td>
                      <td className="text-right">
                        <AdminDetailAction
                          resourceName={`khách hàng ${customer.customerCode}`}
                          onClick={() =>
                            setSelectedCustomerId(customer.customerId)
                          }
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <ul
              className="admin-mobile-cards"
              aria-label="Danh sách khách hàng dạng thẻ"
              aria-busy={loading || refreshing}
            >
              {customers.map((customer) => (
                <li key={customer.customerId} className="admin-mobile-card">
                  <div className="admin-mobile-card-header">
                    <div>
                      <span className="customer-code">
                        {customer.customerCode}
                      </span>
                      <h3 className="admin-mobile-card-title">
                        {customer.fullName}
                      </h3>
                    </div>
                    <AdminStatusBadge
                      tone={
                        customer.account.status === 'HOAT_DONG'
                          ? 'active'
                          : 'muted'
                      }
                    >
                      {customer.account.status === 'HOAT_DONG'
                        ? 'Đang hoạt động'
                        : 'Tạm khóa'}
                    </AdminStatusBadge>
                  </div>
                  <dl className="admin-mobile-card-details">
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
                        {customer.loyaltyPoints.toLocaleString('vi-VN')} điểm
                      </dd>
                    </div>
                  </dl>
                  <div className="admin-mobile-card-actions">
                    <AdminDetailAction
                      resourceName={`khách hàng ${customer.customerCode}`}
                      onClick={() => setSelectedCustomerId(customer.customerId)}
                    />
                  </div>
                </li>
              ))}
            </ul>

            {meta.totalPages > 1 && (
              <AdminPagination
                currentPage={page}
                disabled={loading}
                onPageChange={setPage}
                pageSize={meta.pageSize}
                summaryLabel="khách hàng"
                totalItems={meta.totalItems}
                totalPages={meta.totalPages}
              />
            )}
          </>
        )}
      </section>

      {selectedCustomerId !== null && (
        <CustomerDetails
          customerId={selectedCustomerId}
          onClose={() => setSelectedCustomerId(null)}
        />
      )}
    </SuperAdminLayout>
  );
}
