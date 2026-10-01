'use client';

import { ArrowDown, ArrowUp, ArrowUpDown, Search, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { AdminDetailAction } from '@/components/admin/admin-detail-action';
import { AdminDetailSheet } from '@/components/admin/admin-detail-sheet';
import {
  AdminCreateAction,
  AdminRefreshAction,
} from '@/components/admin/admin-page-actions';
import { AdminPageHeader } from '@/components/admin/admin-page-header';
import { AdminPagination } from '@/components/admin/admin-pagination';
import { AdminStatusBadge } from '@/components/admin/admin-status-badge';
import { AdminTableSkeleton } from '@/components/admin/admin-table-skeleton';
import { Button } from '@/components/ui/button';
import {
  FilterToolbar,
  SearchInput,
  SelectFilter,
} from '@/components/data-filters/data-filters';
import { useAdminSession } from '@/features/admin-auth/hooks/use-admin-session';
import { hasPlatformAdminPermission } from '@/features/admin-auth/services/admin-access';
import { SuperAdminLayout } from '@/features/super-admin-layout/components/super-admin-layout';
import { getAdminAccountById } from '../services/admin-account-service';
import { useAdminAccounts } from '../hooks/use-admin-accounts';
import type {
  AdminAccount,
  AdminAccountSortKey,
  AdminAccountStatus,
} from '../types/admin-account';
import { AdminAccountFormDialog } from './admin-account-form-dialog';
import styles from './admin-accounts-management.module.css';

const STATUS_OPTIONS = [
  { value: 'HOAT_DONG', label: 'Đang hoạt động' },
  { value: 'TAM_KHOA', label: 'Đang khóa' },
];

const ROLE_LABELS: Record<string, string> = {
  NHA_XE_ADMIN: 'Quản trị nhà xe',
  NHAN_VIEN_BAN_VE: 'Nhân viên bán vé',
  NHAN_VIEN_CSKH: 'Nhân viên CSKH',
  NHAN_VIEN_PHU_XE: 'Nhân viên phụ xe',
  NHAN_VIEN_KINH_DOANH: 'Nhân viên kinh doanh',
};

function roleLabel(role: string) {
  return ROLE_LABELS[role] ?? role.replaceAll('_', ' ');
}

function statusLabel(status: AdminAccountStatus) {
  return status === 'HOAT_DONG' ? 'Đang hoạt động' : 'Đang khóa';
}

function formatTimestamp(value: string) {
  const timestamp = new Date(value);
  if (Number.isNaN(timestamp.getTime())) return 'Chưa có thông tin';
  return new Intl.DateTimeFormat('vi-VN', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(timestamp);
}

function formatDate(value: string | null) {
  if (!value) return 'Chưa cập nhật';
  const date = new Date(`${value.slice(0, 10)}T00:00:00`);
  if (Number.isNaN(date.getTime())) return 'Chưa cập nhật';
  return new Intl.DateTimeFormat('vi-VN', { dateStyle: 'medium' }).format(date);
}

type AccountDetailState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'success'; account: AdminAccount };

function AccountDetailSheet({
  accountId,
  canUpdate,
  onClose,
  onAccountUpdated,
}: {
  accountId: number;
  canUpdate: boolean;
  onClose: () => void;
  onAccountUpdated: (account: AdminAccount) => void;
}) {
  const [detail, setDetail] = useState<AccountDetailState>({
    status: 'loading',
  });
  const [retryCount, setRetryCount] = useState(0);
  const [editOpen, setEditOpen] = useState(false);

  useEffect(() => {
    const controller = new AbortController();

    getAdminAccountById(accountId, controller.signal)
      .then((account) => {
        if (!controller.signal.aborted)
          setDetail({ status: 'success', account });
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        setDetail({
          status: 'error',
          message:
            error instanceof Error
              ? error.message
              : 'Không thể tải thông tin tài khoản.',
        });
      });

    return () => controller.abort();
  }, [accountId, retryCount]);

  function retry() {
    setDetail({ status: 'loading' });
    setRetryCount((count) => count + 1);
  }

  return (
    <>
      <AdminDetailSheet
        ariaLabelledBy="admin-account-detail-title"
        onClose={onClose}
      >
        <div className="admin-dialog-header">
          <div className="admin-dialog-header__copy">
            <p className="eyebrow">HỒ SƠ TÀI KHOẢN</p>
            <h2 id="admin-account-detail-title">Thông tin tài khoản</h2>
          </div>
          {canUpdate && detail.status === 'success' && (
            <Button
              aria-label="Chỉnh sửa thông tin tài khoản"
              onClick={() => setEditOpen(true)}
              type="button"
              variant="secondary"
            >
              Chỉnh sửa
            </Button>
          )}
          <form method="dialog">
            <button
              aria-label="Đóng thông tin tài khoản"
              className="icon-button"
              type="submit"
            >
              <X aria-hidden="true" size={19} />
            </button>
          </form>
        </div>

        {detail.status === 'loading' && (
          <p aria-live="polite" role="status">
            Đang tải thông tin tài khoản…
          </p>
        )}
        {detail.status === 'error' && (
          <div role="alert">
            <p>{detail.message}</p>
            <Button onClick={retry} type="button" variant="secondary">
              Thử lại
            </Button>
          </div>
        )}
        {detail.status === 'success' && (
          <>
            <div className={styles.detailHero}>
              <span aria-hidden="true" className={styles.avatar}>
                {detail.account.fullName
                  .trim()
                  .charAt(0)
                  .toLocaleUpperCase('vi-VN') || 'A'}
              </span>
              <div>
                <h3>{detail.account.fullName}</h3>
                <span>
                  {detail.account.email ?? detail.account.phoneNumber}
                </span>
              </div>
            </div>

            <section
              aria-labelledby="account-identity-heading"
              className="detail-section"
            >
              <h3 id="account-identity-heading">Thông tin định danh</h3>
              <dl className={styles.detailGrid}>
                <div>
                  <dt>Số điện thoại</dt>
                  <dd>{detail.account.phoneNumber}</dd>
                </div>
                <div>
                  <dt>Email</dt>
                  <dd>{detail.account.email ?? 'Chưa cập nhật'}</dd>
                </div>
                <div>
                  <dt>Ngày sinh</dt>
                  <dd>{formatDate(detail.account.dateOfBirth)}</dd>
                </div>
                <div>
                  <dt>CCCD</dt>
                  <dd>{detail.account.citizenId ?? 'Chưa cập nhật'}</dd>
                </div>
                <div>
                  <dt>Mã nhân viên</dt>
                  <dd>{detail.account.employee.employeeCode}</dd>
                </div>
                <div>
                  <dt>Trạng thái nhân viên</dt>
                  <dd>{detail.account.employee.employmentStatus}</dd>
                </div>
              </dl>
            </section>

            <section
              aria-labelledby="account-scope-heading"
              className="detail-section"
            >
              <h3 id="account-scope-heading">Phạm vi và vai trò</h3>
              <dl className={styles.detailGrid}>
                <div>
                  <dt>Nhà xe</dt>
                  <dd>
                    {detail.account.busCompany.name} ·{' '}
                    {detail.account.busCompany.code}
                  </dd>
                </div>
                <div>
                  <dt>Trạng thái tài khoản</dt>
                  <dd>
                    <AdminStatusBadge
                      tone={
                        detail.account.status === 'HOAT_DONG'
                          ? 'active'
                          : 'muted'
                      }
                    >
                      {statusLabel(detail.account.status)}
                    </AdminStatusBadge>
                  </dd>
                </div>
                <div className={styles.detailWide}>
                  <dt>Vai trò</dt>
                  <dd>
                    {detail.account.roles.length > 0
                      ? detail.account.roles.map((role) => (
                          <AdminStatusBadge key={role} tone="muted">
                            {roleLabel(role)}
                          </AdminStatusBadge>
                        ))
                      : 'Chưa được gán vai trò'}
                  </dd>
                </div>
                <div>
                  <dt>Số điện thoại đã xác minh</dt>
                  <dd>
                    {detail.account.phoneVerified
                      ? 'Đã xác minh'
                      : 'Chưa xác minh'}
                  </dd>
                </div>
                <div>
                  <dt>Ngày tạo</dt>
                  <dd>{formatTimestamp(detail.account.createdAt)}</dd>
                </div>
                <div>
                  <dt>Cập nhật lần cuối</dt>
                  <dd>{formatTimestamp(detail.account.updatedAt)}</dd>
                </div>
              </dl>
            </section>
          </>
        )}
      </AdminDetailSheet>
      {editOpen && detail.status === 'success' && (
        <AdminAccountFormDialog
          account={detail.account}
          onClose={() => setEditOpen(false)}
          onSaved={(updatedAccount) => {
            setDetail({ status: 'success', account: updatedAccount });
            setEditOpen(false);
            onAccountUpdated(updatedAccount);
          }}
        />
      )}
    </>
  );
}

export function AdminAccountsManagement() {
  const {
    accountPage,
    error,
    loading,
    page,
    searchInput,
    sortBy,
    sortDirection,
    status,
    changePage,
    refresh,
    sortAccounts,
    updateSearch,
    updateStatus,
  } = useAdminAccounts();
  const authState = useAdminSession();
  const session =
    authState.status === 'authenticated' ? authState.session : null;
  const canCreate = hasPlatformAdminPermission(session, 'admin-account:create');
  const canUpdate = hasPlatformAdminPermission(session, 'admin-account:update');
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedAccountId, setSelectedAccountId] = useState<number | null>(
    null,
  );

  function sortableHeader(label: string, key: AdminAccountSortKey) {
    const selected = sortBy === key;
    return (
      <th
        aria-sort={
          selected
            ? sortDirection === 'asc'
              ? 'ascending'
              : 'descending'
            : 'none'
        }
        scope="col"
      >
        <button
          className={styles.sortButton}
          onClick={() => sortAccounts(key)}
          type="button"
        >
          {label}
          {selected ? (
            sortDirection === 'asc' ? (
              <ArrowUp aria-hidden="true" size={14} />
            ) : (
              <ArrowDown aria-hidden="true" size={14} />
            )
          ) : (
            <ArrowUpDown aria-hidden="true" size={14} />
          )}
        </button>
      </th>
    );
  }

  return (
    <SuperAdminLayout activeSection="admin-accounts">
      <div className={`admin-page-content ${styles.page}`}>
        <AdminPageHeader
          actions={
            <div className="page-intro-actions">
              {canCreate && (
                <AdminCreateAction
                  label="Thêm mới"
                  onClick={() => setCreateOpen(true)}
                />
              )}
              <AdminRefreshAction loading={loading} onClick={refresh} />
            </div>
          }
          eyebrow="QUẢN TRỊ NỀN TẢNG"
          title="Quản lý tài khoản Admin"
          titleId="page-title"
        />

        <section
          aria-labelledby="admin-accounts-heading"
          className={`panel ${styles.panel}`}
        >
          <h2 className="sr-only" id="admin-accounts-heading">
            Danh sách tài khoản Admin
          </h2>
          <FilterToolbar
            totalItems={error ? null : (accountPage?.meta.totalItems ?? null)}
          >
            <SearchInput
              label="Tìm tài khoản Admin"
              onChange={updateSearch}
              placeholder="Tìm theo tên, số điện thoại, email hoặc nhà xe"
              value={searchInput}
            />
            <SelectFilter
              allLabel="Tất cả trạng thái"
              label="Lọc theo trạng thái tài khoản"
              onChange={updateStatus}
              options={STATUS_OPTIONS}
              value={status}
            />
          </FilterToolbar>

          {error && (
            <div className="table-error" role="alert">
              <div>
                <strong>Chưa tải được danh sách tài khoản Admin</strong>
                <p>{error}</p>
              </div>
              <Button onClick={refresh} type="button" variant="secondary">
                Thử lại
              </Button>
            </div>
          )}

          {loading && !accountPage && !error && (
            <AdminTableSkeleton resourceLabel="tài khoản Admin" />
          )}

          {!loading && !error && accountPage?.data.length === 0 && (
            <div className={styles.emptyState}>
              <span aria-hidden="true" className={styles.emptyIcon}>
                <Search size={21} />
              </span>
              <h3>Không tìm thấy tài khoản Admin</h3>
              <p>Thử thay đổi từ khóa hoặc trạng thái lọc.</p>
            </div>
          )}

          {accountPage && accountPage.data.length > 0 && (
            <>
              <div
                aria-busy={loading}
                className={`${styles.tableScroll}${loading ? ` ${styles.isLoading}` : ''}`}
              >
                <table className={styles.table}>
                  <thead>
                    <tr>
                      {sortableHeader('Họ và tên', 'fullName')}
                      {sortableHeader('Số điện thoại', 'phoneNumber')}
                      <th scope="col">Nhà xe</th>
                      <th scope="col">Vai trò</th>
                      {sortableHeader('Trạng thái', 'status')}
                      {sortableHeader('Ngày tạo', 'createdAt')}
                      <th scope="col">
                        <span className="sr-only">Thao tác</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {accountPage.data.map((account) => (
                      <tr key={account.accountId}>
                        <th className={styles.identityCell} scope="row">
                          <span className={styles.accountIdentity}>
                            <span aria-hidden="true" className={styles.avatar}>
                              {account.fullName
                                .trim()
                                .charAt(0)
                                .toLocaleUpperCase('vi-VN') || 'A'}
                            </span>
                            <span className={styles.identityCopy}>
                              <span>{account.fullName}</span>
                              <small>{account.employee.employeeCode}</small>
                            </span>
                          </span>
                        </th>
                        <td className={styles.contactCell}>
                          <span>{account.phoneNumber}</span>
                          {account.email && <small>{account.email}</small>}
                        </td>
                        <td>{account.busCompany.name}</td>
                        <td>
                          <div className={styles.roleList}>
                            {account.roles.length > 0
                              ? account.roles.map((role) => (
                                  <AdminStatusBadge key={role} tone="muted">
                                    {roleLabel(role)}
                                  </AdminStatusBadge>
                                ))
                              : 'Chưa được gán vai trò'}
                          </div>
                        </td>
                        <td>
                          <AdminStatusBadge
                            tone={
                              account.status === 'HOAT_DONG'
                                ? 'active'
                                : 'muted'
                            }
                          >
                            {statusLabel(account.status)}
                          </AdminStatusBadge>
                        </td>
                        <td>{formatTimestamp(account.createdAt)}</td>
                        <td>
                          <AdminDetailAction
                            onClick={() =>
                              setSelectedAccountId(account.accountId)
                            }
                            resourceName={`tài khoản ${account.fullName}`}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div aria-busy={loading} className={styles.mobileList}>
                {accountPage.data.map((account) => (
                  <article
                    aria-label={`Tài khoản ${account.fullName}`}
                    className={styles.accountCard}
                    key={account.accountId}
                  >
                    <div className={styles.accountIdentity}>
                      <span aria-hidden="true" className={styles.avatar}>
                        {account.fullName
                          .trim()
                          .charAt(0)
                          .toLocaleUpperCase('vi-VN') || 'A'}
                      </span>
                      <div className={styles.identityCopy}>
                        <h3>{account.fullName}</h3>
                        <p>{account.phoneNumber}</p>
                        {account.email && <p>{account.email}</p>}
                      </div>
                    </div>
                    <dl className={styles.accountMeta}>
                      <div>
                        <dt>Nhà xe</dt>
                        <dd>{account.busCompany.name}</dd>
                      </div>
                      <div>
                        <dt>Vai trò</dt>
                        <dd>
                          {account.roles.length > 0
                            ? account.roles.map((role) => (
                                <AdminStatusBadge key={role} tone="muted">
                                  {roleLabel(role)}
                                </AdminStatusBadge>
                              ))
                            : 'Chưa được gán vai trò'}
                        </dd>
                      </div>
                      <div>
                        <dt>Trạng thái</dt>
                        <dd>
                          <AdminStatusBadge
                            tone={
                              account.status === 'HOAT_DONG'
                                ? 'active'
                                : 'muted'
                            }
                          >
                            {statusLabel(account.status)}
                          </AdminStatusBadge>
                        </dd>
                      </div>
                    </dl>
                    <div className={styles.cardActions}>
                      <AdminDetailAction
                        onClick={() => setSelectedAccountId(account.accountId)}
                        resourceName={`tài khoản ${account.fullName}`}
                      />
                    </div>
                  </article>
                ))}
              </div>
              <AdminPagination
                currentPage={page}
                disabled={loading}
                onPageChange={changePage}
                pageSize={accountPage.meta.pageSize}
                summaryLabel="tài khoản"
                totalItems={accountPage.meta.totalItems}
                totalPages={accountPage.meta.totalPages}
              />
            </>
          )}
        </section>
      </div>

      {selectedAccountId !== null && (
        <AccountDetailSheet
          accountId={selectedAccountId}
          canUpdate={canUpdate}
          key={selectedAccountId}
          onClose={() => setSelectedAccountId(null)}
          onAccountUpdated={() => refresh()}
        />
      )}
      {createOpen && (
        <AdminAccountFormDialog
          onClose={() => setCreateOpen(false)}
          onSaved={() => refresh()}
        />
      )}
    </SuperAdminLayout>
  );
}
