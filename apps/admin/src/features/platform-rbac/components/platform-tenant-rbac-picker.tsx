'use client';

import { useTranslations } from 'next-intl';

import { Building2, ChevronRight, Search } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import {
  ResourceRefreshAction,
  ResourceState,
} from '@/components/admin/resource-ui';
import { AdminPageHeader } from '@/components/admin/admin-page-header';
import { Button } from '@/components/ui/action-button';
import { Badge } from '@/components/ui/status-badge';
import { Card, CardContent } from '@/components/ui/card';
import { Field, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { SuperAdminLayout } from '@/features/super-admin-layout/components/super-admin-layout';
import { getBusCompanyFilterOptions } from '@/features/bus-companies/services/bus-company-service';
import type { BusCompanyFilterOption } from '@/features/bus-companies/services/bus-company-service';
import { PlatformRbacScopeNavigation } from './platform-rbac-scope-navigation';

function getErrorMessage(error: unknown, fallbackMessage: string): string {
  return error instanceof Error && error.message
    ? error.message
    : fallbackMessage;
}

export function PlatformTenantRbacPicker() {
  const tRbac = useTranslations('rbac');
  const tCommon = useTranslations('common');
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
        if (!controller.signal.aborted) {
          setError(getErrorMessage(reason, tRbac('cannotLoadCompanies')));
        }
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
  const showState =
    loading ||
    error !== null ||
    companies.length === 0 ||
    filteredCompanies.length === 0;

  return (
    <SuperAdminLayout
      activeSection="rbac"
      breadcrumbs={[
        { label: tRbac('rbacTitle'), href: '/rbac' },
        { label: tRbac('operatorsCount') },
      ]}
    >
      <div
        aria-busy={loading}
        className="admin-page-content admin-ui space-y-6 [&>nav]:mt-0"
      >
        <AdminPageHeader
          eyebrow={tRbac('eyebrowPlatform')}
          title={tRbac('tenantTitle')}
          titleId="platform-tenant-rbac-title"
          actions={
            <ResourceRefreshAction loading={loading} onClick={retryLoading} />
          }
        />

        <PlatformRbacScopeNavigation
          activeScope="tenant"
        />

        <section aria-labelledby="tenant-rbac-picker-title">
          <Card className="gap-0 py-0">
            <div className="flex flex-wrap items-start justify-between gap-3 px-4 pt-4 sm:px-5 sm:pt-5">
              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground">
                  {tRbac('customConfig')}
                </p>
                <h2
                  id="tenant-rbac-picker-title"
                  className="text-base font-semibold"
                >
                  {tRbac('selectBusCompany')}
                </h2>
              </div>
              <Badge aria-live="polite" variant="secondary">
                {loading
                  ? tCommon('loading')
                  : tRbac('operatorsCount', { count: filteredCompanies.length })}
              </Badge>
            </div>

            <div className="px-4 py-4 sm:px-5 sm:py-5">
              <Field>
                <FieldLabel htmlFor="platform-tenant-rbac-search">
                  {tRbac('searchOperatorLabel')}
                </FieldLabel>
                <div className="relative">
                  <Search
                    aria-hidden="true"
                    className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
                  />
                  <Input
                    autoComplete="off"
                    id="platform-tenant-rbac-search"
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder={tRbac('searchOperatorPlaceholder')}
                    type="search"
                    value={search}
                    className="pl-10"
                  />
                </div>
              </Field>
            </div>

            {showState && (
              <div className="border-t px-4 py-2 sm:px-5">
                {loading && (
                  <ResourceState loading>
                    {tRbac('loadingConfig')}
                  </ResourceState>
                )}
                {!loading && error && (
                  <ResourceState error>
                    <div className="grid justify-items-center gap-3">
                      <h3 className="text-base font-semibold">
                        {tRbac('cannotLoadCompanies')}
                      </h3>
                      <p>{error}</p>
                      <Button onClick={retryLoading} variant="outline">
                        {tCommon('retry')}
                      </Button>
                    </div>
                  </ResourceState>
                )}
                {!loading && !error && companies.length === 0 && (
                  <ResourceState>
                    {tRbac('noOperatorsToConfig')}
                  </ResourceState>
                )}
                {!loading &&
                  !error &&
                  companies.length > 0 &&
                  filteredCompanies.length === 0 && (
                  <ResourceState>
                    {tRbac('noOperatorsMatch', { query: search.trim() })}
                  </ResourceState>
                  )}
              </div>
            )}

            {!loading && !error && filteredCompanies.length > 0 && (
              <CardContent className="border-t py-4 sm:py-5">
                <ul
                  aria-label={tRbac('operatorsListAriaLabel')}
                  className="grid list-none grid-cols-1 gap-3 p-0 md:grid-cols-2 xl:grid-cols-3"
                >
                  {filteredCompanies.map((company) => (
                    <li key={company.id}>
                      <Link
                        className="group/link block rounded-[var(--admin-radius-panel)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                        href={`/rbac/tenants/${company.id}`}
                      >
                        <Card className="min-h-[76px] flex-row items-center gap-3 border px-4 py-3 transition-colors group-hover/link:border-primary/40 group-hover/link:bg-accent/30">
                          <span className="grid size-10 shrink-0 place-items-center rounded-md bg-accent text-primary">
                            <Building2 aria-hidden="true" size={18} />
                          </span>
                          <span className="min-w-0 flex-1 break-words text-[13px] font-semibold leading-[1.45]">
                            {company.label}
                          </span>
                          <ChevronRight
                            aria-hidden="true"
                            className="size-4 shrink-0 text-muted-foreground"
                          />
                        </Card>
                      </Link>
                    </li>
                  ))}
                </ul>
              </CardContent>
            )}
          </Card>
        </section>
      </div>
    </SuperAdminLayout>
  );
}
