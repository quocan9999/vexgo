'use client';

import { Building2, LoaderCircle, Search } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { AdminPageHeader } from '@/components/admin/admin-page-header';
import { AdminRefreshAction } from '@/components/admin/admin-page-actions';
import { SuperAdminLayout } from '@/features/super-admin-layout/components/super-admin-layout';
import { getBusCompanyFilterOptions } from '@/features/bus-companies/services/bus-company-service';
import type { BusCompanyFilterOption } from '@/features/bus-companies/services/bus-company-service';
import { PlatformRbacScopeNavigation } from './platform-rbac-scope-navigation';
import styles from './platform-tenant-rbac-picker.module.css';

function getErrorMessage(error: unknown): string {
  return error instanceof Error && error.message
    ? error.message
    : 'Không thể tải danh sách nhà xe.';
}

export function PlatformTenantRbacPicker() {
  const [companies, setCompanies] = useState<BusCompanyFilterOption[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loadAttempt, setLoadAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    void getBusCompanyFilterOptions(controller.signal)
      .then((options) => {
        if (!controller.signal.aborted) setCompanies(options);
      })
      .catch((reason: unknown) => {
        if (!controller.signal.aborted) setError(getErrorMessage(reason));
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [loadAttempt]);

  function retryLoading() {
    setLoading(true);
    setError(null);
    setLoadAttempt((attempt) => attempt + 1);
  }

  const filteredCompanies = useMemo(() => {
    const normalizedSearch = search.trim().toLocaleLowerCase('vi-VN');
    return normalizedSearch
      ? companies.filter((company) =>
          company.label.toLocaleLowerCase('vi-VN').includes(normalizedSearch),
        )
      : companies;
  }, [companies, search]);

  return (
    <SuperAdminLayout activeSection="rbac">
      <div className="admin-page-content">
        <AdminPageHeader
          eyebrow="QUẢN TRỊ NỀN TẢNG"
          title="Phân quyền theo nhà xe"
          titleId="platform-tenant-rbac-title"
          actions={
            <AdminRefreshAction
              loading={loading}
              onClick={retryLoading}
            />
          }
        />

        <PlatformRbacScopeNavigation activeScope="tenant" />

        <section aria-labelledby="tenant-rbac-picker-title" className={styles.section}>
          <div className={styles.sectionHeading}>
            <div>
              <p className="eyebrow">CẤU HÌNH RIÊNG</p>
              <h2 id="tenant-rbac-picker-title">Chọn nhà xe</h2>
            </div>
            <span className={styles.count}>
              {loading ? 'Đang tải' : `${filteredCompanies.length} nhà xe`}
            </span>
          </div>

          <label className={styles.searchField}>
            <Search aria-hidden="true" size={18} />
            <span className="sr-only">Tìm nhà xe</span>
            <input
              autoComplete="off"
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Tìm theo tên hoặc mã nhà xe"
              type="search"
              value={search}
            />
          </label>

          {loading && (
            <div className={styles.state} role="status" aria-live="polite">
              <LoaderCircle aria-hidden="true" className={styles.spinner} size={20} />
              Đang tải danh sách nhà xe…
            </div>
          )}

          {!loading && error && (
            <div className={styles.errorState} role="alert">
              <p>{error}</p>
              <button
                className="button button-secondary"
                onClick={retryLoading}
                type="button"
              >
                Thử tải lại
              </button>
            </div>
          )}

          {!loading && !error && companies.length === 0 && (
            <p className={styles.state}>Chưa có nhà xe để cấu hình phân quyền.</p>
          )}

          {!loading && !error && companies.length > 0 && filteredCompanies.length === 0 && (
            <p className={styles.state}>
              Không tìm thấy nhà xe phù hợp với “{search.trim()}”.
            </p>
          )}

          {!loading && !error && filteredCompanies.length > 0 && (
            <ul aria-label="Danh sách nhà xe" className={styles.companyGrid}>
              {filteredCompanies.map((company) => (
                <li key={company.id}>
                  <Link
                    className={styles.companyLink}
                    href={`/rbac/tenants/${company.id}`}
                  >
                    <span aria-hidden="true" className={styles.companyIcon}>
                      <Building2 size={19} />
                    </span>
                    <span className={styles.companyName}>{company.label}</span>
                    <span aria-hidden="true" className={styles.arrow}>›</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </SuperAdminLayout>
  );
}
